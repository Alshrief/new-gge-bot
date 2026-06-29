if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            {
                type: "Checkbox",
                key: "eventWallToolsFirst"
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

const pretty = require('pretty-time')
const err = require("../../err.json")
const { spendSkip } = require("../skips.js")
const { movementEvents, AreaType, KingdomID, castles, ClientCommands } = require("../../protocols.js")
const { waitToAttack, getAttackInfo, assignUnit, assignCustomTool, getTotalAmountToolsFlank, getTotalAmountToolsFront, getAmountSoldiersFlank, getAmountSoldiersFront, getMaxUnitsInReinforcementWave, getCombinedTroops, assignTroops, getMaxAttackers, getShieldCount } = require("./attack.js")
const { isTroopResourceTypeAllowed, orderTroopsByTypePreference } = require("./troopTypeFilter.js")
const { waitForCommanderAvailable, freeCommander, useCommander } = require("../commander.js")
const { sendXT, waitForResult, xtHandler, events, playerInfo, botConfig } = require("../../ggeBot.js")

const eventsDifficulties = require("../../items/eventAutoScalingDifficulties.json")
const eventAutoScalingCamps = require("../../items/eventAutoScalingCamps.json")
const nomadCampsClassic = require("../../items/nomadCamps.json")
const ggeConfig = require("../../ggeConfig.json")
const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}

const kingdomID = KingdomID.greatEmpire
const type = AreaType.nomadCamp
const minTroopCount = 100
const eventID = 72
let nomadsPoints = 0

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
let hasInitialScore = false

const scoreShutoff = Number(pluginOptions.scoreShutoff ?? pluginOptions.nomadsScoreShutoff ?? 0) > 0
    ? Number(pluginOptions.scoreShutoff ?? pluginOptions.nomadsScoreShutoff)
    : Infinity

