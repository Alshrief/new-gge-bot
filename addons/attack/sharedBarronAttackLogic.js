if (require("node:worker_threads").isMainThread)
    return module.exports = { hidden: true }

const pretty = require("pretty-time")
const { spendSkip, haveEnoughSkips } = require("../skips.js")
const { castles, ClientCommands, AreaType, KingdomID, movements, movementEvents, resources, setCastle } = require("../../protocols")
const {
    waitToAttack,
    getAttackInfo,
    assignUnit,
    getAmountSoldiersFlank,
    getAmountSoldiersFront,
    getMaxUnitsInReinforcementWave,
    getTotalAmountToolsFlank,
    getTotalAmountToolsFront } = require("./attack.js")
const { isTroopResourceTypeAllowed, orderTroopsByTypePreference } = require("./troopTypeFilter.js")
const { freeCommander, useCommander } = require("../commander")
const { sendXT, waitForResult, botConfig, playerInfo } = require("../../ggeBot.js")
const err = require("../../err.json")
const minTroopCount = 80

try {
    var { recruitTroops } = require("../../addons-extra/externalEventHelper.js")
}
catch (e) {
    console.debug(e)
}

class BarronKingdomAttacker {
    constructor(type, kingdomID, options, maxLevel) {
        this.type = type
        this.kingdomID = kingdomID
        this.options = options
        if (this.options.useCoin === undefined) this.options.useCoin = true
        if (this.options.useFeather === undefined) this.options.useFeather = false
        this.maxLevel = maxLevel
        this.areas = []
        this.castle = null
        this.inProgressAttacks = new Set()
    }

    getLevel(victorys) {
        return Math.floor(1.9 * Math.pow(victorys, .555)) + ([1, 35, 20, 45][this.kingdomID] ?? 0)
    }

    async init() {
        this.castle = castles.find(e => e.kingdomID == this.kingdomID &&
            [AreaType.externalKingdom, AreaType.mainCastle].includes(e.areaInfo.type))
        await this.updateAreas()
    }

    async updateAreas() {
        this.castle = castles.find(e => e.kingdomID == this.kingdomID &&
            [AreaType.externalKingdom, AreaType.mainCastle].includes(e.areaInfo?.type))
        if (!this.castle) return
        try {
            this.areas = (await ClientCommands.getAreaInfo(this.kingdomID,
                this.castle.areaInfo.x - 250, this.castle.areaInfo.y - 250,
                this.castle.areaInfo.x + 250, this.castle.areaInfo.y + 250))
                .areaInfo.filter(ai => ai.type == this.type).sort((a, b) =>
                    (Math.pow(this.castle.areaInfo.x - a.x, 2) + Math.pow(this.castle.areaInfo.y - a.y, 2)) -
                    (Math.pow(this.castle.areaInfo.x - b.x, 2) + Math.pow(this.castle.areaInfo.y - b.y, 2)))

            if (this.areas.length > 0) {
                console.info(`[Attack Barons] Kingdom ${this.kingdomID}: Found ${this.areas.length} targets. Castle: ${this.castle.areaInfo.x}:${this.castle.areaInfo.y}. Closest target: ${this.areas[0].x}:${this.areas[0].y}.`)
            }
        } catch (e) {
            console.warn(e)
        }
    }

    async skipTarget(areaInfo) {
        while (areaInfo.extraData[2] > 0) {
            let skip = spendSkip(areaInfo.extraData[2], this.options)

            if (skip == undefined)
                break

            const { result } = await ClientCommands.skipTarget(this.type, areaInfo.x, areaInfo.y, this.kingdomID, skip)

            if (result != 0)
                break
        }
    }

    getNextReadyTarget() {
        if (!this.castle) return null
        const timeSinceEpoch = Date.now()
        for (const areaInfo of this.areas) {
            const targetKey = `${areaInfo.x}:${areaInfo.y}`
            if (this.inProgressAttacks.has(targetKey))
                continue

            const shouldUpgradeTower = this.options.upgradeTowers && this.getLevel(areaInfo.extraData[1]) != this.maxLevel
            const skipsPerTower = 7200

            const coinSkips = recruitTroops ? Math.floor(resources.coins / (1000 / (20 * 5))) : 0
            const enoughSkips = haveEnoughSkips(skipsPerTower * movements.reduce((count, movement) =>
                (movement.targetAttack.type == this.type ? count++ : count, count), 0) - coinSkips, this.options) || (recruitTroops && resources.coins > 25000)

            if (enoughSkips && (this.options.useTimeSkips || shouldUpgradeTower)) {
                return areaInfo // ready now (using skips)
            }

            const cooldownRemaining = (areaInfo.timeSinceRequest + areaInfo.extraData[2] * 1000) - timeSinceEpoch
            if (cooldownRemaining > 0)
                continue

            if (movements.find(movement =>
                movement.kingdomID == this.kingdomID &&
                movement.targetAttack.x == areaInfo.x && movement.targetAttack.y == areaInfo.y))
                continue

            return areaInfo
        }
        return null
    }

