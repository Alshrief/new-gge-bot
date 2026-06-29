if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            {
                type: "Checkbox",
                key: "eventWallToolsFirst",
                default: false
            },
            {
                type: "Checkbox",
                key: "useFeather",
                default: false
            },
            {
                type: "Checkbox",
                key: "useCoin",
                default: false
            },
            {
                type: "Checkbox",
                key: "rejectOnShieldShortage",
                default: false
            },
            {
                type: "Checkbox",
                key: "useWoodShieldsFallback",
                default: false
            },
            {
                type: "Checkbox",
                key: "useIronShieldsFallback",
                default: false
            },
            {
                type: "Checkbox",
                key: "requireLaddersAndRams",
                default: false
            },
            {
                type: "Select",
                key: "chestsMode",
                selection: ["No chests (Only troops)", "Low-value chests first", "High-value chests first"],
                default: 2
            },
            {
                type: "Checkbox",
                key: "reputation",
                default: false
            },
            {
                type: "Checkbox",
                key: "noEventTools",
                default: false
            },
            {
                type: "Text",
                key: "wallTools",
                default: "5"
            },
            {
                type: "Text",
                key: "gateTools",
                default: "5"
            },
            {
                type: "Text",
                key: "shieldTools",
                default: "25"
            },
            ...require("./troopTypeOptions.js"),
            {
                type: "Text",
                key: "commanderWhiteList",
                default: "1-99"
            },
            {
                type: "Text",
                key: "scoreShutoff"
            },
            {
                type: "Text",
                key: "customReinforcementLimit",
                default: ""
            },

            { type: "Label", key: "attackSettings" },
            {
                type: "Checkbox",
                key: "attackLeft",
                default: true
            },
            {
                type: "Checkbox",
                key: "attackMiddle",
                default: true
            },
            {
                type: "Checkbox",
                key: "attackRight",
                default: true
            },
            {
                type: "Checkbox",
                key: "attackCourtyard",
                default: true
            },
            ...require("../timeSkipsPluginOptions.js")
        ]

    }
const { spendSkip } = require("../skips.js")
const { movementEvents, ClassTypes, castles, ClientCommands, AreaType, KingdomID } = require("../../protocols.js")
const { waitToAttack, getAttackInfo, assignUnit, assignCustomTool, getTotalAmountToolsFlank, getTotalAmountToolsFront, getAmountSoldiersFlank, getAmountSoldiersFront, getMaxUnitsInReinforcementWave, getCombinedTroops, assignTroops, getMaxAttackers, getShieldCount } = require("./attack.js")
const { isTroopResourceTypeAllowed, orderTroopsByTypePreference } = require("./troopTypeFilter.js")
const { waitForCommanderAvailable, freeCommander, useCommander } = require('../commander.js')
const { sendXT, waitForResult, xtHandler, events, playerInfo, botConfig } = require('../../ggeBot.js')


const pretty = require('pretty-time')

const err = require('../../err.json')

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}

const kingdomID = KingdomID.greatEmpire
const type = AreaType.beriCamp
const minTroopCount = 100
const eventID = 85
let eventPoints = 0
let hasInitialScore = false

const scoreShutoff = Number(pluginOptions.scoreShutoff ?? 0) > 0
    ? Number(pluginOptions.scoreShutoff)
    : Infinity

const skipTarget = async areaInfo => {
    if (!pluginOptions.useTimeSkips) return
    while (areaInfo.extraData[2] > 0) {
        let skip = spendSkip(areaInfo.extraData[2], pluginOptions)

        if (skip == undefined)
            break

        const { result } = await ClientCommands.skipTarget(type, areaInfo.x, areaInfo.y, kingdomID, skip)

        if (result != 0)
            break
    }
}

movementEvents.on("returning", (/** @type {import("../../protocols.js").ClassTypes.Movement} */ movement) => {
    if (movement.targetOwner.ownerID != playerInfo.playerID)
        return

    if (movement.sourceAttack.type != type)
        return

    skipTarget(movement.sourceAttack)
})

let quit = false