xtHandler.on("pep", obj => {
    if (obj.EID != eventID)
        return
    nomadsPoints = Number(obj.OP[0])
    hasInitialScore = true
    if (scoreShutoff > 0 && nomadsPoints >= scoreShutoff) {
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

    // Use whatever difficulty the server has set (eventDifficulty removed)
    let classic = false
    if ([-1, 0].includes(eventInfo.EDID))
        classic = true

    const castle = castles.find(e => e.kingdomID == kingdomID && e.areaInfo.type == AreaType.mainCastle)

    const areas = (await ClientCommands.getAreaInfo(kingdomID,
        castle.areaInfo.x - 50, castle.areaInfo.y - 50,
        castle.areaInfo.x + 50, castle.areaInfo.y + 50)).areaInfo.filter(ai => ai.type == type)
        .sort((a, b) =>
            (Math.pow(castle.areaInfo.x - a.x, 2) + Math.pow(castle.areaInfo.y - a.y, 2)) -
            (Math.pow(castle.areaInfo.x - b.x, 2) + Math.pow(castle.areaInfo.y - b.y, 2)))
        .sort((a, b) => a.extraData[6] - b.extraData[6])

    quit = false

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

        if (scoreShutoff > 0 && nomadsPoints >= scoreShutoff) {
            console.log("shuttingDownEvent", "scoreReached")
            quit = true
            break
        }
        const commander = await waitForCommanderAvailable(pluginOptions.commanderWhiteList)
        try {
            const attackInfo = await waitToAttack(async () => {
                const areaInfo = areas.shift()
                if (!areaInfo)
                    throw "NO_TARGET"

                areas.push(areaInfo)

                await skipTarget(areaInfo)

                const campInfo = classic ? nomadCampsClassic.find(obj => (areaInfo.extraData[1] + 1) == Number(obj.countVictory)) :
                    eventAutoScalingCamps.find(obj => areaInfo.extraData[5] == obj.eventAutoScalingCampID)

                const level = Number(classic ? (80 + Number(campInfo?.countVictory || 0)) : (campInfo?.camplevel || 0))

                const attackerMeleeTroops = []
                const attackerRangeTroops = []
                const attackerNomadTools = []
                const attackerWallNomadTools = []
                const attackerGateNomadTools = []
                const attackerShieldNomadTools = []
                const attackerWallTools = []
                const attackerShieldTools = []

                const unitInv = castle.unitInventory ?? []
                for (let i = 0; i < unitInv.length; i++) {
                    const unit = unitInv[i]
                    if (unit.amount <= 0)
                        continue

                    if (unit.unitInfo.wodID == 277)
                        continue

                    else if (unit.unitInfo.khanTabletBooster != undefined && unit.unitInfo.ragePointBonus == undefined) {
                        if (unit.unitInfo.gateBonus)
                            attackerGateNomadTools.push(unit)
                        else if (unit.unitInfo.wallBonus)
                            attackerWallNomadTools.push(unit)
                        else if (unit.unitInfo.defRangeBonus)
                            attackerShieldNomadTools.push(unit)
                        else
                            attackerNomadTools.push(unit)
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
                        else if (unit.unitInfo.defRangeBonus)
                            attackerShieldTools.push(unit)
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
                    const totalShields = getShieldCount(unitInv, pluginOptions, [143, 169, 562, 739], pluginOptions.customWaves)
                    if (totalShields < 5) {
                        throw "نقص دروع"
                    }
                }

                attackerNomadTools.sort((a, b) =>
                    Number(b.unitInfo.khanTabletBooster) - Number(a.unitInfo.khanTabletBooster))
                attackerGateNomadTools.sort((a, b) =>
                    Number(b.unitInfo.khanTabletBooster) - Number(a.unitInfo.khanTabletBooster))
                attackerWallNomadTools.sort((a, b) =>
                    Number(b.unitInfo.khanTabletBooster) - Number(a.unitInfo.khanTabletBooster))
                attackerShieldNomadTools.sort((a, b) =>
                    Number(b.unitInfo.khanTabletBooster) - Number(a.unitInfo.khanTabletBooster))

                // Tools sorted highest-booster first (best chests used first)

                attackerWallTools.sort((a, b) =>
                    Number(a.unitInfo.wallBonus) - Number(b.unitInfo.wallBonus))

                attackerShieldTools.sort((a, b) =>
                    Number(a.unitInfo.defRangeBonus) - Number(b.unitInfo.defRangeBonus))

                attackerWallNomadTools.push(...attackerWallTools)
                attackerShieldNomadTools.push(...attackerShieldTools)

                const maxToolsFlank = getTotalAmountToolsFlank(level, 0)
                const maxToolsFront = getTotalAmountToolsFront(level)
                const commanderStats = commander.getEffects(type)
                const attackInfo = getAttackInfo(kingdomID, castle, areaInfo, commander, level, undefined, pluginOptions, commanderStats.additionalWaves)
                const maxTroopFront = getAmountSoldiersFront(level, commanderStats.attackUnitAmountFront, true)
                const maxTroopFlank = getAmountSoldiersFlank(level, commanderStats.attackUnitAmountFlank, true)

                const desiredToolCount = attackerNomadTools.length == 0 ? 40 : 10

                const customWaves = pluginOptions.customWaves
                const useCustom = customWaves && customWaves.waves && (Array.isArray(customWaves.waves) || typeof customWaves.waves === 'object')

                // Flank selection: if none selected or explicitly disabled
                const fillLeft = pluginOptions.attackLeft !== false
                const fillMiddle = pluginOptions.attackMiddle !== false
                const fillRight = pluginOptions.attackRight !== false
                const fillCourtyard = pluginOptions.attackCourtyard !== false
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
                        if (fillLeft) {
                            wave.R.T.forEach((unitSlot, i) =>
                                maxTools -= assignUnit(unitSlot, i == 0 ?
                                    attackerWallNomadTools : attackerShieldNomadTools, Math.min(maxTools / 2, desiredToolCount)))
                        }

                        maxTools = maxToolsFlank
                        if (fillRight) {
                            wave.L.T.forEach((unitSlot, i) =>
                                maxTools -= assignUnit(unitSlot, i == 0 ?
                                    attackerWallNomadTools : attackerShieldNomadTools, Math.min(maxTools / 2, desiredToolCount)))
                        }

                        maxTools = maxToolsFront
                        if (fillMiddle) {
                            wave.M.T.forEach((unitSlot, i) =>
                                maxTools -= assignUnit(unitSlot, i == 0 ? attackerWallNomadTools :
                                    i == 1 ? attackerGateNomadTools : attackerShieldNomadTools, Math.min(maxTools / 3, desiredToolCount)))
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
                        return
                    }
                    {
                        const chestsMode = Number(pluginOptions.chestsMode ?? 2)
                        if (chestsMode !== 0) {
                            if (chestsMode === 1) {
                                attackerNomadTools.sort((a, b) =>
                                    Number(a.unitInfo.khanTabletBooster) - Number(b.unitInfo.khanTabletBooster))
                            } else {
                                attackerNomadTools.sort((a, b) =>
                                    Number(b.unitInfo.khanTabletBooster) - Number(a.unitInfo.khanTabletBooster))
                            }

                            const activeChests = attackerNomadTools.filter(t => Number(t.unitInfo?.khanTabletBooster || 0) > 0)

                            if (fillLeft) {
                                wave.R.T.forEach(unitSlot =>
                                    maxTools -= assignUnit(unitSlot, activeChests, maxTools))
                            }
                            maxTools = maxToolsFlank
                            if (fillRight) {
                                wave.L.T.forEach(unitSlot =>
                                    maxTools -= assignUnit(unitSlot, activeChests, maxTools))
                            }
                            maxTools = maxToolsFront
                            if (fillMiddle) {
                                wave.M.T.forEach(unitSlot =>
                                    maxTools -= assignUnit(unitSlot, activeChests, maxTools))
                            }
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
                    console.debug("attackNomads retryable:", e)
                    break
                default:
                    console.error(e)
                    quit = true
            }
        }
    }
})