if (require('node:worker_threads').isMainThread)
    return module.exports = {
        hidden: true
    }

const pretty = require('pretty-time')
const { movements, movementEvents, castles, ClientCommands, AreaType, KingdomID, spiralCoordinates } = require('../../protocols')
const { waitToAttack, getAttackInfo, assignUnit, getAmountSoldiersFlank, getMaxUnitsInReinforcementWave } = require("./attack")
const { getTroopResourceType, getMeadTroopLevel, isTroopResourceTypeAllowed, resolveTroopTypeSettings, getTroopTypeOrder } = require("./troopTypeFilter.js")
const { freeCommander, useCommander } = require("../commander")
const { sendXT, waitForResult, playerInfo } = require("../../ggeBot.js")
const err = require('../../err.json')

const minTroopCount = 100
const minTroopCountCY = 500
const type = AreaType.fortress

class FortressKingdomAttacker {
    constructor(kingdomID, level, options) {
        this.kingdomID = kingdomID
        this.level = level
        this.options = options
        if (this.options.useCoin === undefined) this.options.useCoin = true
        if (this.options.useFeather === undefined) this.options.useFeather = false
        this.areas = []
        this.castle = null
        this.lastNoTargetLogAt = 0
    }

    async init() {
        this.castle = castles.find(e => e.kingdomID == this.kingdomID && e.areaInfo.type == AreaType.externalKingdom)
        if (!this.castle) {
            console.warn("[Fortress]", `[${KingdomID[this.kingdomID] ?? this.kingdomID}]`, "No external castle found")
            return
        }
        console.info("[Fortress]", `[${KingdomID[this.kingdomID] ?? this.kingdomID}]`, "Initialized", `${this.castle.areaInfo.x}:${this.castle.areaInfo.y}`)
        await this.updateAreas()
    }

    async updateAreas() {
        this.areas = []
        done:
        for (let i = 0, j = 0; i < 13 * 13; i++) {
            let rX, rY
            let rect
            do {
                ({ x: rX, y: rY } = spiralCoordinates(j++))
                rX *= 100
                rY *= 100

                rect = {
                    x: this.castle.areaInfo.x + rX - 50,
                    y: this.castle.areaInfo.y + rY - 50,
                    w: this.castle.areaInfo.x + rX + 50,
                    h: this.castle.areaInfo.y + rY + 50
                }
                if (j > Math.pow(13 * 13, 2))
                    break done
            } while ((this.castle.areaInfo.x + rX) <= -50 ||
            (this.castle.areaInfo.y + rY) <= -50 || (this.castle.areaInfo.x + rX) >= (1286 + 50) || (this.castle.areaInfo.y + rY) >= (1286 + 50))

            rect.x = rect.x < 0 ? 0 : rect.x
            rect.y = rect.y < 0 ? 0 : rect.y
            rect.w = rect.w < 0 ? 0 : rect.w
            rect.h = rect.h < 0 ? 0 : rect.h
            rect.x = rect.x > 1286 ? 1286 : rect.x
            rect.y = rect.y > 1286 ? 1286 : rect.y
            rect.w = rect.w > 1286 ? 1286 : rect.w
            rect.h = rect.h > 1286 ? 1286 : rect.h

            const fetched = (await ClientCommands.getAreaInfo(this.kingdomID, rect.x, rect.y, rect.w, rect.h)).areaInfo.filter(e => e.type == type)
            this.areas.push(...fetched)
        }

        this.areas.sort((a, b) =>
            (Math.pow(this.castle.areaInfo.x - a.x, 2) + Math.pow(this.castle.areaInfo.y - a.y, 2)) -
            (Math.pow(this.castle.areaInfo.x - b.x, 2) + Math.pow(this.castle.areaInfo.y - b.y, 2)))
    }

    async getNextReadyTarget() {
        if (!this.castle) return null
        const timeSinceEpoch = Date.now()
        for (const areaInfo of this.areas) {
            if (movements.find(movement =>
                movement.kingdomID == this.kingdomID &&
                movement.targetAttack.x == areaInfo.x && movement.targetAttack.y == areaInfo.y))
                continue

            if (((areaInfo.timeSinceRequest + areaInfo.extraData[2] * 1000) - timeSinceEpoch) > -5000)
                continue

            let refreshedAreaInfo = areaInfo
            try {
                // refresh cooldown/burning state before deciding if this fortress is ready
                const spyResult = await ClientCommands.preSpyInfo(areaInfo.x, areaInfo.y, this.kingdomID, false)
                if (spyResult?.areaInfo) {
                    refreshedAreaInfo = spyResult.areaInfo
                }
            } catch (e) {
                console.warn("preSpyInfo failed for fortress", areaInfo.x, areaInfo.y, e)
                continue
            }

            if (refreshedAreaInfo.extraData[2] > 0)
                continue

            return refreshedAreaInfo
        }
        const now = Date.now()
        if (now - this.lastNoTargetLogAt > 60000) {
            this.lastNoTargetLogAt = now
            console.info("[Fortress]", `[${KingdomID[this.kingdomID] ?? this.kingdomID}]`, "No ready target", `areas=${this.areas.length}`)
        }
        return null
    }

