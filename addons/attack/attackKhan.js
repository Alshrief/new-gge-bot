if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            {
                type: "Text",
                key: "commanderWhiteList",
                default: "1-99"
            },
            {
                type: "Checkbox",
                key: "eventWallToolsFirst",
                default: false
            },
            {
                type: "Checkbox",
                key: "useKhanRageTool",
                default: true
            },
            {
                type: "Checkbox",
                key: "disableKhanProvocation",
                default: false
            },
            {
                type: "Select",
                key: "khanRagePriority",
                selection: [
                    "Highest rage first",
                    "Lowest rage first"
                ],
                default: "0"
            },
            {
                type: "Select",
                key: "khanRageToolMode",
                selection: [
                    "All rage tools",
                    "Rage flags only",
                    "Rage+tablet tools only"
                ],
                default: "0"
            },
            {
                type: "Text",
                key: "khanRageMaxUsage",
                default: "0"
            },
            {
                type: "Text",
                key: "khanRageMaxPerHit",
                default: "0"
            },
            {
                type: "Checkbox",
                key: "useFeather",
                default: false
            },
            {
                type: "Checkbox",
                key: "useCoin",
                default: true
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
            ...require("./troopTypeOptions.js"),
            {
                type: "Text",
                key: "scoreShutoff",
                default: "881100"
            },
            {
                type: "Text",
                key: "customReinforcementLimit",
                default: ""
            },
            {
                type: "Text",
                key: "khanProvocationsPerTarget",
                default: "5"
            },
            {
                type: "Text",
                key: "khanHitsPerProvocation",
                default: "2"
            },
            {
                type: "Text",
                key: "khanCycleWaitTimeoutMinutes",
                default: "15"
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

const err = require("../../err.json")
const { spendSkip } = require("../skips.js")
const { movementEvents, castles, AreaType, KingdomID, ClientCommands } = require("../../protocols.js")
const { waitToAttack, getAttackInfo, assignUnit, assignCustomTool, getTotalAmountToolsFlank, getTotalAmountToolsFront, getAmountSoldiersFlank, getAmountSoldiersFront, getMaxUnitsInReinforcementWave, getCombinedTroops, assignTroops, getMaxAttackers, getShieldCount } = require("./attack.js")
const { isTroopResourceTypeAllowed, orderTroopsByTypePreference } = require("./troopTypeFilter.js")
const { waitForCommanderAvailable, freeCommander, useCommander } = require("../commander.js")
const { sendXT, waitForResult, xtHandler, events, playerInfo, botConfig } = require("../../ggeBot.js")

const eventsDifficulties = require("../../items/eventAutoScalingDifficulties.json")
const nomadCampsClassic = require("../../items/nomadCamps.json")
const ggeConfig = require("../../ggeConfig.json")

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}
const eventAutoScalingCamps = require("../../items/eventAutoScalingCamps.json")
const pretty = require('pretty-time')

const kingdomID = KingdomID.greatEmpire
const type = AreaType.khanCamp
const minTroopCount = 100
const eventID = 72
const troopBlackList = [277, 34, 35]
const useKhanRageTool = pluginOptions.useKhanRageTool !== false
const disableKhanProvocation = pluginOptions.disableKhanProvocation === true
const khanRagePriority = Number(pluginOptions.khanRagePriority ?? 0)
const khanRageToolMode = Number(pluginOptions.khanRageToolMode ?? 0)
const khanRageMaxUsage = Number(pluginOptions.khanRageMaxUsage ?? 0)
const khanRageMaxPerHit = Number(pluginOptions.khanRageMaxPerHit ?? 0)

let campRageNeeded = NaN
let usedKhanRageTools = 0
let currentKhanCampID = undefined
let khanProvocationsUsedForCurrentTarget = 0
let khanProvocationLimitReached = false
const khanProvocationsPerTarget = Number(pluginOptions.khanProvocationsPerTarget ?? 5)
let khanProvocationsPerTargetDynamic = khanProvocationsPerTarget
let activeKhanAttacks = 0
const khanHitsPerProvocation = Number(pluginOptions.khanHitsPerProvocation ?? 2)
let khanHitsPerProvocationDynamic = khanHitsPerProvocation
let khanAttackCycleHits = 0
let khanAttackCycleLimitReached = false
const khanCycleWaitTimeoutMinutes = Number(pluginOptions.khanCycleWaitTimeoutMinutes ?? 15)

const getAdditionalProvocationsByRemainingScore = remainingScore => {
    if (!Number.isFinite(remainingScore) || remainingScore <= 0)
        return 0
    // 100k => 2 provocations, 200k => 3, 300k => 4 ... up to 10
    return Math.max(2, Math.min(10, Math.ceil(remainingScore / 100000) + 1))
}

const getRecoveryCycleByRemainingScore = remainingScore => {
    if (!Number.isFinite(remainingScore) || remainingScore <= 0)
        return { provocations: 0, hitsPerProvocation: 0 }
    // Small remaining score: try one provocation and re-check to avoid overfarming.
    if (remainingScore <= 50000)
        return { provocations: 1, hitsPerProvocation: 1 }
    if (remainingScore <= 100000)
        return { provocations: 2, hitsPerProvocation: 1 }
    if (remainingScore <= 200000)
        return { provocations: 2, hitsPerProvocation: 2 }
    if (remainingScore <= 300000)
        return { provocations: 3, hitsPerProvocation: 2 }
    return { provocations: Math.max(3, Math.min(10, Math.ceil(remainingScore / 100000) + 1)), hitsPerProvocation: 2 }
}

const sumAmounts = units => units.reduce((sum, unit) => sum + Number(unit.amount ?? 0), 0)

const capUnitsByAmount = (units, maxTotalAmount) => {
    if (!Number.isFinite(maxTotalAmount) || maxTotalAmount < 0)
        return units

    let remaining = Math.floor(maxTotalAmount)
    if (remaining <= 0)
        return []

    const result = []
    for (const unit of units) {
        if (remaining <= 0)
            break

        const amount = Math.min(Number(unit.amount ?? 0), remaining)
        if (amount <= 0)
            continue

        result.push({
            ...unit,
            amount
        })
        remaining -= amount
    }
    return result
}

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

movementEvents.on("outgoing", async (/** @type {import("../../protocols.js").ClassTypes.Movement} */ movement) => {
    if (movement.owner?.ownerID != playerInfo.playerID)
        return

    if (movement.targetAttack.type != type)
        return
    activeKhanAttacks += 1

    const newCampID = movement.targetAttack.extraData[6]
    const campInfo = eventAutoScalingCamps.find(campInfo =>
        campInfo.eventAutoScalingCampID == newCampID)
    campRageNeeded = campInfo ? campInfo.playerRageCap : NaN
    if (currentKhanCampID !== newCampID) {
        currentKhanCampID = newCampID
        khanProvocationsUsedForCurrentTarget = 0
        khanProvocationLimitReached = false
        khanAttackCycleHits = 0
        khanAttackCycleLimitReached = false
        khanProvocationsPerTargetDynamic = khanProvocationsPerTarget
        khanHitsPerProvocationDynamic = khanHitsPerProvocation
    }
})

movementEvents.on("returning", (/** @type {import("../../protocols.js").ClassTypes.Movement} */ movement) => {
    if (movement.owner?.ownerID != playerInfo.playerID)
        return

    if (movement.sourceAttack.type != type)
        return
    activeKhanAttacks = Math.max(0, activeKhanAttacks - 1)

    const newCampID = movement.sourceAttack.extraData[6]
    const campInfo = eventAutoScalingCamps.find(campInfo =>
        campInfo.eventAutoScalingCampID == newCampID)
    campRageNeeded = campInfo ? campInfo.playerRageCap : NaN
    if (currentKhanCampID !== newCampID) {
        currentKhanCampID = newCampID
        khanProvocationsUsedForCurrentTarget = 0
        khanProvocationLimitReached = false
        khanAttackCycleHits = 0
        khanAttackCycleLimitReached = false
        khanProvocationsPerTargetDynamic = khanProvocationsPerTarget
        khanHitsPerProvocationDynamic = khanHitsPerProvocation
    }
    skipTarget(movement.sourceAttack)
})

xtHandler.on("rpr", ({ EID, PCRP: rage }) => {
    if (EID != eventID)
        return

    if (rage >= campRageNeeded) {
        if (rage > campRageNeeded)
            console.warn("rageTooHigh")

        if (disableKhanProvocation) {
            return
        }

        if (khanProvocationsPerTargetDynamic > 0 && khanProvocationsUsedForCurrentTarget >= khanProvocationsPerTargetDynamic) {
            khanProvocationLimitReached = true
            console.info("khanProvocationLimitReached")
            return
        }

        console.info("rageTrigger")
        sendXT("lta", JSON.stringify({ AV: 0, EID: eventID }))
        khanProvocationsUsedForCurrentTarget += 1
    }
})
let nomadsPoints = 0
let quit = false
let hasInitialKhanScore = false

xtHandler.on("pep", ({ EID, OP }) => {
    if (EID != eventID)
        return

    nomadsPoints = Number(OP[0])
    hasInitialKhanScore = true

    if (quit)
        return

    const scoreShutoff = Number(pluginOptions.scoreShutoff ?? pluginOptions.nomadsScoreShutoff ?? Infinity)
    if (scoreShutoff > 0 && nomadsPoints >= scoreShutoff) {
        console.log("shuttingDownEvent", "scoreReached")
        quit = true
    }
})
events.on("eventStop", ({ EID }) => {
    if (EID != eventID)
        return

    if (quit)
        return

    console.log("shuttingDownEvent", "eventEnded")
    quit = true
})
events.on("eventStart", async ({ EID, EDID }) => {
    if (EID != eventID)
        return

    // Use whatever difficulty the server has set (eventDifficulty removed)
    let classic = false

    if ([-1, 0].includes(EDID))
        classic = true

    const castle = castles.find(e => e.kingdomID == kingdomID && e.areaInfo.type == AreaType.mainCastle)

    quit = false
    hasInitialKhanScore = false
    usedKhanRageTools = 0
    khanProvocationsUsedForCurrentTarget = 0
    khanProvocationLimitReached = false
    khanProvocationsPerTargetDynamic = khanProvocationsPerTarget
    khanHitsPerProvocationDynamic = khanHitsPerProvocation
    khanAttackCycleHits = 0
    khanAttackCycleLimitReached = false

    const { areaInfo } = await ClientCommands.getNextMapObject(type, kingdomID)
    if (!areaInfo) {
        console.warn("[Attack Khan] No target found for Khan Camp!")
        return
    }

    while (!quit) {
        // Prevent overshooting after login/restart: wait for first event score sync.
        if (!hasInitialKhanScore) {
            await sendXT("pep", JSON.stringify({ EID: eventID }))
            await new Promise(resolve => {
                const onPep = ({ EID }) => {
                    if (EID != eventID)
                        return
                    cleanup()
                }
                const onStop = ({ EID }) => {
                    if (EID != eventID)
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
            const scoreShutoff = Number(pluginOptions.scoreShutoff ?? pluginOptions.nomadsScoreShutoff ?? Infinity)
            if (Number.isFinite(scoreShutoff) && scoreShutoff > 0 && nomadsPoints >= scoreShutoff) {
                console.log("shuttingDownEvent", "scoreReached")
                quit = true
                continue
            }
        }

        if (khanProvocationLimitReached || khanAttackCycleLimitReached) {
            const waitTimeoutMs = (Number.isFinite(khanCycleWaitTimeoutMinutes) && khanCycleWaitTimeoutMinutes > 0 ? khanCycleWaitTimeoutMinutes : 15) * 60 * 1000
            const waitResult = await new Promise(resolve => {
                const timeout = setTimeout(() => {
                    movementEvents.off("returning", checkDone)
                    resolve("timeout")
                }, waitTimeoutMs)

                const checkDone = () => {
                    if (activeKhanAttacks <= 0) {
                        clearTimeout(timeout)
                        movementEvents.off("returning", checkDone)
                        resolve("returned")
                    }
                }
                checkDone()
                movementEvents.on("returning", checkDone)
            })
            if (waitResult === "timeout")
                activeKhanAttacks = 0

            const scoreShutoff = Number(pluginOptions.scoreShutoff ?? pluginOptions.nomadsScoreShutoff ?? Infinity)
            if (Number.isFinite(scoreShutoff) && scoreShutoff > 0) {
                const remainingScore = Math.max(0, scoreShutoff - nomadsPoints)
                if (remainingScore <= 0) {
                    console.log("shuttingDownEvent", "scoreReached")
                    quit = true
                    continue
                }
                const recovery = getRecoveryCycleByRemainingScore(remainingScore)
                khanProvocationsPerTargetDynamic = recovery.provocations
                khanHitsPerProvocationDynamic = recovery.hitsPerProvocation
            } else {
                khanProvocationsPerTargetDynamic = khanProvocationsPerTarget
                khanHitsPerProvocationDynamic = khanHitsPerProvocation
            }

            khanProvocationLimitReached = false
            khanProvocationsUsedForCurrentTarget = 0
            khanAttackCycleLimitReached = false
            khanAttackCycleHits = 0
            continue
        }

        const commander = await waitForCommanderAvailable(pluginOptions.commanderWhiteList)
        try {
            const attackInfo = await waitToAttack(async () => {
                await skipTarget(areaInfo)

                const campInfo = classic ? nomadCampsClassic.find(obj => (areaInfo.extraData[1] + 1) == Number(obj.countVictory)) :
                    eventAutoScalingCamps.find(obj => areaInfo.extraData[6] == obj.eventAutoScalingCampID)

                const level = Number(classic ? (80 + Number(campInfo?.countVictory || 0)) : (campInfo?.camplevel || 0))

                const attackerMeleeTroops = []
                const attackerRangeTroops = []
                const attackerBannerKhanTools = []
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

                    if (unit.unitInfo.ragePointBonus != undefined) {
                        if (!useKhanRageTool)
                            continue

                        const isRageAndTabletTool = unit.unitInfo.khanTabletBooster != undefined
                        // Mode 1 => rage flags only (exclude mixed rage+tablet tools)
                        if (khanRageToolMode === 1 && isRageAndTabletTool)
                            continue
                        // Mode 2 => rage+tablet tools only
                        if (khanRageToolMode === 2 && !isRageAndTabletTool)
                            continue
                        attackerBannerKhanTools.push(unit)
                    }
                    else if (unit.unitInfo.khanTabletBooster != undefined) {
                        // Mode 1/2 are strict rage modes; never allow pure tablet/chest tools.
                        if (khanRageToolMode === 1 || khanRageToolMode === 2)
                            continue

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
                        if (troopBlackList.includes(unit.unitInfo.wodID))
                            continue
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
                attackerBannerKhanTools.sort((a, b) =>
                    Number(b.unitInfo.ragePointBonus + Number(b.unitInfo.khanTabletBooster ?? 0)) -
                    Number(a.unitInfo.ragePointBonus + Number(a.unitInfo.khanTabletBooster ?? 0)))
                if (khanRagePriority === 1)
                    attackerBannerKhanTools.reverse()

                if (khanRageMaxUsage > 0) {
                    const remainingRageTools = Math.max(0, khanRageMaxUsage - usedKhanRageTools)
                    const cappedRageTools = capUnitsByAmount(attackerBannerKhanTools, remainingRageTools)
                    attackerBannerKhanTools.length = 0
                    attackerBannerKhanTools.push(...cappedRageTools)
                }
                if (khanRageMaxPerHit > 0) {
                    const cappedRageToolsPerHit = capUnitsByAmount(attackerBannerKhanTools, khanRageMaxPerHit)
                    attackerBannerKhanTools.length = 0
                    attackerBannerKhanTools.push(...cappedRageToolsPerHit)
                }

                attackerNomadTools.sort((a, b) =>
                    Number(b.unitInfo.khanTabletBooster ?? 0) - Number(a.unitInfo.khanTabletBooster ?? 0))
                attackerGateNomadTools.sort((a, b) =>
                    Number(b.unitInfo.khanTabletBooster ?? 0) - Number(a.unitInfo.khanTabletBooster ?? 0))
                attackerWallNomadTools.sort((a, b) =>
                    Number(b.unitInfo.khanTabletBooster ?? 0) - Number(a.unitInfo.khanTabletBooster ?? 0))
                attackerShieldNomadTools.sort((a, b) =>
                    Number(b.unitInfo.khanTabletBooster ?? 0) - Number(a.unitInfo.khanTabletBooster ?? 0))

                // Tools sorted highest-booster first (best chests used first)

                attackerWallTools.sort((a, b) =>
                    Number(a.unitInfo.wallBonus) - Number(b.unitInfo.wallBonus))

                attackerShieldTools.sort((a, b) =>
                    Number(a.unitInfo.defRangeBonus) - Number(b.unitInfo.defRangeBonus))

                attackerWallNomadTools.push(...attackerWallTools)
                attackerShieldNomadTools.push(...attackerShieldTools)

                const commanderStats = commander.getEffects(type)
                const attackInfo = getAttackInfo(kingdomID, castle, areaInfo, commander, level, undefined, pluginOptions, commanderStats.additionalWaves)
                const maxToolsFlank = getTotalAmountToolsFlank(level, 0)
                const maxToolsFront = getTotalAmountToolsFront(level)
                const maxTroopFront = getAmountSoldiersFront(level, commanderStats.attackUnitAmountFront, true)
                const maxTroopFlank = getAmountSoldiersFlank(level, commanderStats.attackUnitAmountFlank, true)
                const desiredToolCount = attackerNomadTools.length == 0 || (!attackerNomadTools[0]?.unitInfo?.khanTabletBooster && !attackerNomadTools[0]?.unitInfo?.ragePointBonus) ? 20 : 10

                const customWaves = pluginOptions.customWaves
                const useCustom = customWaves && customWaves.waves && (Array.isArray(customWaves.waves) || typeof customWaves.waves === 'object')

                // Flank selection: if none selected or explicitly disabled
                const fillLeft   = pluginOptions.attackLeft !== false
                const fillMiddle = pluginOptions.attackMiddle !== false
                const fillRight  = pluginOptions.attackRight !== false
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
                                    attackerWallNomadTools : attackerShieldNomadTools, Math.min(maxTools, desiredToolCount)))
                        }
 
                        maxTools = maxToolsFlank
                        if (fillRight) {
                            wave.L.T.forEach((unitSlot, i) =>
                                maxTools -= assignUnit(unitSlot, i == 0 ?
                                    attackerWallNomadTools : attackerShieldNomadTools, Math.min(maxTools, desiredToolCount)))
                        }
 
                        maxTools = maxToolsFront
                        if (fillMiddle) {
                            wave.M.T.forEach((unitSlot, i) =>
                                maxTools -= assignUnit(unitSlot, i == 0 ? attackerWallNomadTools :
                                    i == 1 ? attackerGateNomadTools : attackerShieldNomadTools, Math.min(maxTools, desiredToolCount)))
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
                        const selectSpecialTool = i => {
                            let tools = attackerBannerKhanTools
                            if (tools.length == 0 || (!tools[0]?.unitInfo?.khanTabletBooster && !tools[0]?.unitInfo?.ragePointBonus)) {
                                tools = attackerNomadTools
                                if (tools.length == 0 || (!tools[0]?.unitInfo?.khanTabletBooster && !tools[0]?.unitInfo?.ragePointBonus)) {
                                    if (i == 0) {
                                        tools = attackerWallNomadTools
                                        if (tools.length == 0 || (!tools[0]?.unitInfo?.khanTabletBooster && !tools[0]?.unitInfo?.ragePointBonus))
                                            tools = attackerShieldNomadTools
                                    }
                                    else if (i == 1) {
                                        tools = attackerShieldNomadTools
                                        if (tools.length == 0 || (!tools[0]?.unitInfo?.khanTabletBooster && !tools[0]?.unitInfo?.ragePointBonus))
                                            tools = attackerWallNomadTools
                                    }
                                    if (i == 2) {
                                        tools = attackerGateNomadTools
                                        if (tools.length == 0 || (!tools[0]?.unitInfo?.khanTabletBooster && !tools[0]?.unitInfo?.ragePointBonus))
                                            tools = attackerWallNomadTools
                                        if (tools.length == 0 || (!tools[0]?.unitInfo?.khanTabletBooster && !tools[0]?.unitInfo?.ragePointBonus))
                                            tools = attackerShieldNomadTools
                                    }
                                }
                            }
                            if (!tools[0]?.unitInfo?.khanTabletBooster && !tools[0]?.unitInfo?.ragePointBonus)
                                tools = []
                            return tools
                        }
 
                        const selectNormalTool = i => {
                            if (i == 0)
                                return attackerWallTools.length > 0 ? attackerWallTools : attackerShieldTools
                            if (i == 1)
                                return attackerShieldTools.length > 0 ? attackerShieldTools : attackerWallTools
                            return attackerWallTools.length > 0 ? attackerWallTools : attackerShieldTools
                        }
 
                        const selectTool = i => selectSpecialTool(i)
 
                        if (fillLeft) {
                            wave.R.T.forEach(unitSlot => {
                                maxTools -= assignUnit(unitSlot, selectTool(0), maxTools)
                            })
                        }
                        maxTools = maxToolsFlank
                        if (fillRight) {
                            wave.L.T.forEach(unitSlot => {
                                maxTools -= assignUnit(unitSlot, selectTool(1), maxTools)
                            })
                        }
                        maxTools = maxToolsFront
                        if (fillMiddle) {
                            wave.M.T.forEach(unitSlot => {
                                maxTools -= assignUnit(unitSlot, selectTool(2), maxTools)
                            })
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

                const rageToolsBeforeAttack = sumAmounts(attackerBannerKhanTools)
 
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

                const rageToolsAfterAttack = sumAmounts(attackerBannerKhanTools)
                const usedThisAttack = Math.max(0, rageToolsBeforeAttack - rageToolsAfterAttack)
                usedKhanRageTools += usedThisAttack
                khanAttackCycleHits += 1
                const maxHitsPerCycle = Math.max(1, khanProvocationsPerTargetDynamic) * Math.max(1, khanHitsPerProvocationDynamic)
                if (khanAttackCycleHits >= maxHitsPerCycle)
                    khanAttackCycleLimitReached = true

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
                        if (movement.kingdomID != kingdomID || movement.targetAttack.extraData[0] != castle.areaInfo.id)
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
                    console.debug("attackKhan retryable:", e)
                    break
                default:
                    console.error(e)
                    quit = true
            }
        }
    }
})