    async attackTarget(areaInfo, commander) {
        const targetKey = `${areaInfo.x}:${areaInfo.y}`
        this.inProgressAttacks.add(targetKey)
        const hasShieldMadiens = commander.getEffects(this.type).AttackSupportUnits
        try {
            const attackInfo = await waitToAttack(async () => {
                let level = this.getLevel(areaInfo.extraData[1])
                if (isNaN(level) || level <= 0) {
                    level = [1, 35, 20, 45][this.kingdomID] ?? 1
                }
                const attackerMeleeTroops = []
                const attackerRangeTroops = []
                const attackerShieldTools = []
                const attackerWallTools = []
                const attackerGateTools = []

                const unitInv = this.castle.unitInventory ?? []
                for (let i = 0; i < unitInv.length; i++) {
                    const unit = unitInv[i]
                    if (unit.amount <= 0)
                        continue

                    if (unit.unitInfo.toolCategory &&
                        unit.unitInfo.usageEventID == undefined &&
                        unit.unitInfo.allowedToAttack == undefined &&
                        unit.unitInfo.typ == 'Attack' &&
                        unit.unitInfo.amountPerWave == undefined) {
                        if (unit.unitInfo.wallBonus && this.options.useWallTools !== false)
                            attackerWallTools.push(unit)
                        else if (unit.unitInfo.gateBonus && this.options.useWallTools !== false && this.kingdomID == KingdomID.firePeaks)
                            attackerGateTools.push(unit)
                        else if (unit.unitInfo.defRangeBonus && this.options.useShields)
                            attackerShieldTools.push(unit)
                    }
                    else if (unit.unitInfo.fightType == 0 &&
                        isTroopResourceTypeAllowed(unit.unitInfo, this.options)) {
                        if (!this.options.useDogs && unit.unitInfo.wodID == 277)
                            continue
                        if (this.options.useDogs && unit.unitInfo.wodID != 277)
                            continue
                        if (unit.unitInfo.role == "melee")
                            attackerMeleeTroops.push(unit)
                        else if (unit.unitInfo.role == "ranged")
                            attackerRangeTroops.push(unit)
                    }
                }

                let allTroopCount = 0

                orderTroopsByTypePreference(attackerMeleeTroops, this.options)
                orderTroopsByTypePreference(attackerRangeTroops, this.options)

                attackerRangeTroops.forEach(e => allTroopCount += e.amount)
                attackerMeleeTroops.forEach(e => allTroopCount += e.amount)

                if (allTroopCount < minTroopCount)
                    throw "NO_MORE_TROOPS"

                attackerWallTools.sort((a, b) =>
                    Number(a.unitInfo.wallBonus) - Number(b.unitInfo.wallBonus))

                attackerGateTools.sort((a, b) =>
                    Number(a.unitInfo.gateBonus) - Number(b.unitInfo.gateBonus))

                attackerShieldTools.sort((a, b) =>
                    Number(a.unitInfo.defRangeBonus) - Number(b.unitInfo.defRangeBonus))

                // Count wood shields
                const woodShields = attackerShieldTools.filter(u => u.unitInfo.wodID === 36)
                let woodShieldCount = woodShields.reduce((sum, u) => sum + Number(u.amount || 0), 0)

                // Auto-buy wood shields if configured
                if (this.options.buyTools) {
                    const threshold = Number(this.options.buyThreshold || 100)
                    const limit = Number(this.options.maxShieldBuyLimit || 1000)
                    const buyAmount = Math.min(1000, Number(this.options.buyAmount || 1000))

                    if (woodShieldCount < threshold && woodShieldCount < limit) {
                        while (woodShieldCount < limit) {
                            const buyQty = Math.min(buyAmount, limit - woodShieldCount)
                            if (buyQty <= 0) break

                            console.info(`[Attack Barons] Wood shields count (${woodShieldCount}) below limit (${limit}) in Kingdom ${this.kingdomID}. Buying ${buyQty} wood shields.`)
                            try {
                                let success = false
                                await setCastle(this.castle, async () => {
                                    await sendXT("sbp", JSON.stringify({
                                        PID: 36, // Wood shield
                                        BT: 0,
                                        TID: 27,
                                        AMT: buyQty,
                                        KID: this.kingdomID,
                                        AID: -1,
                                        PC2: -1,
                                        BA: 0,
                                        PWR: 0,
                                        _PO: -1
                                    }))
                                    const [, buyRes] = await waitForResult("sbp", 1000 * 15, (obj, r) => {
                                        if (r != 0) return true
                                        if (obj.PID == 36 && obj.AMT == buyQty) return true
                                    })
                                    if (buyRes == 0) {
                                        console.info(`[Attack Barons] Successfully purchased ${buyQty} wood shields in Kingdom ${this.kingdomID}`)
                                        woodShieldCount += buyQty
                                        const shieldItem = woodShields[0]
                                        if (shieldItem) {
                                            shieldItem.amount += buyQty
                                        } else {
                                            attackerShieldTools.push({
                                                amount: buyQty,
                                                unitInfo: {
                                                    wodID: 36,
                                                    defRangeBonus: 1,
                                                    toolCategory: true,
                                                    typ: 'Attack'
                                                }
                                            })
                                        }
                                        success = true
                                    } else {
                                        console.warn(`[Attack Barons] Server rejected shield purchase with error code: ${buyRes}`)
                                    }
                                })
                                if (!success) {
                                    break
                                }
                            } catch (buyErr) {
                                console.error("[Attack Barons] Failed to purchase wood shields:", buyErr)
                                break
                            }
                        }
                    }
                }

                // Stop attacks if shields run out
                if (this.options.useShields && this.options.stopOnNoShields) {
                    const totalShields = attackerShieldTools.reduce((sum, u) => sum + Number(u.amount || 0), 0)
                    if (totalShields <= 0) {
                        console.warn(`[Attack Barons] Stop on no shields is enabled, and no shields are available in Kingdom ${this.kingdomID}. Skipping attack.`)
                        throw "NO_SHIELDS_AVAILABLE"
                    }
                }

                const autoConfigure = !(this.options.attackLeft || this.options.attackRight || this.options.attackMiddle)
                const commanderStats = commander.getEffects()
                const attackTargetInfo = getAttackInfo(this.kingdomID, this.castle, areaInfo, commander, level, parseInt(this.options.attackWaves), this.options, commanderStats.additionalWaves)
                const maxTroopFront = getAmountSoldiersFront(level, commanderStats.attackUnitAmountFront)
                const maxTroopFlank = getAmountSoldiersFlank(level, commanderStats.attackUnitAmountFlank)
                const maxToolsFlank = this.options.useShields ? getTotalAmountToolsFlank(level, 0) : 10
                const maxToolsFront = this.options.useShields ? getTotalAmountToolsFront(level) : 10

                // Use skips if needed before attack is formulated/sent
                const shouldUpgradeTower = this.options.upgradeTowers && level != this.maxLevel
                const coinSkips = recruitTroops ? Math.floor(resources.coins / (1000 / (20 * 5))) : 0
                const skipsPerTower = 7200
                const enoughSkips = haveEnoughSkips(skipsPerTower * movements.reduce((count, movement) =>
                    (movement.targetAttack.type == this.type ? count++ : count, count), 0) - coinSkips, this.options) || (recruitTroops && resources.coins > 25000)

                if (enoughSkips && (this.options.useTimeSkips || shouldUpgradeTower) && areaInfo.extraData[2] > 0) {
                    try {
                        await this.skipTarget(areaInfo)
                    } catch (e) {
                        console.warn(e)
                    }
                }

                attackTargetInfo.A.forEach((wave, index) => {
                    let maxTroops = maxTroopFlank

                    if (index == 0 && this.options.useWallTools) {
                        const desiredToolCount = 10
                        let maxTools = maxToolsFlank
                        if (autoConfigure ? true : this.options.attackLeft) {
                            wave.L.T.forEach((unitSlot, i) =>
                                maxTools -= assignUnit(unitSlot, i == 0 ?
                                    attackerWallTools : attackerShieldTools, Math.min(maxTools, desiredToolCount)))

                            wave.L.U.forEach(unitSlot =>
                                maxTroops -= assignUnit(unitSlot, attackerRangeTroops.length <= 0 ?
                                    attackerMeleeTroops : attackerRangeTroops, maxTroops))
                        }
                        maxTools = maxToolsFlank
                        if (this.options.attackRight) {
                            wave.R.T.forEach((unitSlot, i) =>
                                maxTools -= assignUnit(unitSlot, i == 0 ?
                                    attackerWallTools : attackerShieldTools, Math.min(maxTools, desiredToolCount)))

                            maxTroops = maxTroopFlank
                            wave.R.U.forEach(unitSlot =>
                                maxTroops -= assignUnit(unitSlot, attackerRangeTroops.length <= 0 ?
                                    attackerMeleeTroops : attackerRangeTroops, maxTroops))
                        }
                        let maxToolsM = maxToolsFront
                        if (this.options.attackMiddle) {
                            wave.M.T.forEach((unitSlot, i) =>
                                maxToolsM -= assignUnit(unitSlot, i == 0 ?
                                    (this.kingdomID == KingdomID.firePeaks ? attackerGateTools : attackerWallTools) : attackerShieldTools, Math.min(maxToolsM, desiredToolCount)))

                            maxTroops = maxTroopFront
                            wave.M.U.forEach(unitSlot =>
                                maxTroops -= assignUnit(unitSlot, attackerRangeTroops.length <= 0 ?
                                    attackerMeleeTroops : attackerRangeTroops, maxTroops))
                        }
                        return
                    }

                    if (autoConfigure ? true : this.options.attackLeft) {
                        wave.L.U.forEach(unitSlot =>
                            maxTroops -= assignUnit(unitSlot, attackerMeleeTroops.length <= 0 ?
                                attackerRangeTroops : attackerMeleeTroops, maxTroops))
                    }
                    if (this.options.attackRight) {
                        maxTroops = maxTroopFlank
                        wave.R.U.forEach(unitSlot =>
                            maxTroops -= assignUnit(unitSlot, attackerMeleeTroops.length <= 0 ?
                                attackerRangeTroops : attackerMeleeTroops, maxTroops))
                    }
                    if (this.options.attackMiddle) {
                        maxTroops = maxTroopFront
                        wave.M.U.forEach(unitSlot =>
                            maxTroops -= assignUnit(unitSlot, attackerMeleeTroops.length <= 0 ?
                                attackerRangeTroops : attackerMeleeTroops, maxTroops))
                    }
                })

                if (autoConfigure ? (hasShieldMadiens ? false : true) : this.options.attackCourtyard) {
                    let maxTroops = getMaxUnitsInReinforcementWave(playerInfo.level, level) + Number(0 | commanderStats.attackUnitAmountReinforcementBonus)
                    attackTargetInfo.RW.forEach((unitSlot, i) => {
                        let attacker = i & 1 ?
                            (attackerRangeTroops.length > 0 ? attackerRangeTroops : attackerMeleeTroops) :
                            (attackerMeleeTroops.length > 0 ? attackerMeleeTroops : attackerRangeTroops)

                        maxTroops -= assignUnit(unitSlot, attacker,
                            Math.floor(maxTroops / 2) - 1)
                    })
                }

                await sendXT("cra", JSON.stringify(attackTargetInfo))

                let [obj, result] = await waitForResult("cra", 1000 * 10, (obj, result) => {
                    if (result != 0)
                        return true

                    if (obj.AAM.M.KID != this.kingdomID || obj.AAM.M.TA[1] != areaInfo.x || obj.AAM.M.TA[2] != areaInfo.y)
                        return false
                    return true
                })

                if (result != 0)
                    throw err[result]

                return obj
            }, { profile: "baron" })

            if (!attackInfo) {
                return false
            }

            // Update local target cooldown upon successful attack
            areaInfo.timeSinceRequest = Date.now()
            areaInfo.extraData[2] = 5400

            console.info("hittingTargetAttack", KingdomID[this.kingdomID], ' ', 'C', attackInfo.AAM.UM.L.VIS + 1, ' ', attackInfo.AAM.M.TA[1], ':', attackInfo.AAM.M.TA[2], " ", pretty(Math.round(1000000000 * Math.abs(Math.max(0, attackInfo.AAM.M.TT - attackInfo.AAM.M.PT))), 's'), "tillImpactAttack")
            return true
        } catch (e) {
            switch (e) {
                case "NO_MORE_TROOPS":
                    try {
                        if (botConfig.externalEvent && this.kingdomID == KingdomID.greatEmpire && recruitTroops) {
                            await recruitTroops()
                            return true
                        }
                    }
                    catch (errRec) {
                        console.debug(errRec)
                    }
                    console.log(`[${KingdomID[this.kingdomID]}] Waiting for more troops`)
                    await new Promise(resolve => {
                        const onReturn = (movement) => {
                            if (movement.kingdomID != this.kingdomID || movement.targetAttack.extraData[0] != this.castle.id)
                                return
                            movementEvents.off("return", onReturn)
                            resolve()
                        }
                        movementEvents.on("return", onReturn)
                    })
                    return true
                case "NO_SHIELDS_AVAILABLE":
                    console.log(`[${KingdomID[this.kingdomID]}] No shields available. Pausing attacks.`)
                    await new Promise(resolve => setTimeout(resolve, 60000).unref())
                    return true
                case "LORD_IS_USED":
                    useCommander(commander.lordID)
                case "COOLING_DOWN":
                case "TIMED_OUT":
                case "MISSING_UNITS":
                case "ATTACK_TOO_MANY_UNITS":
                case "NOT_ENOUGH_CURRENCY1":
                    return true
                case "CANT_START_NEW_ARMIES":
                default:
                    throw e
            }
        } finally {
            setTimeout(() => {
                this.inProgressAttacks.delete(targetKey)
            }, 6000).unref()
        }
    }
}

module.exports = BarronKingdomAttacker
