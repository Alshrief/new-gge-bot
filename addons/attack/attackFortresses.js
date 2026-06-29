if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            { type: "Label", key: "kingdomsToTarget" },
            {
                type: "Checkbox",
                key: "fortressesFirePeaks",
                default: true
            },
            {
                type: "Select",
                key: "fortressesFirePeaksPriority",
                selection: ["priority1", "priority2", "priority3"],
                default: "0"
            },
            {
                type: "Checkbox",
                key: "fortressesBurningSands",
                default: true
            },
            {
                type: "Select",
                key: "fortressesBurningSandsPriority",
                selection: ["priority1", "priority2", "priority3"],
                default: "1"
            },
            {
                type: "Checkbox",
                key: "fortressesEverWinterGlacier",
                default: true
            },
            {
                type: "Select",
                key: "fortressesEverWinterGlacierPriority",
                selection: ["priority1", "priority2", "priority3"],
                default: "2"
            },
            {
                type: "Text",
                key: "commanderWhiteList",
                default: "1-99"
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
            ...require("./troopTypeOptions.js"),
        ]
    }

const { KingdomID } = require("../../protocols.js")
const { botConfig, events } = require('../../ggeBot.js')
const FortressKingdomAttacker = require('./sharedFortressAttackLogic.js')
const { waitForCommanderAvailable, freeCommander } = require("../commander")

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}

events.on("load", async () => {
    const configMap = [
        { id: KingdomID.firePeaks, key: "fortressesFirePeaks", priorityKey: "fortressesFirePeaksPriority", level: 51 },
        { id: KingdomID.burningSands, key: "fortressesBurningSands", priorityKey: "fortressesBurningSandsPriority", level: 44 },
        { id: KingdomID.everWinterGlacier, key: "fortressesEverWinterGlacier", priorityKey: "fortressesEverWinterGlacierPriority", level: 20 }
    ]

    const activeKingdoms = configMap
        .filter(cfg => pluginOptions[cfg.key] !== false)
        .map(cfg => {
            const val = pluginOptions[cfg.priorityKey]
            let priority = 0
            if (val !== undefined && val !== null && !isNaN(val)) {
                priority = Number(val) + 1
            } else {
                priority = cfg.key === "fortressesFirePeaks" ? 1 : (cfg.key === "fortressesBurningSands" ? 2 : 3)
            }
            return { ...cfg, priority }
        })
        .sort((a, b) => a.priority - b.priority)

    const attackers = []
    for (const k of activeKingdoms) {
        const attacker = new FortressKingdomAttacker(k.id, k.level, pluginOptions)
        await attacker.init()
        attackers.push(attacker)
    }

    if (attackers.length === 0) return

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms).unref())
    const runAttackerLoop = async (attacker, startupDelayMs) => {
        await sleep(startupDelayMs)
        while (true) {
            try {
                const target = await attacker.getNextReadyTarget()
                if (target) {
                    const commander = await waitForCommanderAvailable(pluginOptions.commanderWhiteList,
                        undefined,
                        (a, b) => b.getEffects().speedBonus - a.getEffects().speedBonus)
                    const success = await attacker.attackTarget(target, commander)
                    if (!success) {
                        freeCommander(commander.lordID)
                    }

                    const randomDelay = 2000 + Math.random() * 3000
                    await new Promise(resolve => setTimeout(resolve, randomDelay).unref())
                    continue
                } 

                await attacker.updateAreas()
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
                console.error("[Attack Fortresses] Loop error in kingdom", attacker.kingdomID, ":", errLoop)
                await sleep(5000)
            }
        }
    }

    for (let i = 0; i < attackers.length; i++) {
        // subtle startup staggering: avoids synchronized bursts across kingdoms
        const startupDelayMs = 1200 + i * 900 + Math.floor(Math.random() * 1400)
        runAttackerLoop(attackers[i], startupDelayMs).catch(e => console.error(e))
    }
})
