if (require('node:worker_threads').isMainThread) {
    return module.exports = {
        force: true,
        pluginOptions: [
            {
                type: "Text",
                key: "attackDelaySeconds",
                default: "4.5"
            },
            {
                type: "Text",
                key: "attackDelayRandomizationSeconds",
                default: "2.5"
            },
            {
                type: "Text",
                key: "baronAttackDelaySeconds",
                default: "4"
            },
            {
                type: "Text",
                key: "baronAttackDelayRandomizationSeconds",
                default: "2"
            },
            {
                type: "Text",
                key: "attackLimit"
            },
            {
                type: "Text",
                key: "globalAttackGapSeconds",
                default: "2"
            }
        ]
    }
}

const { RateLimiter } = require('limiter')
const { resources } = require('../../protocols')
const { botConfig, playerInfo, xtHandler, sendXT, waitForResult } = require('../../ggeBot')
const stables = require('../../items/horses.json')

const getTotalAmountTools = (e, t, n) =>
    1 === e ? t < 11 ? 10 :
        t < 37 ? 20 :
            t < 50 ? 30 :
                t < 69 ? 40 : 50 : //TODO: WTF
        t < 37 ? 10 :
            t < 50 ? 20 :
                t < 69 ? 30 : 0 | Math.ceil(40 + n)

const getTotalAmountToolsFlank = (e, t) => getTotalAmountTools(0, e, 0 | t)
const getTotalAmountToolsFront = e => getTotalAmountTools(1, e, 0)

const getMaxAttackers = (targetLevel, isEventTarget) => {
    if (isEventTarget) {
        if (targetLevel >= 70) return 320
        if (targetLevel >= 60) return 250
        if (targetLevel >= 50) return 220
        if (targetLevel >= 40) return 180
        return 150
    }
    return targetLevel <= 69 ? Math.min(260, 5 * targetLevel + 8) : 320
}
const getAmountSoldiersFlank = (level, multiplier, isEventTarget) => {
    const mult = (0 | multiplier)
    return Math.ceil(.2 * getMaxAttackers(level, isEventTarget) * (1 + mult / 100))
}
const getAmountSoldiersFront = (level, multiplier, isEventTarget) => {
    const mult = (0 | multiplier)
    return Math.ceil((getMaxAttackers(level, isEventTarget) - 2 * getAmountSoldiersFlank(level, undefined, isEventTarget)) * (1 + mult / 100))
}
const getMaxUnitsInReinforcementWave = (playerLevel, targetLevel, isEventTarget, additionalUnits, additionalUnitsMultiplyer) => {
    if (isEventTarget) {
        const playerBase = playerLevel >= 70 ? 1800 : (playerLevel >= 60 ? 1500 : (playerLevel >= 50 ? 1200 : 1000))
        const targetBase = targetLevel >= 70 ? 1800 : (targetLevel >= 60 ? 1500 : (targetLevel >= 50 ? 1200 : 1000))
        const base = Math.min(playerBase, targetBase)
        return Math.round((base + (0 | additionalUnits)) * (1 + (0 | additionalUnitsMultiplyer) / 100))
    }
    return Math.round((20 * Math.sqrt(Math.min(playerLevel, 70)) + 50 + (0 | additionalUnits)) *
        (1 + (0 | additionalUnitsMultiplyer) / 100))
}

function getMaxWaveCount(e) {
    const waveUnlockLevelList = [0, 13, 26, 51]
    let n = 1
    for (let i = waveUnlockLevelList.length - 1; i >= 0; i--) {
        if (e < waveUnlockLevelList[i])
            continue
        n = i + 1
        break
    }
    return n
}

