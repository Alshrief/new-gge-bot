const units = require("../../items/units.json")

/** @typedef {'food' | 'mead' | 'beef'} TroopResourceType */

/** @type {Map<number, number>} */
const meadWodLevelById = new Map()

const STORM_MEAD_CHAIN_BASES = [
    { baseWodID: 195, extraWodIDs: [] },
    { baseWodID: 205, extraWodIDs: [] },
    { baseWodID: 217, extraWodIDs: [489] },
    { baseWodID: 228, extraWodIDs: [493] },
]

function buildUpgradeChain(startWodID, extraWodIDs = []) {
    const chain = []
    const seen = new Set()
    let current = startWodID

    while (current != null && !seen.has(Number(current))) {
        seen.add(Number(current))
        const item = units.find(e => Number(e.wodID) === Number(current))
        if (!item)
            break
        chain.push(Number(item.wodID))
        if (!item.upgradeWodID)
            break
        if (Number(item.upgradeWodID) === Number(current))
            break
        current = item.upgradeWodID
    }

    for (const extraWodID of extraWodIDs) {
        if (!chain.includes(Number(extraWodID)))
            chain.push(Number(extraWodID))
    }

    return chain
}

function registerMeadChain(chain) {
    chain.forEach((wodID, level) => meadWodLevelById.set(wodID, level))
}

function buildMeadLevelMap() {
    const processedTypes = new Set()

    for (const { baseWodID, extraWodIDs } of STORM_MEAD_CHAIN_BASES) {
        const baseUnit = units.find(e => Number(e.wodID) === Number(baseWodID))
        if (!baseUnit)
            continue
        processedTypes.add(baseUnit.type)
        registerMeadChain(buildUpgradeChain(baseWodID, extraWodIDs))
    }

    const meadUnits = units.filter(u => u.meadSupply)
    for (const type of [...new Set(meadUnits.map(u => u.type))]) {
        if (processedTypes.has(type))
            continue

        const typeUnits = meadUnits.filter(u => u.type === type)
        const root = typeUnits.sort((a, b) => Number(a.wodID) - Number(b.wodID))[0]
        if (!root)
            continue

        registerMeadChain(buildUpgradeChain(root.wodID))
        processedTypes.add(type)
    }
}

buildMeadLevelMap()

const DEFAULT_MEAD_MIN_ATTACK_LEVEL = 0
const DEFAULT_MEAD_MAX_ATTACK_LEVEL = 7

/**
 * @param {import("../../protocols.js").Types.UnitInfo | Record<string, unknown>} unitInfo
 * @returns {TroopResourceType}
 */
function getTroopResourceType(unitInfo) {
    if (unitInfo.beefSupply != undefined)
        return "beef"
    if (unitInfo.meadSupply != undefined)
        return "mead"
    return "food"
}

/**
 * Mead troop tier index (0 = lowest) from upgrade chain wodIDs.
 * @param {import("../../protocols.js").Types.UnitInfo | Record<string, unknown>} unitInfo
 * @returns {number | null}
 */
function getMeadTroopLevel(unitInfo) {
    const wodID = Number(unitInfo.wodID)
    if (!meadWodLevelById.has(wodID))
        return null
    return meadWodLevelById.get(wodID)
}

/**
 * @param {Record<string, unknown>} options
 */
function resolveMeadAttackLevelRange(options) {
    const minRaw = options.meadMinAttackLevel
    const maxRaw = options.meadMaxAttackLevel

    const min = minRaw === undefined || minRaw === "" ?
        DEFAULT_MEAD_MIN_ATTACK_LEVEL : Number(minRaw)
    const max = maxRaw === undefined || maxRaw === "" ?
        DEFAULT_MEAD_MAX_ATTACK_LEVEL : Number(maxRaw)

    return {
        min: Number.isFinite(min) ? Math.max(0, min) : DEFAULT_MEAD_MIN_ATTACK_LEVEL,
        max: Number.isFinite(max) ? Math.max(0, max) : DEFAULT_MEAD_MAX_ATTACK_LEVEL,
    }
}

/**
 * Gets the upgrade level of a unit (either mapped mead level or raw unit level).
 * @param {import("../../protocols.js").Types.UnitInfo | Record<string, unknown>} unitInfo
 * @returns {number | null}
 */
function getTroopLevel(unitInfo) {
    const type = getTroopResourceType(unitInfo)
    if (type === "mead") {
        return getMeadTroopLevel(unitInfo)
    }
    return 0
}

