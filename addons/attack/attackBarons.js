if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            { type: "Label", key: "kingdomsToTarget" },
            {
                type: "Checkbox",
                key: "baronsFirePeaks",
                default: true
            },
            {
                type: "Select",
                key: "baronsFirePeaksPriority",
                selection: ["priority1", "priority2", "priority3", "priority4"],
                default: "0"
            },
            {
                type: "Checkbox",
                key: "baronsBurningSands",
                default: true
            },
            {
                type: "Select",
                key: "baronsBurningSandsPriority",
                selection: ["priority1", "priority2", "priority3", "priority4"],
                default: "1"
            },
            {
                type: "Checkbox",
                key: "baronsEverWinterGlacier",
                default: true
            },
            {
                type: "Select",
                key: "baronsEverWinterGlacierPriority",
                selection: ["priority1", "priority2", "priority3", "priority4"],
                default: "2"
            },
            {
                type: "Checkbox",
                key: "baronsGreatEmpire",
                default: true
            },
            {
                type: "Select",
                key: "baronsGreatEmpirePriority",
                selection: ["priority1", "priority2", "priority3", "priority4"],
                default: "3"
            },
            { type: "Label", key: "horseSettings" },
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
            ...require("../timeSkipsPluginOptions.js"),
            {
                type: "Checkbox",
                key: "upgradeTowers",
                default: false
            },
            {
                type: "Checkbox",
                key: "useWallTools",
                default: true
            },
            {
                type: "Checkbox",
                key: "useShields",
                default: false
            },
            {
                type: "Checkbox",
                key: "buyTools",
                default: false
            },
            {
                type: "Text",
                key: "buyThreshold",
                default: "100"
            },
            {
                type: "Text",
                key: "maxShieldBuyLimit",
                default: "1000"
            },
            {
                type: "Text",
                key: "buyAmount",
                default: "1000"
            },
            {
                type: "Checkbox",
                key: "stopOnNoShields",
                default: false
            },
            {
                type: "Checkbox",
                key: "useDogs",
                default: false
            },
            ...require("./troopTypeOptions.js"),
            { type: "Label", key: "attackSettings" },
            {
                type: "Checkbox",
                key: "attackLeft",
                default: false
            },
            {
                type: "Checkbox",
                key: "attackMiddle",
                default: false
            },
            {
                type: "Checkbox",
                key: "attackRight",
                default: false
            },
            {
                type: "Checkbox",
                key: "attackCourtyard",
                default: false
            },
            {
                type: "Text",
                key: "commanderWhiteList",
                default: "1-99"
            },
            {
                type: "Text",
                key: "attackWaves",
                default: "2"
            }
        ]
    }

const { KingdomID, AreaType } = require("../../protocols.js")
const { botConfig, events } = require("../../ggeBot.js")
const BarronKingdomAttacker = require('./sharedBarronAttackLogic.js')
const { waitForCommanderAvailable, freeCommander } = require("../commander")

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}

events.on("load", async () => {
    const configMap = [
        { id: KingdomID.firePeaks, key: "baronsFirePeaks", priorityKey: "baronsFirePeaksPriority", maxLevel: 71 },
        { id: KingdomID.burningSands, key: "baronsBurningSands", priorityKey: "baronsBurningSandsPriority", maxLevel: 61 },
        { id: KingdomID.everWinterGlacier, key: "baronsEverWinterGlacier", priorityKey: "baronsEverWinterGlacierPriority", maxLevel: 51 },
        { id: KingdomID.greatEmpire, key: "baronsGreatEmpire", priorityKey: "baronsGreatEmpirePriority", maxLevel: 81 }
    ]

    const activeKingdoms = configMap
        .filter(cfg => pluginOptions[cfg.key] !== false)
        .map(cfg => {
            const val = pluginOptions[cfg.priorityKey]
            let priority = 0
            if (val !== undefined && val !== null && !isNaN(val)) {
                priority = Number(val) + 1
            } else {
                priority = cfg.key === "baronsFirePeaks" ? 1 : (cfg.key === "baronsBurningSands" ? 2 : (cfg.key === "baronsEverWinterGlacier" ? 3 : 4))
            }
            return { ...cfg, priority }
        })
        .sort((a, b) => a.priority - b.priority)

    const attackers = []
    for (const k of activeKingdoms) {
        const attacker = new BarronKingdomAttacker(AreaType.barron, k.id, pluginOptions, k.maxLevel)
        await attacker.init()
        attackers.push(attacker)
    }

    if (attackers.length === 0) return

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms).unref())
    const runAttackerLoop = async (attacker, startupDelayMs) => {
        await sleep(startupDelayMs)
        let lastUpdate = Date.now()
        while (true) {
            try {
                if (Date.now() - lastUpdate > 10 * 60 * 1000) {
                    await attacker.updateAreas()
                    lastUpdate = Date.now()
                }
                const target = await attacker.getNextReadyTarget()
                if (target) {
                    const commander = await waitForCommanderAvailable(pluginOptions.commanderWhiteList)
                    const success = await attacker.attackTarget(target, commander)
                    if (!success) {
                        freeCommander(commander.lordID)
                    }

                    const randomDelay = 2000 + Math.random() * 3000
                    await new Promise(resolve => setTimeout(resolve, randomDelay).unref())
                    continue
                } 

                await attacker.updateAreas()
                lastUpdate = Date.now()
                let minWaitTime = 15000
                const timeSinceEpoch = Date.now()
                for (const areaInfo of attacker.areas) {
                    const cooldownRemaining = (areaInfo.timeSinceRequest + areaInfo.extraData[2] * 1000) - timeSinceEpoch
                    if (cooldownRemaining > 0) {
                        minWaitTime = Math.min(minWaitTime, cooldownRemaining)
                    }
                }
                const sleepDuration = Math.max(5000, Math.min(minWaitTime + 2000, 60000))
                await new Promise(resolve => setTimeout(resolve, sleepDuration).unref())
            } catch (errLoop) {
                console.error("[Attack Barons] Loop error in kingdom", attacker.kingdomID, ":", errLoop)
                await sleep(5000)
            }
        }
    }

    for (let i = 0; i < attackers.length; i++) {
        // subtle startup staggering: avoids synchronized bursts across kingdoms
        const startupDelayMs = 900 + i * 850 + Math.floor(Math.random() * 1200)
        runAttackerLoop(attackers[i], startupDelayMs).catch(e => console.error(e))
    }
})