function assignUnit(unitSlot, units, maxUnits) {
    let unit = units.find(e => e.amount > 0)
    if (!unit)
        return 0

    const unitAmount = Math.floor(Math.max(Math.min(unit.amount, maxUnits), 0))

    unit.amount -= unitAmount

    if (unit.amount <= 0)
        units.shift()

    if (unitAmount > 0) {
        unitSlot[0] = unit.unitInfo.wodID
        unitSlot[1] = unitAmount
    }

    return unitAmount
}
function getAttackInfo(kid, castle, AI, commander, level, waves, options, additionalWaves) {
    if (isNaN(level) || level <= 0) {
        level = 1
    }
    const attackTarget = {
        SX: castle.areaInfo.x,
        SY: castle.areaInfo.y,
        TX: AI.x,
        TY: AI.y,
        KID: kid,
        LID: commander.lordID,
        WT: 0,
        HBW: -1,
        BPC: 0,
        ATT: 0,
        AV: 0,
        LP: 0,
        FC: 0,
        PTT: 0,
        SD: 0,
        ICA: 0,
        CD: 99,
        A: [],
        BKS: [],
        AST: [
            -1,
            -1,
            -1
        ],
        RW: [ //TODO: SET THIS UP PROPERLY
            [
                -1,
                0
            ],
            [
                -1,
                0
            ],
            [
                -1,
                0
            ],
            [
                -1,
                0
            ],
            [
                -1,
                0
            ],
            [
                -1,
                0
            ],
            [
                -1,
                0
            ],
            [
                -1,
                0
            ]
        ],
        ASCT: (attackCount !== undefined && attackCount >= (attackThreshold ?? 3500)) ? 1 : 0
    }

    if (isNaN(waves) || waves <= 0)
        waves = Infinity

    waves = Math.max(Math.min(waves, getMaxWaveCount(playerInfo.level) + (0 | additionalWaves)), 1)

    for (let i = 0; i < waves; i++) {
        const wave = {
            L: {
                T: [],
                U: []
            },
            R: {
                T: [],
                U: []
            },
            M: {
                T: [],
                U: []
            }
        }
        const setupWave = (wallLevelRequirement, row) =>
            wallLevelRequirement.every(e =>
                e <= level ? row.push([-1, 0]) : false)

        setupWave([0, 37], wave.L.T)
        setupWave([0, 13], wave.L.U)
        setupWave([0, 11, 37], wave.M.T)
        setupWave([0, 0, 13, 13, 26, 26], wave.M.U)
        setupWave([0, 37], wave.R.T)
        setupWave([0, 13], wave.R.U)
        attackTarget.A.push(wave)
    }
    const unlockedHorses = castle.unlockedHorses

    if (options.useCoin && !options.useFeather && resources.coins >= 20000) {
        let bestHorse = -1
        let minSpeed = Infinity

        unlockedHorses?.forEach(e => {
            let horse = stables.find(a => e == a.wodID)
            if (horse && Number(horse.costFactorC1) > 0 && Number(horse.costFactorC2) == 0) {
                if (Number(horse.unitBoost) < minSpeed) {
                    minSpeed = Number(horse.unitBoost)
                    bestHorse = e
                }
            }
        })

        if (bestHorse != -1) {
            attackTarget.HBW = bestHorse
            attackTarget.PTT = 0
        } else {
            console.debug("noStablesCoinHorse")
            attackTarget.HBW = -1
            attackTarget.PTT = 0
        }
    }
    else {
        attackTarget.HBW = -1
        if (resources.pegasusTicket > 0) {
            attackTarget.PTT = options.useFeather ? 1 : 0
        } else {
            console.warn("Ran out of fast feathers.")
            attackTarget.PTT = 0
        }
    }

    return attackTarget
}

function boxMullerRandom(min, max, skew) {
    let u = 0, v = 0
    while (u === 0) u = Math.random()
    while (v === 0) v = Math.random()
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)

    num = num / 10.0 + 0.5
    if (num > 1 || num < 0) num = boxMullerRandom(min, max, skew)
    num = Math.pow(num, skew)
    num *= max - min
    num += min
    return num
}

const sleep = ms => new Promise(r => setTimeout(r, ms).unref())

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}
const attacks = []
let alreadyRunning = false
let attackCount = undefined
let attackThreshold = undefined
let lastAttackCountRefreshAt = 0
let attackCountDayKey = undefined