/**
 * Checks if the troop level is within the configured min/max range for its resource type.
 * @param {import("../../protocols.js").Types.UnitInfo | Record<string, unknown>} unitInfo
 * @param {TroopResourceType} type
 * @param {Record<string, unknown>} options
 * @returns {boolean}
 */
function isTroopLevelAllowed(unitInfo, type, options) {
    if (type !== "mead")
        return true

    const level = getMeadTroopLevel(unitInfo)
    if (level === null)
        return true

    const minRaw = options.meadMinAttackLevel
    const maxRaw = options.meadMaxAttackLevel

    const min = minRaw === undefined || minRaw === "" ? 0 : Number(minRaw)
    const max = maxRaw === undefined || maxRaw === "" ? 10 : Number(maxRaw)

    const allowedMax = Math.max(min, max)
    return level >= min && level <= allowedMax
}

/**
 * @param {import("../../protocols.js").Types.UnitInfo | Record<string, unknown>} unitInfo
 * @param {Record<string, unknown>} options
 */
function isMeadTroopLevelAllowed(unitInfo, options) {
    return isTroopLevelAllowed(unitInfo, "mead", options)
}

/**
 * @param {{ food: boolean, mead: boolean, beef: boolean }} settings
 * @param {Record<string, unknown>} options
 * @returns {TroopResourceType[]}
 */
function getTroopTypeOrder(settings, options) {
    const order = []
    const prioritizeFood = !!options?.prioritizeFoodOverMead
    if (prioritizeFood) {
        if (settings.food)
            order.push("food")
        if (settings.mead)
            order.push("mead")
    } else {
        if (settings.mead)
            order.push("mead")
        if (settings.food)
            order.push("food")
    }
    return order
}

/**
 * @param {Record<string, unknown>} options
 */
function resolveTroopTypeSettings(options) {
    if (options.useFoodTroops || options.useMeadTroops) {
        return {
            food: !!options.useFoodTroops,
            mead: !!options.useMeadTroops,
            beef: false, // Never use beef!
        }
    }

    return { food: true, mead: true, beef: false }
}

/**
 * @param {import("../../protocols.js").Types.UnitInfo | Record<string, unknown>} unitInfo
 * @param {Record<string, unknown>} options
 */
function isTroopResourceTypeAllowed(unitInfo, options) {
    const settings = resolveTroopTypeSettings(options)
    const type = getTroopResourceType(unitInfo)

    if (type === "beef")
        return false // Never use beef!

    if (!settings[type])
        return false

    if (!isTroopLevelAllowed(unitInfo, type, options))
        return false

    return true
}

/**
 * Puts allowed troops in priority order: mead (low tier first), then food, then beef.
 * @param {Array<{ unitInfo: Record<string, unknown> }>} troops
 * @param {Record<string, unknown>} options
 */
function orderTroopsByTypePreference(troops, options) {
    const order = getTroopTypeOrder(resolveTroopTypeSettings(options), options)

    troops.sort((a, b) => {
        const typeCmp = order.indexOf(getTroopResourceType(a.unitInfo)) -
            order.indexOf(getTroopResourceType(b.unitInfo))
        if (typeCmp !== 0)
            return typeCmp

        const levelA = getTroopLevel(a.unitInfo)
        const levelB = getTroopLevel(b.unitInfo)
        if (levelA !== null && levelB !== null && levelA !== levelB) {
            // Sort high level first
            return levelB - levelA
        }

        return 0
    })
}

const troopTypePluginOptions = [
    { type: "Label", key: "troopTypeSettings" },
    { type: "Checkbox", key: "useMeadTroops", default: true },
    { type: "Checkbox", key: "useFoodTroops", default: true },
    { type: "Checkbox", key: "prioritizeFoodOverMead", default: false },
    { type: "Label", key: "meadLevelSettings" },
    {
        type: "Text",
        key: "meadMinAttackLevel",
        default: String(DEFAULT_MEAD_MIN_ATTACK_LEVEL),
    },
    {
        type: "Text",
        key: "meadMaxAttackLevel",
        default: "10",
    },
]

module.exports = {
    getTroopResourceType,
    getMeadTroopLevel,
    getTroopLevel,
    getTroopTypeOrder,
    resolveTroopTypeSettings,
    resolveMeadAttackLevelRange,
    isMeadTroopLevelAllowed,
    isTroopLevelAllowed,
    isTroopResourceTypeAllowed,
    orderTroopsByTypePreference,
    troopTypePluginOptions,
    meadWodLevelById,
}