    async attackTarget(areaInfo, commander) {
        const hasShieldMadiens = commander.getEffects().AttackSupportUnits
        try {
            const attackInfo = await waitToAttack(async () => {
                const attackTargetInfo = getAttackInfo(this.kingdomID, this.castle, areaInfo, commander, this.level, undefined, this.options)
                const attackerTroops = []

                const unitInv = this.castle.unitInventory ?? []
                for (let i = 0; i < unitInv.length; i++) {
                    const unit = unitInv[i]
                    if (unit.amount <= 0)
                        continue

                    if (unit.unitInfo.fightType == 0 &&
                        unit.unitInfo.role &&
                        isTroopResourceTypeAllowed(unit.unitInfo, this.options)) {
                        if (this.kingdomID == KingdomID.firePeaks &&
                            unit.unitInfo.wodID == 277 && !hasShieldMadiens)
                            continue

                        attackerTroops.push(unit)
                    }
                }

                const troopTypeOrder = getTroopTypeOrder(resolveTroopTypeSettings(this.options))
                attackerTroops.sort((a, b) => {
                    const typeCmp = troopTypeOrder.indexOf(getTroopResourceType(a.unitInfo)) -
                        troopTypeOrder.indexOf(getTroopResourceType(b.unitInfo))
                    if (typeCmp !== 0)
                        return typeCmp

                    const levelA = getMeadTroopLevel(a.unitInfo)
                    const levelB = getMeadTroopLevel(b.unitInfo)
                    if (levelA !== null && levelB !== null && levelA !== levelB)
                        return levelA - levelB

                    return Number(b.unitInfo.speed) - Number(a.unitInfo.speed)
                })

                let allTroopCount = 0
                attackerTroops.forEach(e => allTroopCount += e.amount)

                if (allTroopCount < minTroopCount + (hasShieldMadiens ? 0 : minTroopCountCY))
                    throw "NO_MORE_TROOPS"

                attackTargetInfo.A.forEach((wave, i) => {
                    if (i > 2 && this.kingdomID != KingdomID.firePeaks)
                        return
                    if (i > 4 && this.kingdomID == KingdomID.firePeaks)
                        return

                    const maxTroopFlank = getAmountSoldiersFlank(this.level)
                    let maxTroops = maxTroopFlank

                    wave.L.U.forEach(unitSlot =>
                        maxTroops -= assignUnit(unitSlot, attackerTroops, maxTroops))
                })

                if (!hasShieldMadiens) {
                    let maxTroops = getMaxUnitsInReinforcementWave(playerInfo.level, this.level)
                    attackTargetInfo.RW.forEach(unitSlot =>
                        maxTroops -= assignUnit(unitSlot, attackerTroops, maxTroops))
                }

                await sendXT("cra", JSON.stringify(attackTargetInfo))

                const [obj, result] = await waitForResult("cra", 1000 * 10, (obj, result) => {
                    if (result != 0)
                        return true

                    if (obj.AAM.M.KID != this.kingdomID || obj.AAM.M.TA[1] != areaInfo.x || obj.AAM.M.TA[2] != areaInfo.y)
                        return false
                    return true
                })

                if (result != 0)
                    throw err[result]

                return obj
            })

            if (!attackInfo) {
                return false
            }

            console.info("hittingTargetAttack", KingdomID[this.kingdomID], ' ', 'C', attackInfo.AAM.UM.L.VIS + 1, ' ', attackInfo.AAM.M.TA[1], ':', attackInfo.AAM.M.TA[2], " ", pretty(Math.round(1000000000 * Math.abs(Math.max(0, attackInfo.AAM.M.TT - attackInfo.AAM.M.PT))), 's'), "tillImpactAttack")
            return true
        } catch (e) {
            switch (e) {
                case "NO_MORE_TROOPS":
                    await new Promise(resolve => {
                        const onReturn = (movement) => {
                            if (movement.kingdomID != this.kingdomID || movement.targetAttack.extraData[0] != this.castle.areaInfo.id)
                                return
                            movementEvents.off("return", onReturn)
                            resolve()
                        }
                        movementEvents.on("return", onReturn)
                    })
                    return true
                case "LORD_IS_USED":
                    useCommander(commander.lordID)
                case "COOLING_DOWN":
                case "TIMED_OUT":
                case "MISSING_UNITS":
                case "CANT_START_NEW_ARMIES":
                case "NOT_ENOUGH_CURRENCY1":
                    return true
                default:
                    throw e
            }
        }
    }
}

module.exports = FortressKingdomAttacker