xtHandler.on("pep", obj => {
    if (obj.EID != eventID)
        return
    eventPoints = Number(obj.OP[0])
    hasInitialScore = true
    if (scoreShutoff > 0 && eventPoints >= scoreShutoff) {
        console.log("shuttingDownEvent", "scoreReached")
        quit = true
    }
})

events.on("eventStop", eventInfo => {
    if (eventInfo.EID != eventID)
        return

    if (quit)
        return

    console.log("shuttingDownEvent", "eventEnded")
    quit = true
})
events.on("eventStart", async eventInfo => {
    if (eventInfo.EID != eventID)
        return

    quit = false

    const castle = castles.find(e => e.kingdomID == kingdomID && e.areaInfo.type == AreaType.mainCastle)

    const areas = (await ClientCommands.getAreaInfo(kingdomID,
        castle.areaInfo.x - 50, castle.areaInfo.y - 50,
        castle.areaInfo.x + 50, castle.areaInfo.y + 50)).areaInfo.filter(ai => ai.type == type)

    while (!quit) {
        if (!hasInitialScore) {
            await sendXT("pep", JSON.stringify({ EID: eventID }))
            await new Promise(resolve => {
                const onPep = obj => {
                    if (obj.EID != eventID)
                        return
                    cleanup()
                }
                const onStop = stopInfo => {
                    if (stopInfo.EID != eventID)
                        return
                    cleanup()
                }
                const cleanup = () => {
                    xtHandler.off("pep", onPep)
                    events.off("eventStop", onStop)
                    resolve()
                }
                xtHandler.on("pep", onPep)
                events.on("eventStop", onStop)
            })
        }

        if (quit) break

        if (scoreShutoff > 0 && eventPoints >= scoreShutoff) {
            console.log("shuttingDownEvent", "scoreReached")
            quit = true
            break
        }
        const commander = await waitForCommanderAvailable(pluginOptions.commanderWhiteList)
        try {
            const attackInfo = await waitToAttack(async () => {
                const areaInfo = areas.shift()

                areas.push(areaInfo)

                await skipTarget(areaInfo)
                const level = areaInfo.extraData[1] + areaInfo.extraData[6] == 100 ? 70 : 56

                const attackerMeleeTroops = []
                const attackerRangeTroops = []
                const attackerBerimondTools = []
                const attackerWallBerimondTools = []
                const attackerGateBerimondTools = []
                const attackerShieldBerimondTools = []
                const attackerWallTools = []
                const attackerShieldTools = []
                const attackerGateTools = []

                const unitInv = castle.unitInventory ?? []
                for (let i = 0; i < unitInv.length; i++) {
                    const unit = unitInv[i]

                    if (unit.amount <= 0)
                        continue

                    if (unit.unitInfo.wodID == 277)
                        continue

                    if (unit.unitInfo.pointBonus != undefined) {
                        if (!unit.unitInfo.gateBonus && !unit.unitInfo.wallBonus && !unit.unitInfo.defRangeBonus) {
                            if (Number(pluginOptions.chestsMode ?? 2) !== 0 && !pluginOptions.reputation)
                                attackerBerimondTools.push(unit)
                        } else if (!pluginOptions.noEventTools) {
                            if (unit.unitInfo.gateBonus)
                                attackerGateBerimondTools.push(unit)
                            else if (unit.unitInfo.wallBonus)
                                attackerWallBerimondTools.push(unit)
                            else if (unit.unitInfo.defRangeBonus)
                                attackerShieldBerimondTools.push(unit)
                        }
                    }
                    else if (unit.unitInfo.reputationBonus != undefined && pluginOptions.reputation && (Number(pluginOptions.chestsMode ?? 2) !== 0)) {
                        attackerBerimondTools.push(unit)
                    }
                    else if (
                        unit.unitInfo.toolCategory &&
                        unit.unitInfo.usageEventID == undefined &&
                        unit.unitInfo.allowedToAttack == undefined &&
                        unit.unitInfo.typ == 'Attack' &&
                        unit.unitInfo.amountPerWave == undefined
                    ) {
                        if (unit.unitInfo.wallBonus)
                            attackerWallTools.push(unit)
                        else if (unit.unitInfo.gateBonus)
                            attackerGateTools.push(unit)
                        else if (unit.unitInfo.defRangeBonus) {
                            if (unit.unitInfo.wodID == 27 && !pluginOptions.useWoodShieldsFallback)
                                continue
                            if (unit.unitInfo.wodID == 172 && !pluginOptions.useIronShieldsFallback)
                                continue
                            attackerShieldTools.push(unit)
                        }
                    }
                    else if (unit.unitInfo.fightType == 0 &&
                        isTroopResourceTypeAllowed(unit.unitInfo, pluginOptions)) {
                        if (unit.unitInfo.role == "melee")
                            attackerMeleeTroops.push(unit)
                        else if (unit.unitInfo.role == "ranged")
                            attackerRangeTroops.push(unit)
                    }
                }

                let allTroopCount = 0

                orderTroopsByTypePreference(attackerMeleeTroops, pluginOptions)
                orderTroopsByTypePreference(attackerRangeTroops, pluginOptions)

                attackerRangeTroops.forEach(e => allTroopCount += e.amount)
                attackerMeleeTroops.forEach(e => allTroopCount += e.amount)

                if (allTroopCount < minTroopCount)
                    throw "NO_MORE_TROOPS"
                if (pluginOptions.rejectOnShieldShortage) {
                    const totalShields = getShieldCount(unitInv, pluginOptions, [778, 566, 773], pluginOptions.customWaves)
                    if (totalShields < 5) {
                        throw "نقص دروع"
                    }
                }
                const chestsMode = Number(pluginOptions.chestsMode ?? 2)

                if (pluginOptions.reputation) {
                    if (chestsMode === 1) {
                        attackerBerimondTools.sort((a, b) =>
                            Number(a.unitInfo.reputationBonus) - Number(b.unitInfo.reputationBonus))
                    } else {
                        attackerBerimondTools.sort((a, b) =>
                            Number(b.unitInfo.reputationBonus) - Number(a.unitInfo.reputationBonus))
                    }
                }
                else {
                    if (chestsMode === 1) {
                        attackerBerimondTools.sort((a, b) =>
                            Number(a.unitInfo.pointBonus) - Number(b.unitInfo.pointBonus))
                    } else {
                        attackerBerimondTools.sort((a, b) =>
                            Number(b.unitInfo.pointBonus) - Number(a.unitInfo.pointBonus))
                    }
                }

                if (chestsMode === 1) {
                    attackerGateBerimondTools.sort((a, b) =>
                        Number(a.unitInfo.pointBonus) - Number(b.unitInfo.pointBonus))
                    attackerWallBerimondTools.sort((a, b) =>
                        Number(a.unitInfo.pointBonus) - Number(b.unitInfo.pointBonus))
                    attackerShieldBerimondTools.sort((a, b) =>
                        Number(a.unitInfo.pointBonus) - Number(b.unitInfo.pointBonus))
                } else {
                    attackerGateBerimondTools.sort((a, b) =>
                        Number(b.unitInfo.pointBonus) - Number(a.unitInfo.pointBonus))
                    attackerWallBerimondTools.sort((a, b) =>
                        Number(b.unitInfo.pointBonus) - Number(a.unitInfo.pointBonus))
                    attackerShieldBerimondTools.sort((a, b) =>
                        Number(b.unitInfo.pointBonus) - Number(a.unitInfo.pointBonus))
                }

                attackerWallTools.sort((a, b) =>
                    Number(a.unitInfo.wallBonus) - Number(b.unitInfo.wallBonus))

                attackerShieldTools.sort((a, b) =>
                    Number(a.unitInfo.defRangeBonus) - Number(b.unitInfo.defRangeBonus))

                attackerGateTools.sort((a, b) =>
                    Number(a.unitInfo.gateBonus) - Number(b.unitInfo.gateBonus))

                attackerWallBerimondTools.push(...attackerWallTools)
                attackerShieldBerimondTools.push(...attackerShieldTools)
                attackerGateBerimondTools.push(...attackerGateTools)

                const commanderStats = commander.getEffects(type)
                const attackInfo = getAttackInfo(kingdomID, castle, areaInfo, commander, level, undefined, pluginOptions, commanderStats.additionalWaves)

                const maxToolsFlank = getTotalAmountToolsFlank(level, 0)
                const maxToolsFront = getTotalAmountToolsFront(level)
                const maxTroopFront = getAmountSoldiersFront(level, commanderStats.attackUnitAmountFront, true)
                const maxTroopFlank = getAmountSoldiersFlank(level, commanderStats.attackUnitAmountFlank, true)
                const desiredToolCount = attackerBerimondTools.length == 0 ? 20 : 10

                // Flank selection: if none selected or explicitly disabled
                const fillLeft   = pluginOptions.attackLeft !== false
                const fillMiddle = pluginOptions.attackMiddle !== false
                const fillRight  = pluginOptions.attackRight !== false
                const fillCourtyard = pluginOptions.attackCourtyard !== false
 
                const customWaves = pluginOptions.customWaves
                const useCustom = customWaves && customWaves.waves && (Array.isArray(customWaves.waves) || typeof customWaves.waves === 'object')
 
                const getWavePriority = (priority, waveIndex) => {
                    let resolved = priority
                    if (!resolved || resolved === 'default') {
                        resolved = (waveIndex === 0) ? 'ranged' : 'melee'
                    }
                    return resolved
                }
 
                attackInfo.A.forEach((wave, index) => {
                    let waveRemaining = maxTroopFlank * 2 + maxTroopFront
 
                    if (useCustom) {
                        let waveConfig = null
                        if (index < 4) {
                            waveConfig = customWaves.waves[index]
                        } else if (customWaves.repeatWave4) {
                            waveConfig = customWaves.waves[3]
                        }
                        
                        if (!waveConfig || waveConfig.enabled === false) {
                            return
                        }
 
                        // Wave-specific flank activation check
                        // Note: GGE Left (wave.L) is UI Right flank, and GGE Right (wave.R) is UI Left flank.
                        const fillLeftForWave = fillLeft && waveConfig.L_enabled !== false // UI Left
                        const fillMiddleForWave = fillMiddle && waveConfig.M_enabled !== false // UI Middle
                        const fillRightForWave = fillRight && waveConfig.R_enabled !== false // UI Right
 
                        // Fill GGE Right (attacker's Left) with UI Left tools
                        let maxTools = maxToolsFlank
                        if (fillLeftForWave && waveConfig.L) {
                            wave.R.T.forEach((unitSlot, i) => {
                                const tool = waveConfig.L[i]
                                if (tool && tool.toolId) {
                                    maxTools -= assignCustomTool(unitSlot, tool.toolId, Math.min(tool.quantity, maxTools), castle.unitInventory, pluginOptions)
                                }
                            })
                        }
 
                        // Fill GGE Left (attacker's Right) with UI Right tools
                        maxTools = maxToolsFlank
                        if (fillRightForWave && waveConfig.R) {
                            wave.L.T.forEach((unitSlot, i) => {
                                const tool = waveConfig.R[i]
                                if (tool && tool.toolId) {
                                    maxTools -= assignCustomTool(unitSlot, tool.toolId, Math.min(tool.quantity, maxTools), castle.unitInventory, pluginOptions)
                                }
                            })
                        }
 
                        // Fill GGE Middle (attacker's Middle) with UI Middle tools
                        maxTools = maxToolsFront
                        if (fillMiddleForWave && waveConfig.M) {
                            wave.M.T.forEach((unitSlot, i) => {
                                const tool = waveConfig.M[i]
                                if (tool && tool.toolId) {
                                    maxTools -= assignCustomTool(unitSlot, tool.toolId, Math.min(tool.quantity, maxTools), castle.unitInventory, pluginOptions)
                                }
                            })
                        }
 
                        // GGE Right (attacker's Left) gets UI Left troops
                        if (fillLeftForWave) {
                            const wavePriority = getWavePriority(waveConfig.priority, index)
                            const combined = getCombinedTroops(attackerMeleeTroops, attackerRangeTroops, wavePriority, pluginOptions)
                            const assigned = assignTroops(wave.R.U, combined, Math.min(maxTroopFlank, waveRemaining))
                            waveRemaining -= assigned
                        }
                        // GGE Left (attacker's Right) gets UI Right troops
                        if (fillRightForWave) {
                            const wavePriority = getWavePriority(waveConfig.priority, index)
                            const combined = getCombinedTroops(attackerMeleeTroops, attackerRangeTroops, wavePriority, pluginOptions)
                            const assigned = assignTroops(wave.L.U, combined, Math.min(maxTroopFlank, waveRemaining))
                            waveRemaining -= assigned
                        }
                        // GGE Middle (attacker's Middle) gets UI Middle troops
                        if (fillMiddleForWave) {
                            const wavePriority = getWavePriority(waveConfig.priority, index)
                            const combined = getCombinedTroops(attackerMeleeTroops, attackerRangeTroops, wavePriority, pluginOptions)
                            const assigned = assignTroops(wave.M.U, combined, Math.min(maxTroopFront, waveRemaining))
                            waveRemaining -= assigned
                        }
                        return
                    }

                    let maxTools = maxToolsFlank
                    if (index == 0) {
                        const wallToolsLimit = Number(pluginOptions.wallTools || 5)
                        const gateToolsLimit = Number(pluginOptions.gateTools || 5)
                        const shieldToolsLimit = Number(pluginOptions.shieldTools || 25)

                        if (fillLeft) {
                            wave.R.T.forEach((unitSlot, i) =>
                                maxTools -= assignUnit(unitSlot, i == 0 ?
                                    attackerWallBerimondTools : attackerShieldBerimondTools, Math.min(maxTools, i == 0 ? wallToolsLimit : shieldToolsLimit)))
                        }

                        maxTools = maxToolsFlank
                        if (fillRight) {
                            wave.L.T.forEach((unitSlot, i) =>
                                maxTools -= assignUnit(unitSlot, i == 0 ?
                                    attackerWallBerimondTools : attackerShieldBerimondTools, Math.min(maxTools, i == 0 ? wallToolsLimit : shieldToolsLimit)))
                        }

                        maxTools = maxToolsFront
                        if (fillMiddle) {
                            wave.M.T.forEach((unitSlot, i) =>
                                maxTools -= assignUnit(unitSlot, i == 0 ? attackerWallBerimondTools :
                                    i == 1 ? attackerGateBerimondTools : attackerShieldBerimondTools, Math.min(maxTools, i == 0 ? wallToolsLimit : i == 1 ? gateToolsLimit : shieldToolsLimit)))
                        }

                        if (fillLeft) {
                            const combined = getCombinedTroops(attackerMeleeTroops, attackerRangeTroops, 'ranged', pluginOptions)
                            const assigned = assignTroops(wave.R.U, combined, Math.min(maxTroopFlank, waveRemaining))
                            waveRemaining -= assigned
                        }
                        if (fillRight) {
                            const combined = getCombinedTroops(attackerMeleeTroops, attackerRangeTroops, 'ranged', pluginOptions)
                            const assigned = assignTroops(wave.L.U, combined, Math.min(maxTroopFlank, waveRemaining))
                            waveRemaining -= assigned
                        }
                        if (fillMiddle) {
                            const combined = getCombinedTroops(attackerMeleeTroops, attackerRangeTroops, 'ranged', pluginOptions)
                            const assigned = assignTroops(wave.M.U, combined, Math.min(maxTroopFront, waveRemaining))
                            waveRemaining -= assigned
                        }
                    }
                    else {
                        if (Number(pluginOptions.chestsMode ?? 2) !== 0) {
                            const selectTool = i => {
                                return attackerBerimondTools
                            }
 
                            if (fillLeft) {
                                wave.R.T.forEach((unitSlot, i) =>
                                    maxTools -= assignUnit(unitSlot, selectTool(0), maxTools))
                            }
                            maxTools = maxToolsFlank
                            if (fillRight) {
                                wave.L.T.forEach((unitSlot, i) =>
                                    maxTools -= assignUnit(unitSlot, selectTool(1), maxTools))
                            }
                            maxTools = maxToolsFront
                            if (fillMiddle) {
                                wave.M.T.forEach((unitSlot, i) =>
                                    maxTools -= assignUnit(unitSlot, selectTool(2), maxTools))
                            }
                        }
 
                        if (fillLeft) {
                            const combined = getCombinedTroops(attackerMeleeTroops, attackerRangeTroops, 'melee', pluginOptions)
                            const assigned = assignTroops(wave.R.U, combined, Math.min(maxTroopFlank, waveRemaining))
                            waveRemaining -= assigned
                        }
                        if (fillRight) {
                            const combined = getCombinedTroops(attackerMeleeTroops, attackerRangeTroops, 'melee', pluginOptions)
                            const assigned = assignTroops(wave.L.U, combined, Math.min(maxTroopFlank, waveRemaining))
                            waveRemaining -= assigned
                        }
                        if (fillMiddle) {
                            const combined = getCombinedTroops(attackerMeleeTroops, attackerRangeTroops, 'melee', pluginOptions)
                            const assigned = assignTroops(wave.M.U, combined, Math.min(maxTroopFront, waveRemaining))
                            waveRemaining -= assigned
                        }
                    }
                })
                let customLimit = Number.parseInt(pluginOptions.customReinforcementLimit)
                let maxTroops = Number.isInteger(customLimit) && customLimit > 0 ? customLimit : getMaxUnitsInReinforcementWave(playerInfo.level, level, true, commanderStats.attackUnitAmountReinforcementBonus, commanderStats.attackUnitAmountReinforcementBoost)
                if (fillCourtyard) {
                    attackInfo.RW.forEach((unitSlot, i) => {
                        let attacker = i & 1 ?
                            (attackerMeleeTroops.length > 0 ? attackerMeleeTroops : attackerRangeTroops) :
                            (attackerRangeTroops.length > 0 ? attackerRangeTroops : attackerMeleeTroops)
 
                        maxTroops -= assignUnit(unitSlot, attacker, maxTroops)
                    })
                }

                await sendXT("cra", JSON.stringify(attackInfo))

                let [obj, result] = await waitForResult("cra", 1000 * 10, (obj, result) => {
                    if (result != 0)
                        return true

                    if (obj.AAM.M.KID != kingdomID || obj.AAM.M.TA[1] != areaInfo.x || obj.AAM.M.TA[2] != areaInfo.y)
                        return false
                    return true
                })
                if (result != 0)
                    throw err[result]
                return obj
            })
            if (!attackInfo) {
                freeCommander(commander.lordID)
                continue
            }



            console.info("hittingTargetAttack", 'C', attackInfo.AAM.UM.L.VIS + 1, ' ', attackInfo.AAM.M.TA[1], ':', attackInfo.AAM.M.TA[2], " ", pretty(Math.round(1000000000 * Math.abs(Math.max(0, attackInfo.AAM.M.TT - attackInfo.AAM.M.PT))), 's'), "tillImpactAttack")
        } catch (e) {
            freeCommander(commander.lordID)
            switch (e) {
                case "NO_MORE_TROOPS":
                    await new Promise(resolve => movementEvents.on("return", function self(/** @type {import("../../protocols.js").ClassTypes.Movement} */ movement) {
                        if (movement.kingdomID != kingdomID || movement.targetAttack.extraData[0] != castle.id)
                            return

                        movementEvents.off("return", self)
                        resolve()
                    }))
                    break
                case "LORD_IS_USED":
                    useCommander(commander.lordID)
                case "ATTACK_TOO_MANY_UNITS":
                case "COOLING_DOWN":
                case "TIMED_OUT":
                case "MISSING_UNITS":
                case "CANT_START_NEW_ARMIES":
                case "NOT_ENOUGH_CURRENCY1":
                    console.debug("attackBerimondInvasion retryable:", e)
                    await new Promise(resolve => setTimeout(resolve, 4000).unref())
                    break
                default:
                    console.error(e)
                    quit = true
            }
        }
    }
})