const parseFiniteNumber = value => {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

const getEgyptAttackDayKey = (date = new Date()) => {
    const getPart = (sourceDate, type) =>
        new Intl.DateTimeFormat("en-CA", {
            timeZone: "Africa/Cairo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            hour12: false
        }).formatToParts(sourceDate).find(part => part.type === type)?.value

    const cairoHour = Number(getPart(date, "hour"))
    const attackDayDate = cairoHour < 1 ? new Date(date.getTime() - 24 * 60 * 60 * 1000) : date
    return `${getPart(attackDayDate, "year")}-${getPart(attackDayDate, "month")}-${getPart(attackDayDate, "day")}`
}

const getDailyAttackLimit = () => {
    // يفضل حد المستخدم المحدد أولاً، ثم حد السيرفر، ثم الافتراضي.
    // ملاحظة: إذا حدد المستخدم قيمة أعلى من حد السيرفر (ACTH)، البوت يكمل الهجوم
    // لأن السيرفر لا يمنع الهجمات بعد حده، فقط يرفع التكلفة.
    const configuredLimit = [
        pluginOptions.maxDailyAttackCount,
        pluginOptions.attackLimit,
        ...Object.values(botConfig.plugins ?? {}).flatMap(plugin => [
            plugin?.maxDailyAttackCount,
            plugin?.attackLimit
        ])
    ].find(value => value !== undefined && value !== null && String(value).trim() !== "")

    const parsedConfiguredLimit = parseFiniteNumber(configuredLimit)
    if (parsedConfiguredLimit !== undefined)
        return parsedConfiguredLimit

    // لو المستخدم ما حددش ليميت، استخدم حد السيرفر كـ fallback
    const parsedServerLimit = parseFiniteNumber(attackThreshold)
    if (parsedServerLimit !== undefined)
        return parsedServerLimit

    return 10000
}

xtHandler.on("gai", obj => {
    attackCount = Number(obj.AC ?? 0)
    attackThreshold = obj.ACTH
    lastAttackCountRefreshAt = Date.now()
    attackCountDayKey = getEgyptAttackDayKey()
})

const refreshAttackCount = async () => {
    const currentAttackDayKey = getEgyptAttackDayKey()
    if (attackCountDayKey !== undefined && attackCountDayKey !== currentAttackDayKey) {
        attackCount = 0
        attackCountDayKey = currentAttackDayKey
        lastAttackCountRefreshAt = 0
        announced = false
    }

    if (Date.now() - lastAttackCountRefreshAt < 60 * 1000 && attackCount !== undefined)
        return

    try {
        await sendXT("gai", JSON.stringify({}))
        await waitForResult("gai", 1000 * 10)
    } catch (e) {
        console.debug("attackCountRefreshFailed:", e)
    }
}
let announced = false
let timeoutBackoffMs = 0
let coolingDownBackoffMs = 0
let lastSuccessfulAttackAt = 0

const RETRYABLE_ATTACK_ERRORS = new Set([
    "COOLING_DOWN",
    "TIMED_OUT",
    "MISSING_UNITS",
    "CANT_START_NEW_ARMIES",
    "LORD_IS_USED",
    "NOT_ENOUGH_CURRENCY1",
    "ATTACK_TOO_MANY_UNITS",
])

const limiter = new RateLimiter({ tokensPerInterval: 60 / (8 / 60) - 8, interval: "hour" })

const getAttackDelayMs = (profile) => {
    const isBaron = profile === "baron"
    const baseDelayRaw = Number.parseFloat(
        isBaron ? pluginOptions.baronAttackDelaySeconds : pluginOptions.attackDelaySeconds
    )
    const varianceRaw = Number.parseFloat(
        isBaron ? pluginOptions.baronAttackDelayRandomizationSeconds : pluginOptions.attackDelayRandomizationSeconds
    )
    const defaultBase = isBaron ? 4 : 4.5
    const defaultVariance = isBaron ? 2 : 2.5

    const baseDelay = Number.isFinite(baseDelayRaw) ? Math.max(0, baseDelayRaw) : defaultBase
    const variance = Number.isFinite(varianceRaw) ? Math.max(0, varianceRaw) : defaultVariance
    return boxMullerRandom(baseDelay * 1000, (baseDelay + variance) * 1000, 1)
}

const waitToAttack = (callback, options = {}) => new Promise(async (resolve, reject) => {
    await refreshAttackCount()
    const dailyAttackLimit = getDailyAttackLimit()

    if (!botConfig.externalEvent && attackCount >= dailyAttackLimit) {
        if (!announced) {
            announced = true
            console.warn("Daily attack limit reached.", "limit:", dailyAttackLimit, "count:", attackCount)
        }
        return resolve(false)
    }

    attacks.push({
        profile: options.profile,
        run: async () => {
            try {
                const ret = callback()
                const result = ret != null && typeof ret.then === "function" ? await ret : ret
                resolve(result)
                return result
            }
            catch (e) {
                reject(e)
                throw e
            }
        }
    })

    if (!alreadyRunning) {
        alreadyRunning = true
        while (attacks?.length > 0) {
            try {
                const task = attacks.shift()
                const naturalDelay = getAttackDelayMs(task?.profile)
                const globalGapRaw = Number.parseFloat(pluginOptions.globalAttackGapSeconds)
                const globalGapMs = Number.isFinite(globalGapRaw) ? Math.max(0, globalGapRaw * 1000) : 2000
                const elapsedSinceLastSuccess = Date.now() - lastSuccessfulAttackAt
                if (lastSuccessfulAttackAt > 0 && elapsedSinceLastSuccess < globalGapMs)
                    await sleep(globalGapMs - elapsedSinceLastSuccess)

                console.debug("attackDelayAttack", naturalDelay)

                if (!await (task?.run?.()))
                    continue

                lastSuccessfulAttackAt = Date.now()
                if (attackCount !== undefined) {
                    attackCountDayKey = getEgyptAttackDayKey()
                    attackCount++
                }
                timeoutBackoffMs = 0
                coolingDownBackoffMs = 0
                await limiter.removeTokens(1)
                await sleep(naturalDelay)
            } catch (innerError) {
                if (innerError === "TIMED_OUT") {
                    timeoutBackoffMs = timeoutBackoffMs > 0 ? Math.min(timeoutBackoffMs * 2, 30000) : 3000
                    console.warn("attackTimeoutBackoffMs", timeoutBackoffMs)
                    await sleep(timeoutBackoffMs)
                }
                else if (innerError === "COOLING_DOWN") {
                    const gapRaw = Number.parseFloat(pluginOptions.globalAttackGapSeconds)
                    const gapMs = Number.isFinite(gapRaw) ? Math.max(0, gapRaw * 1000) : 2000
                    const baseCooldownMs = Math.max(5000, gapMs * 2)
                    coolingDownBackoffMs = coolingDownBackoffMs > 0 ?
                        Math.min(coolingDownBackoffMs + 2000, 60000) : baseCooldownMs
                    console.debug("attackCoolingDownMs", coolingDownBackoffMs)
                    await sleep(coolingDownBackoffMs)
                }
                else if (RETRYABLE_ATTACK_ERRORS.has(innerError)) {
                    await sleep(2000)
                }

                if (innerError !== "NO_MORE_TROOPS" && !RETRYABLE_ATTACK_ERRORS.has(innerError)) {
                    console.warn("failedToHandleAttack", innerError)
                    console.error(innerError)
                }
            }
        }
        alreadyRunning = false
    }
})

function assignCustomTool(unitSlot, toolId, quantity, castleInventory, pluginOptions = {}) {
    if (!toolId) return 0

    const candidates = []

    // Candidate 1: Primary configured tool
    const primaryUnit = castleInventory.find(e => Number(e.unitInfo.wodID) === Number(toolId) && e.amount > 0)
    if (primaryUnit) {
        candidates.push({
            id: Number(toolId),
            unit: primaryUnit,
            qty: Math.floor(Math.max(0, Math.min(primaryUnit.amount, quantity))),
            priority: 4
        })
    }

    const eventShieldIds = [558, 143, 169, 739, 562, 778, 566, 773, 770, 771, 775, 81, 82]
    const woodShieldIds = [27, 620]
    const ironShieldIds = [172, 635]

    const isEventShield = eventShieldIds.includes(Number(toolId))
    const isWoodShield = woodShieldIds.includes(Number(toolId))
    const isIronShield = ironShieldIds.includes(Number(toolId))

    if (isEventShield) {
        // Candidate 2: Alternative event shields (all event shields except the primary)
        eventShieldIds.forEach(fId => {
            if (fId !== Number(toolId)) {
                const fUnit = castleInventory.find(e => Number(e.unitInfo.wodID) === fId && e.amount > 0)
                if (fUnit) {
                    candidates.push({
                        id: fId,
                        unit: fUnit,
                        qty: Math.floor(Math.max(0, Math.min(fUnit.amount, quantity))),
                        priority: 3
                    })
                }
            }
        })

        // Candidate 3: Iron fallbacks
        if (pluginOptions.useIronShieldsFallback) {
            ironShieldIds.forEach(fId => {
                const fUnit = castleInventory.find(e => Number(e.unitInfo.wodID) === fId && e.amount > 0)
                if (fUnit) {
                    candidates.push({
                        id: fId,
                        unit: fUnit,
                        qty: Math.floor(Math.max(0, Math.min(fUnit.amount, quantity))),
                        priority: 2
                    })
                }
            })
        }

        // Candidate 4: Wood fallbacks
        if (pluginOptions.useWoodShieldsFallback) {
            woodShieldIds.forEach(fId => {
                const fUnit = castleInventory.find(e => Number(e.unitInfo.wodID) === fId && e.amount > 0)
                if (fUnit) {
                    candidates.push({
                        id: fId,
                        unit: fUnit,
                        qty: Math.floor(Math.max(0, Math.min(fUnit.amount, quantity))),
                        priority: 1
                    })
                }
            })
        }
    } else if (isWoodShield) {
        // If primary is wood shield, we can fallback to other wood shields if useWoodShieldsFallback is enabled
        if (pluginOptions.useWoodShieldsFallback) {
            woodShieldIds.forEach(fId => {
                if (fId !== Number(toolId)) {
                    const fUnit = castleInventory.find(e => Number(e.unitInfo.wodID) === fId && e.amount > 0)
                    if (fUnit) {
                        candidates.push({
                            id: fId,
                            unit: fUnit,
                            qty: Math.floor(Math.max(0, Math.min(fUnit.amount, quantity))),
                            priority: 2
                        })
                    }
                }
            })
        }
        // Also fallback to iron shields if useIronShieldsFallback is enabled
        if (pluginOptions.useIronShieldsFallback) {
            ironShieldIds.forEach(fId => {
                const fUnit = castleInventory.find(e => Number(e.unitInfo.wodID) === fId && e.amount > 0)
                if (fUnit) {
                    candidates.push({
                        id: fId,
                        unit: fUnit,
                        qty: Math.floor(Math.max(0, Math.min(fUnit.amount, quantity))),
                        priority: 1
                    })
                }
            })
        }
    } else if (isIronShield) {
        // If primary is iron shield, we can fallback to other iron shields if useIronShieldsFallback is enabled
        if (pluginOptions.useIronShieldsFallback) {
            ironShieldIds.forEach(fId => {
                if (fId !== Number(toolId)) {
                    const fUnit = castleInventory.find(e => Number(e.unitInfo.wodID) === fId && e.amount > 0)
                    if (fUnit) {
                        candidates.push({
                            id: fId,
                            unit: fUnit,
                            qty: Math.floor(Math.max(0, Math.min(fUnit.amount, quantity))),
                            priority: 2
                        })
                    }
                }
            })
        }
        // Also fallback to wood shields if useWoodShieldsFallback is enabled
        if (pluginOptions.useWoodShieldsFallback) {
            woodShieldIds.forEach(fId => {
                const fUnit = castleInventory.find(e => Number(e.unitInfo.wodID) === fId && e.amount > 0)
                if (fUnit) {
                    candidates.push({
                        id: fId,
                        unit: fUnit,
                        qty: Math.floor(Math.max(0, Math.min(fUnit.amount, quantity))),
                        priority: 1
                    })
                }
            })
        }
    }

    if (candidates.length === 0) {
        return 0
    }

    candidates.sort((a, b) => {
        if (b.qty !== a.qty) return b.qty - a.qty
        if (b.priority !== a.priority) return b.priority - a.priority
        return b.unit.amount - a.unit.amount
    })

    const best = candidates[0]
    if (best.qty > 0) {
        unitSlot[0] = best.id
        unitSlot[1] = best.qty
        best.unit.amount -= best.qty
        return best.qty
    }

    return 0
}

function getShieldCount(unitInventory, pluginOptions, defaultShieldIds, customWaves) {
    const ALL_SHIELD_IDS = [27, 172, 558, 143, 169, 739, 562, 778, 566, 773, 770, 771, 775, 81, 82, 620, 635]
    const SHIELD_IDS = []

    const useCustom = customWaves && customWaves.waves && (Array.isArray(customWaves.waves) || typeof customWaves.waves === 'object')
    if (useCustom) {
        const wavesArray = Array.isArray(customWaves.waves) ? customWaves.waves : Object.values(customWaves.waves)
        wavesArray.forEach(wave => {
            if (!wave || wave.enabled === false) return
            ['L', 'R', 'M'].forEach(flank => {
                const tools = wave[flank]
                if (tools && typeof tools === 'object') {
                    Object.values(tools).forEach(tool => {
                        if (tool && tool.toolId && ALL_SHIELD_IDS.includes(Number(tool.toolId))) {
                            if (!SHIELD_IDS.includes(Number(tool.toolId))) {
                                SHIELD_IDS.push(Number(tool.toolId))
                            }
                        }
                    })
                }
            })
        })
    }

    if (SHIELD_IDS.length === 0) {
        defaultShieldIds.forEach(id => SHIELD_IDS.push(id))
        // Always include ordinary wood/iron shields for classic waves count
        if (!SHIELD_IDS.includes(27)) SHIELD_IDS.push(27)
        if (!SHIELD_IDS.includes(620)) SHIELD_IDS.push(620)
        if (!SHIELD_IDS.includes(172)) SHIELD_IDS.push(172)
        if (!SHIELD_IDS.includes(635)) SHIELD_IDS.push(635)
    }

    if (pluginOptions.useWoodShieldsFallback) {
        if (!SHIELD_IDS.includes(27)) SHIELD_IDS.push(27)
        if (!SHIELD_IDS.includes(620)) SHIELD_IDS.push(620)
    }
    if (pluginOptions.useIronShieldsFallback) {
        if (!SHIELD_IDS.includes(172)) SHIELD_IDS.push(172)
        if (!SHIELD_IDS.includes(635)) SHIELD_IDS.push(635)
    }

    const totalShields = unitInventory.reduce((sum, unit) => {
        if (SHIELD_IDS.includes(Number(unit.unitInfo?.wodID || unit.wodID))) {
            return sum + Number(unit.amount || 0)
        }
        return sum
    }, 0)

    return totalShields
}


const { getTroopResourceType, resolveTroopTypeSettings, getTroopTypeOrder } = require("./troopTypeFilter.js")

function getCombinedTroops(melee, ranged, wavePriority, options) {
    const order = getTroopTypeOrder(resolveTroopTypeSettings(options))
    const combined = []

    for (const type of order) {
        const typeMelee = melee.filter(u => getTroopResourceType(u.unitInfo) === type)
        const typeRanged = ranged.filter(u => getTroopResourceType(u.unitInfo) === type)

        if (wavePriority === 'ranged') {
            combined.push(...typeRanged)
            combined.push(...typeMelee)
        } else {
            combined.push(...typeMelee)
            combined.push(...typeRanged)
        }
    }
    return combined
}

function assignTroops(slots, combined, maxTroops) {
    let remCapacity = maxTroops
    let remSlots = slots.length

    slots.forEach(unitSlot => {
        if (remCapacity <= 0) return

        let unitToAssign = null

        if (remSlots === 1) {
            unitToAssign = combined.find(e => e.amount >= remCapacity)
            if (!unitToAssign) {
                let maxUnit = combined.reduce((max, u) => u.amount > max.amount ? u : max, { amount: 0 })
                if (maxUnit.amount > 0) {
                    unitToAssign = maxUnit
                }
            }
        }

        if (!unitToAssign) {
            unitToAssign = combined.find(e => e.amount > 0)
        }

        if (unitToAssign) {
            const assigned = Math.floor(Math.max(Math.min(unitToAssign.amount, remCapacity), 0))
            unitToAssign.amount -= assigned
            if (assigned > 0) {
                unitSlot[0] = unitToAssign.unitInfo.wodID
                unitSlot[1] = assigned
                remCapacity -= assigned
            }
        }

        remSlots--
    })

    return maxTroops - remCapacity
}

module.exports = {
    getAttackInfo,
    assignUnit,
    assignCustomTool,
    waitToAttack,
    getTotalAmountToolsFlank,
    getTotalAmountToolsFront,
    getAmountSoldiersFlank,
    getAmountSoldiersFront,
    getMaxUnitsInReinforcementWave,
    boxMullerRandom,
    getCombinedTroops,
    assignTroops,
    getMaxAttackers,
    getShieldCount
}
