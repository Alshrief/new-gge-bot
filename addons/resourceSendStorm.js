const fs = require("fs")
if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            // ── Attack Section ──────────────────────────────────────
            { type: "Label", key: "easyForts", md: 2 },
            { type: "Checkbox", key: "allowLvl40Easy", default: true },
            { type: "Checkbox", key: "allowLvl50Easy", default: true },
            { type: "Checkbox", key: "allowLvl60Easy", default: true },
            { type: "", md: 3 },

            { type: "Label", key: "hardForts", md: 2 },
            { type: "Checkbox", key: "allowLvl70Hard", default: false },
            { type: "Checkbox", key: "allowLvl80Hard", default: false },

            { type: "Label", key: "other" },
            { type: "Checkbox", key: "buyCoins", default: true },
            { type: "Checkbox", key: "buyDecoration", default: false },
            { type: "Checkbox", key: "buyXP", default: false },
            { type: "Checkbox", key: "useFeather", default: false },
            { type: "Checkbox", key: "useCoin", default: false },
            ...require("./attack/troopTypeOptions.js"),
            { type: "Text", key: "commanderWhiteList", default: "1-99" },

            // ── Resources & Upgrades Section ────────────────────────
            { type: "Label", key: "stormResourcesSection" },
            { type: "Checkbox", key: "sendResources", default: true },
            { type: "Checkbox", key: "autoBuildCargo", default: true },
            { type: "Checkbox", key: "autoUpgradeCargo", default: true },
            { type: "Checkbox", key: "useSkipsForCargo", default: true },
            { type: "Text", key: "cargoTargetLevel", default: "10" },
            { type: "Checkbox", key: "sendMead", default: true },
            { type: "Text", key: "meadThreshold", default: "50000" },
            { type: "Checkbox", key: "useSkipsForMead", default: true },
            { type: "Checkbox", key: "sendFood", default: false },
            { type: "Text", key: "foodThreshold", default: "50000" },
            { type: "Checkbox", key: "useSkipsForFood", default: true },
            ...require("./timeSkipsPluginOptions.js")
        ]
    }

// ════════════════════════════════════════════════════════════════
//  Imports
// ════════════════════════════════════════════════════════════════

const buildings = require("../items/buildings.json")
const {
    movementEvents, ClientCommands, AreaType, KingdomID,
    KingdomSkipType, movements, spiralCoordinates,
    castles, unlockInfoList, setCastle, ClassTypes
} = require("../protocols.js")
const { waitToAttack, getAttackInfo, assignUnit, getAmountSoldiersFlank } = require("./attack/attack.js")
const { isTroopResourceTypeAllowed, orderTroopsByTypePreference } = require("./attack/troopTypeFilter.js")
const { waitForCommanderAvailable, freeCommander, useCommander } = require("./commander.js")
const {
    upgradeBuilding, placeBuilding, expandCastle,
    finishConstructionQueue, hasFreeConstructionSlot,
    canAffordBuilding, getBuildingsByGroup,
    skipConstructionTime, costTable
} = require("../addons-extra/buildings.js")
const { spendSkip } = require("./skips.js")
const { sendXT, waitForResult, botConfig, events, i18n } = require("../ggeBot.js")

const err = require("../err.json")
const pretty = require("pretty-time")

// ════════════════════════════════════════════════════════════════
//  Config
// ════════════════════════════════════════════════════════════════

const pluginName = require("path").basename(__filename).slice(0, -3)
const pluginOptions = new Proxy({}, {
    get(target, prop) {
        const opts = botConfig.plugins[pluginName] || {}
        return opts[prop]
    }
})
const kingdomID = KingdomID.stormIslands
const type = AreaType.stormTower
const minTroopCount = 100

// ════════════════════════════════════════════════════════════════
//  Cargo upgrade helpers
// ════════════════════════════════════════════════════════════════

const CARGO_START_WOD_ID = 35
const cargoWodIDs = buildings.filter(b => b.name === "Cargo").map(b => Number(b.wodID))
const baseCargoInfo = buildings.find(e => e.wodID == CARGO_START_WOD_ID)
const minCargoAquaCost = Number(baseCargoInfo?.costAquamarine ?? 150)

function getAqua(castle) {
    return castle.aqua ?? castle.getProductionData?.aqua ?? 0
}

function getErrMsg(e) {
    return e?.message || (typeof e === 'string' ? e : '') || '';
}

async function buildStormCargoShip(castle) {
    if (!hasFreeConstructionSlot(castle)) return false

    const cargoInfo = buildings.find(e => e.wodID == CARGO_START_WOD_ID)
    if (!cargoInfo || getAqua(castle) < Number(cargoInfo.costAquamarine)) return false

    const xCandidates = [200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 255]
    const yCandidates = [220, 210, 230]
    
    // Count how many cargo ships are already built/building in this castle
    const cargoShips = castle.buildings?.filter(b => cargoWodIDs.includes(b.wodID)) || []
    const n = cargoShips.length
    const bDetails = castle.buildings?.map(b => `${b.wodID}:(${b.x},${b.y})`).join(" | ") || "None"
    console.debug(`[العواصف] تفاصيل المباني: ${bDetails}`)
    console.info(`[العواصف] إجمالي المباني: ${castle.buildings?.length ?? 0} | سفن الشحن المكتشفة: ${n}`)
    
    
    // Try placing cargo ships sequentially starting from candidate rows
    for (const y of yCandidates) {
        for (const x of xCandidates) {
            // Local safety check to avoid trying occupied slots
            const localExists = castle.buildings?.some(b => b.x == x && b.y == y)
            if (localExists) continue

            console.debug(`[العواصف] محاولة بناء سفينة شحن عند الإحداثيات (${x}, ${y})`)
            
            try {
                await sendXT("ebu", JSON.stringify({ WID: CARGO_START_WOD_ID, X: x, Y: y, R: 0, PWR: 0, PO: -1, DOID: -1 }))
                const [obj, result] = await waitForResult("ebu", 1000 * 10, obj => obj?.NO?.length > 0)
                
                if (result == 0) {
                    console.log("builtStormCargoShip")
                    
                    // Add the new building locally so it's included in upgrades right away
                    const newBuilding = ClassTypes.BuildingInfo(obj.NO)
                    castle.buildings.push(newBuilding)
                    
                    // Update building slots locally so that hasFreeConstructionSlot knows it is busy
                    if (castle.buildingSlots) {
                        const freeIdx = castle.buildingSlots.indexOf(-1)
                        if (freeIdx !== -1) {
                            castle.buildingSlots[freeIdx] = newBuilding.ownerID
                        }
                    }
                    
                    // Deduct the aquamarine cost locally
                    castle.aqua = getAqua(castle) - Number(cargoInfo.costAquamarine)
                    if (castle.getProductionData) castle.getProductionData.aqua = castle.aqua

                    // If skips are enabled for cargo, complete the construction immediately!
                    const customOpts = pluginOptions.useSkipsForCargo !== false ? pluginOptions : {
                        ...pluginOptions,
                        "1Minute": false, "5Minute": false, "10Minute": false, "30Minute": false, "1Hour": false, "5Hour": false, "24Hour": false
                    }
                    try {
                        await skipConstructionTime(castle, newBuilding.ownerID, customOpts)
                        // Once skipped, update the slot to -1 locally!
                        if (castle.buildingSlots) {
                            const idx = castle.buildingSlots.indexOf(newBuilding.ownerID)
                            if (idx !== -1) {
                                castle.buildingSlots[idx] = -1
                            }
                        }
                    } catch (e) {
                        console.warn("[العواصف] فشل تخطي وقت بناء سفينة الشحن:", getErrMsg(e))
                    }

                    return true
                }
            } catch (e) {
                console.debug(`[العواصف] فشل البناء عند الإحداثي (${x}, ${y}):`, getErrMsg(e))
            }
        }
    }
    return false
}

async function processStormCastle(castle) {
    let changed = false
    let keepGoing = true

    while (keepGoing) {
        keepGoing = false
        if (getAqua(castle) < minCargoAquaCost) break

        const customOpts = pluginOptions.useSkipsForCargo !== false ? pluginOptions : {
            ...pluginOptions,
            "1Minute": false, "5Minute": false, "10Minute": false, "30Minute": false, "1Hour": false, "5Hour": false, "24Hour": false
        }

        if (await finishConstructionQueue(castle, customOpts)) {
            changed = true
            keepGoing = true
        }

        try {
            if (await expandCastle(castle)) {
                changed = true
                keepGoing = true
            }
        } catch (e) {
            console.debug("expandCastleError:", getErrMsg(e))
        }

        let builtAny = false
        if (pluginOptions.autoBuildCargo !== false && hasFreeConstructionSlot(castle)) {
            try {
                if (await buildStormCargoShip(castle)) {
                    changed = true
                    keepGoing = true
                    builtAny = true
                }
            } catch (e) {
                console.debug("buildCargoError:", getErrMsg(e))
            }
        }

        // Only upgrade if we didn't just build a ship in this loop pass
        if (!builtAny && pluginOptions.autoUpgradeCargo !== false) {
            const cargoTargetLevel = Number(pluginOptions.cargoTargetLevel || 10)
            const existingCargo = getBuildingsByGroup(castle, CARGO_START_WOD_ID)
                .sort((a, b) => Number(a.building.level) - Number(b.building.level))

            for (let i = 0; i < existingCargo.length; i++) {
                const { building, ownerID } = existingCargo[i]
                if (!building.upgradeWodID) continue
                
                // Only upgrade if below the user-specified target level
                const currentLevel = Number(building.level)
                if (currentLevel >= cargoTargetLevel) continue

                const nextInfo = buildings.find(e => e.wodID == building.upgradeWodID)
                if (!nextInfo) break
                if (!canAffordBuilding(castle, nextInfo)) {
                    const missing = costTable(castle)
                        .filter(([costObject, resourceKey, resourceHolder]) => {
                            const cost = Number(nextInfo[costObject] ?? 0)
                            if (cost <= 0) return false
                            const available = resourceHolder[resourceKey] ?? 0
                            return cost > available
                        })
                        .map(([costObject, resourceKey]) => {
                            const nameMap = {
                                wood: "خشب", stone: "حجر", aqua: "زبرجد", coins: "عملات", rubies: "ياقوت"
                            }
                            return nameMap[resourceKey] || resourceKey
                        })
                    console.info(`[العواصف] لا يمكن ترقية سفينة الشحن إلى مستوى ${nextInfo.level} بسبب نقص: ${missing.join("، ")}`)
                    break
                }
                if (!hasFreeConstructionSlot(castle)) break

                // If skips are disabled for cargo, check if it requires skips (buildDuration > 4 minutes)
                const buildDuration = Number(nextInfo.buildDuration) / castle.getProductionData.buildSpeedBoost
                if (pluginOptions.useSkipsForCargo === false && buildDuration > 4 * 60) {
                    // It requires skips, but skips are disabled for cargo. So skip upgrading this ship for now.
                    continue
                }

                try {
                    await upgradeBuilding(castle, ownerID, customOpts)
                    console.log("upgradedStormCargoShip", building.level, "toLevel", nextInfo.level)
                    
                    // Update building level locally
                    const bldObj = castle.buildings.find(b => b.ownerID == ownerID)
                    if (bldObj) {
                        bldObj.wodID = Number(nextInfo.wodID)
                    }
                    
                    changed = true
                    keepGoing = true
                } catch (e) {
                    const errMsg = getErrMsg(e);
                    switch (errMsg) {
                        case "NOT_ENOUGH_RESOURCE":
                        case "NO_FREE_CONSTRUCTION_SLOTS":
                            break
                        default:
                            console.debug("upgradeCargo:", errMsg)
                            break
                    }
                    break
                }
            }
        }
    }

    if (changed) castle.emit("resourceUpdate")
}

// ════════════════════════════════════════════════════════════════
//  Resource send helpers
// ════════════════════════════════════════════════════════════════

async function trySendRes(stormCastle) {
    let allowedAIDS = castles.filter(e => e.kingdomID != KingdomID.stormIslands
        && [AreaType.mainCastle, AreaType.externalKingdom].includes(e.areaInfo.type)).map(e => e.id)

    for (let i = 0; i < castles.length; i++) {
        if (stormCastle.wood <= 0 && stormCastle.stone <= 0) break
        const castle = castles[i]
        if ([KingdomID.berimond, KingdomID.stormIslands].includes(castle.kingdomID)) continue
        if (!allowedAIDS.includes(castle.areaID)) continue
        if (castle.resourceTransfer?.remainingTime > 0) continue

        let maxWoodToSend = Math.min(castle.getProductionData.maxAmountWood - castle.wood, stormCastle.wood)
        let maxStoneToSend = Math.min(castle.getProductionData.maxAmountStone - castle.stone, stormCastle.stone)
        const G = [["W", maxWoodToSend], ["S", maxStoneToSend]].filter(e => e[1] > 0)
        if (G.length == 0) continue

        let result = await ClientCommands.skipResourceTransfer(stormCastle.areaID, KingdomID.stormIslands, castle.kingdomID, G)
        if (result != 0) continue

        stormCastle.wood -= maxWoodToSend
        stormCastle.stone -= maxStoneToSend
        stormCastle.emit("resourceUpdate")
        const isAr = (i18n.getLocale() == 'ar')
        const resStr = G.map(([type, amount]) => {
            const name = type == 'W' ? (isAr ? 'خشب' : 'Wood') : (isAr ? 'حجر' : 'Stone')
            return `${amount.toLocaleString()} ${name}`
        }).join(isAr ? "، " : ", ")
        console.log("sentResSend", resStr, "toResSend", KingdomID[castle.kingdomID])
    }
}

const skipResource = async castle => {
    while (castle.resourceTransfer?.remainingTime > 0) {
        let skip = spendSkip(castle.resourceTransfer.remainingTime, pluginOptions)
        if (skip == undefined) throw new Error("couldntFindSkip")
        if (await ClientCommands.kingdomUnitTransfer(skip, kingdomID, KingdomSkipType.sendResource) != 0) return
    }
}

async function trySendMead(mainCastle, stormCastle) {
    const meadThreshold = Number(pluginOptions.meadThreshold || 50000)
    if (pluginOptions.useSkipsForMead !== false) await skipResource(stormCastle)
    if (stormCastle.resourceTransfer?.remainingTime > 0) {
        console.log(`[العواصف] تعويض الميد: هناك شحنة جارية، المتبقي: ${pretty(Math.round(stormCastle.resourceTransfer.remainingTime * 1e9), 's')}`)
        return
    }

    if (stormCastle.mead <= meadThreshold) {
        const maxAmount = stormCastle.getProductionData?.maxAmountMead ?? 80000
        let amountToSend = Math.floor(maxAmount - stormCastle.mead)
        amountToSend = Math.min(amountToSend, mainCastle.mead ?? 0)
        if (amountToSend <= 0) {
            console.log("[العواصف] تعويض الميد: لا يوجد شراب عسل كاف في القلعة الرئيسية لإرساله")
            return
        }

        let result = await ClientCommands.skipResourceTransfer(mainCastle.id, KingdomID.greatEmpire, kingdomID, [["MEAD", amountToSend]])
        if (result == 0) {
            console.log("sentMeadReplace", amountToSend, "meadToMeadReplace", KingdomID[kingdomID])
            if (pluginOptions.useSkipsForMead !== false) await skipResource(stormCastle)
        } else {
            console.log("failedToSendMead")
        }
    }
}

async function trySendFood(mainCastle, stormCastle) {
    const foodThreshold = Number(pluginOptions.foodThreshold || 50000)
    if (pluginOptions.useSkipsForFood !== false) await skipResource(stormCastle)
    if (stormCastle.resourceTransfer?.remainingTime > 0) {
        console.log(`[العواصف] تعويض الطعام: هناك شحنة جارية، المتبقي: ${pretty(Math.round(stormCastle.resourceTransfer.remainingTime * 1e9), 's')}`)
        return
    }

    if (stormCastle.food <= foodThreshold) {
        const maxAmount = stormCastle.getProductionData?.maxAmountFood ?? 80000
        let amountToSend = Math.floor(maxAmount - stormCastle.food)
        amountToSend = Math.min(amountToSend, Math.max(0, (mainCastle.food ?? 0) - 20000))
        if (amountToSend <= 0) {
            console.log("[العواصف] تعويض الطعام: طعام القلعة الرئيسية منخفض جداً لتجنب المجاعة (أقل من 20,000)")
            return
        }

        let result = await ClientCommands.skipResourceTransfer(mainCastle.id, KingdomID.greatEmpire, kingdomID, [["F", amountToSend]])
        if (result == 0) {
            const isAr = (i18n.getLocale() == 'ar')
            const foodName = isAr ? 'طعام' : 'Food'
            console.log("sentResSend", `${amountToSend.toLocaleString()} ${foodName}`, "toResSend", KingdomID[kingdomID])
            if (pluginOptions.useSkipsForFood !== false) await skipResource(stormCastle)
        } else {
            console.log("failedToSendFood")
        }
    }
}

async function checkStormResources(stormCastle, mainCastle) {
    try {
        const cargoList = stormCastle.buildings.filter(b => cargoWodIDs.includes(b.wodID))
        if (cargoList.length > 0) {
            const countsByLvl = {}
            cargoList.forEach(b => {
                const lvl = buildings.find(x => x.wodID == b.wodID)?.level || '?'
                countsByLvl[lvl] = (countsByLvl[lvl] || 0) + 1
            })
            const summary = Object.entries(countsByLvl).map(([lvl, count]) => `مستوى ${lvl}: ${count} سفن`).join(" | ")
            console.info("[العواصف] سفن الشحن الحالية:", summary)
        } else {
            console.info("[العواصف] سفن الشحن الحالية: لا توجد سفن مبنية حالياً")
        }
    } catch (err) {
        console.debug("printCargoInfo error:", err.message)
    }

    // 1. Auto Cargo Build & Upgrade
    if (pluginOptions.autoBuildCargo !== false || pluginOptions.autoUpgradeCargo !== false) {
        try { await setCastle(stormCastle, () => processStormCastle(stormCastle)) }
        catch (e) { console.error("[العواصف] خطأ أثناء بناء أو ترقية سفن الشحن:", e) }
    }
    // 2. Resource Send Back (Wood/Stone)
    if (pluginOptions.sendResources !== false) {
        try { await trySendRes(stormCastle) }
        catch (e) { console.error("[العواصف] خطأ أثناء إرجاع الموارد:", e) }
    }
    // 3. Auto Send Mead
    if (pluginOptions.sendMead) {
        try { await trySendMead(mainCastle, stormCastle) }
        catch (e) { console.error("[العواصف] خطأ أثناء تعويض شراب العسل:", e) }
    }
    // 4. Auto Send Food
    if (pluginOptions.sendFood) {
        try { await trySendFood(mainCastle, stormCastle) }
        catch (e) { console.error("[العواصف] خطأ أثناء تعويض الطعام:", e) }
    }
}

// ════════════════════════════════════════════════════════════════
//  Main event loop
// ════════════════════════════════════════════════════════════════

events.once("load", async () => {
    const castle = castles.find(e => e.kingdomID == kingdomID && e.areaInfo.type == AreaType.externalKingdom)
    if (!castle) {
        console.warn("stormCastleNotFound")
        return
    }

    const mainCastle = castles.find(({ kingdomID, areaInfo }) =>
        kingdomID == KingdomID.greatEmpire && areaInfo.type == AreaType.mainCastle)

    // ── Periodic resource management ──────────────────────────────
    // NOTE: We intentionally do NOT listen to "resourceUpdate" here.
    // upgradeBuilding/buildCargoShip emit "resourceUpdate" after each action,
    // which would re-trigger cargo processing in an infinite loop and block
    // the attack loop from ever running. The 5-minute interval is sufficient.
    if (mainCastle) {
        let isCheckingResources = false
        const runResourcesSafe = async () => {
            if (isCheckingResources) return
            isCheckingResources = true
            try {
                await checkStormResources(castle, mainCastle)
            } catch (e) {
                console.error("[العواصف] خطأ غير متوقع في فحص الموارد:", e)
            } finally {
                isCheckingResources = false
            }
        }

        // Run immediately on startup
        runResourcesSafe()

        // Run periodically every 5 minutes
        setInterval(runResourcesSafe, 5 * 60 * 1000).unref()
    }

    // ── Buy coins/deco/xp on resource update ─────────────────────
    async function onResourceUpdate() {
        let resUpdate = false
        if (pluginOptions["buyCoins"] && castle.getProductionData.maxAmountAqua <=
            Math.min(castle.getProductionData.maxAmountAqua, castle.aqua + 100000)) {
            for (let i = 0; i < Math.floor(castle.aqua / 75000); i++) {
                castle.aqua -= 75000
                sendXT("sbp", JSON.stringify({ PID: 2798, BT: 3, TID: -1, AMT: 1, KID: 4, AID: -1, PC2: -1, BA: 0, PWR: 0, _PO: -1 }))
                console.info("broughtCoins")
            }
            resUpdate = true
        }
        if (pluginOptions["buyDecoration"] && castle.getProductionData.maxAmountAqua <=
            Math.min(castle.getProductionData.maxAmountAqua, castle.aqua + 100000)) {
            for (let i = 0; i < Math.floor(castle.aqua / 100000); i++) {
                castle.aqua -= 100000
                sendXT("sbp", JSON.stringify({ PID: 3117, BT: 3, TID: -1, AMT: 1, KID: 4, AID: -1, PC2: -1, BA: 0, PWR: 0, _PO: -1 }))
                console.info("broughtDeco")
            }
            resUpdate = true
        }
        if (pluginOptions["buyXP"] && castle.getProductionData.maxAmountAqua <=
            Math.min(castle.getProductionData.maxAmountAqua, castle.aqua + 100000)) {
            for (let i = 0; i < Math.floor(castle.aqua / 10000); i++) {
                castle.aqua -= 10000
                sendXT("sbp", JSON.stringify({ PID: 3114, BT: 3, TID: -1, AMT: 1, KID: 4, AID: -1, PC2: -1, BA: 0, PWR: 0, _PO: -1 }))
                console.info("broughtXP")
            }
            resUpdate = true
        }
        if (resUpdate) castle.emit("resourceUpdate")
    }
    await onResourceUpdate()
    castle.on("resourceUpdate", onResourceUpdate)

    // ── Attack logic ──────────────────────────────────────────────
    let allowedLevels = []
    if (pluginOptions["allowLvl40Easy"]) allowedLevels.push(10)
    if (pluginOptions["allowLvl50Easy"]) allowedLevels.push(11)
    if (pluginOptions["allowLvl60Easy"]) allowedLevels.push(7, 12)
    if (pluginOptions["allowLvl70Hard"]) allowedLevels.push(8, 13)
    if (pluginOptions["allowLvl80Hard"]) allowedLevels.push(9, 14)
    if (allowedLevels.length === 0) allowedLevels.push(7, 8, 9, 10, 11, 12, 13, 14)

    let areas = []

    const sendHit = async () => {
        const commander = await waitForCommanderAvailable(pluginOptions.commanderWhiteList, undefined,
            (a, b) => b.getEffects().lootBonus - a.getEffects().lootBonus)
        try {
            const attackInfo = await waitToAttack(async () => {
                let index = -1
                const timeSinceEpoch = Date.now()
                for (let i = 0; i < areas.length; i++) {
                    const areaInfo = areas[i]
                    if (movements.find(movement =>
                        movement.kingdomID == kingdomID &&
                        movement.targetAttack.x == areaInfo.x && movement.targetAttack.y == areaInfo.y))
                        continue
                    if ((areaInfo.timeSinceRequest + areaInfo.extraData[3] * 1000) - timeSinceEpoch > 0)
                        continue
                    await ClientCommands.preSpyInfo(areaInfo.x, areaInfo.y, kingdomID, false)
                    if (!allowedLevels.includes(areaInfo.extraData[2])) continue
                    if (timeSinceEpoch - (areaInfo.timeSinceRequest + areaInfo.extraData[3] * 1000) > 0) continue
                    index = i
                    break
                }
                if (index == -1) return

                const areaInfo = areas[index]
                const level = {
                    7: 60, 8: 70, 9: 80,
                    10: 40, 11: 50, 12: 60, 13: 70, 14: 80
                }[areaInfo.extraData[2]]

                const attackerMeleeTroops = []
                const attackerRangeTroops = []
                const attackerWallTools = []

                let totalAttackAvailable = 0
                let totalDefensive = 0
                let excludedBySettings = 0
                const allowedDetails = {}
                const excludedDetails = {}
                const defensiveDetails = {}

                for (let i = 0; i < (castle.unitInventory ?? []).length; i++) {
                    const unit = (castle.unitInventory ?? [])[i]
                    if (unit.amount <= 0) continue
                    if (unit.unitInfo.toolCategory) {
                        if (unit.unitInfo.usageEventID == undefined &&
                            unit.unitInfo.allowedToAttack == undefined &&
                            unit.unitInfo.typ == 'Attack' &&
                            unit.unitInfo.amountPerWave == undefined) {
                            if (unit.unitInfo.wallBonus) attackerWallTools.push(unit)
                        }
                    } else {
                        // It's a troop
                        const isAttack = (unit.unitInfo.fightType == 0)
                        if (isAttack) {
                            totalAttackAvailable += unit.amount
                            if (isTroopResourceTypeAllowed(unit.unitInfo, pluginOptions)) {
                                if (unit.unitInfo.role == "melee") attackerMeleeTroops.push(unit)
                                else if (unit.unitInfo.role == "ranged") attackerRangeTroops.push(unit)
                                
                                const name = unit.unitInfo.name || `Wod#${unit.wodID}`
                                allowedDetails[name] = (allowedDetails[name] || 0) + unit.amount
                            } else {
                                excludedBySettings += unit.amount
                                const name = unit.unitInfo.name || `Wod#${unit.wodID}`
                                excludedDetails[name] = (excludedDetails[name] || 0) + unit.amount
                            }
                        } else {
                            totalDefensive += unit.amount
                            const name = unit.unitInfo.name || `Wod#${unit.wodID}`
                            defensiveDetails[name] = (defensiveDetails[name] || 0) + unit.amount
                        }
                    }
                }

                let allTroopCount = 0
                orderTroopsByTypePreference(attackerMeleeTroops, pluginOptions)
                orderTroopsByTypePreference(attackerRangeTroops, pluginOptions)
                attackerRangeTroops.forEach(e => allTroopCount += e.amount)
                attackerMeleeTroops.forEach(e => allTroopCount += e.amount)

                if (allTroopCount < minTroopCount) {
                    throw {
                        type: "NO_MORE_TROOPS",
                        details: {
                            allTroopCount,
                            minTroopCount,
                            totalAttackAvailable,
                            totalDefensive,
                            excludedBySettings,
                            allowedDetails,
                            excludedDetails,
                            defensiveDetails
                        }
                    }
                }

                const commanderStats = commander.getEffects()
                const atkInfo = getAttackInfo(kingdomID, castle, areaInfo, commander, level, 3, pluginOptions, commanderStats.additionalWaves)
                const maxTroopFlank = getAmountSoldiersFlank(level, commanderStats.attackUnitAmountFlank)
                const maxToolsFlank = 10

                atkInfo.LP = 3
                atkInfo.A.forEach((wave, index) => {
                    let maxTroops = maxTroopFlank
                    let maxTools = maxToolsFlank
                    if (index == 0) {
                        wave.L.T.forEach(unitSlot => maxTools -= assignUnit(unitSlot, attackerWallTools, maxTools))
                    }
                    wave.L.U.forEach(unitSlot => maxTroops -= assignUnit(unitSlot, attackerMeleeTroops.length <= 0 ? attackerRangeTroops : attackerMeleeTroops, maxTroops))
                    maxTroops = maxTroopFlank
                    wave.R.U.forEach(unitSlot => maxTroops -= assignUnit(unitSlot, attackerMeleeTroops.length <= 0 ? attackerRangeTroops : attackerMeleeTroops, maxTroops))
                })

                await sendXT("cra", JSON.stringify(atkInfo))
                let [obj, result] = await waitForResult("cra", 1000 * 10, (obj, result) => {
                    if (result != 0) return true
                    if (obj.AAM.M.KID != kingdomID || obj.AAM.M.TA[1] != areaInfo.x || obj.AAM.M.TA[2] != areaInfo.y) return false
                    return true
                })
                if (result != 0) throw err[result]
                return obj
            })

            if (!attackInfo) {
                freeCommander(commander.lordID)
                return false
            }

            console.info("hittingTargetAttack", 'C', attackInfo.AAM.UM.L.VIS + 1, ' ', attackInfo.AAM.M.TA[1], ':', attackInfo.AAM.M.TA[2], " ", pretty(Math.round(1000000000 * Math.abs(Math.max(0, attackInfo.AAM.M.TT - attackInfo.AAM.M.PT))), 's'), "tillImpactAttack")
            return true
        } catch (e) {
            freeCommander(commander.lordID)
            const errType = e?.type || e
            switch (errType) {
                case "NO_MORE_TROOPS":
                    const details = e.details
                    const isAr = (i18n.getLocale() == 'ar')
                    if (isAr) {
                        console.info(`[العواصف] الانتظار لوجود المزيد من الجنود المسموحين للهجوم. (المطلوب: ${details.minTroopCount}، المتوفر حالياً: ${details.allTroopCount})`)
                        console.info(`[العواصف] تفاصيل الجيش بالقلعة:`)
                        console.info(`  - جنود هجوم مسموحين: ${details.allTroopCount} ${JSON.stringify(details.allowedDetails)}`)
                        if (details.excludedBySettings > 0) {
                            console.info(`  - جنود هجوم مستبعدين بسبب الإعدادات (نوع الجيش أو مستوى العسل): ${details.excludedBySettings} ${JSON.stringify(details.excludedDetails)}`)
                        }
                        if (details.totalDefensive > 0) {
                            console.info(`  - جنود دفاع (لا يمكنهم الهجوم): ${details.totalDefensive} ${JSON.stringify(details.defensiveDetails)}`)
                        }
                    } else {
                        console.info(`[Storm] Waiting for more allowed troops. (Required: ${details.minTroopCount}, currently available: ${details.allTroopCount})`)
                        console.info(`[Storm] Castle troop details:`)
                        console.info(`  - Allowed attacking troops: ${details.allTroopCount} ${JSON.stringify(details.allowedDetails)}`)
                        if (details.excludedBySettings > 0) {
                            console.info(`  - Attacking troops excluded by settings (troop type/mead level): ${details.excludedBySettings} ${JSON.stringify(details.excludedDetails)}`)
                        }
                        if (details.totalDefensive > 0) {
                            console.info(`  - Defensive troops (cannot attack): ${details.totalDefensive} ${JSON.stringify(details.defensiveDetails)}`)
                        }
                    }

                    await new Promise(resolve => movementEvents.on("return", function self(/** @type {import("../protocols.js").Types.Movement} */ movement) {
                        if (movement.kingdomID != kingdomID || movement.targetAttack.extraData[0] != castle.id) return
                        movementEvents.off("return", self)
                        resolve()
                    }))
                    return true
                case "LORD_IS_USED":
                    useCommander(commander.lordID)
                case "COOLING_DOWN":
                case "TIMED_OUT":
                case "MISSING_UNITS":
                case "CANT_START_NEW_ARMIES":
                    return true
                default:
                    throw e
            }
        }
    }

    done:
    for (let i = 0, j = 0; i < 13 * 13; i++) {
        let rX, rY, rect
        do {
            ;({ x: rX, y: rY } = spiralCoordinates(j++))
            rX *= 100
            rY *= 100
            rect = {
                x: castle.areaInfo.x + rX - 50,
                y: castle.areaInfo.y + rY - 50,
                w: castle.areaInfo.x + rX + 50,
                h: castle.areaInfo.y + rY + 50
            }
            if (j > Math.pow(13 * 13, 2)) break done
        } while ((castle.areaInfo.x + rX) <= -50 || (castle.areaInfo.y + rY) <= -50 || (castle.areaInfo.x + rX) >= (1286 + 50) || (castle.areaInfo.y + rY) >= (1286 + 50))

        rect.x = Math.max(0, Math.min(1286, rect.x))
        rect.y = Math.max(0, Math.min(1286, rect.y))
        rect.w = Math.max(0, Math.min(1286, rect.w))
        rect.h = Math.max(0, Math.min(1286, rect.h))

        areas.push(...(await ClientCommands.getAreaInfo(kingdomID, rect.x, rect.y, rect.w, rect.h))
            .areaInfo.filter(ai => ai.type == type).sort((a, b) =>
                (Math.pow(castle.areaInfo.x - a.x, 2) + Math.pow(castle.areaInfo.y - a.y, 2)) -
                (Math.pow(castle.areaInfo.x - b.x, 2) + Math.pow(castle.areaInfo.y - b.y, 2))))

        if (areas.every(ai => ![7, 8, 9].includes(ai.extraData[2]))) continue

        areas.sort((a, b) => {
            if ((a.extraData[2] % 10) > (b.extraData[2] % 10)) return -1
            if ((a.extraData[2] % 10) < (b.extraData[2] % 10)) return 1
            if (a.extraData[4] < b.extraData[4]) return -1
            if (a.extraData[4] > b.extraData[4]) return 1
            return 0
        })
        while (await sendHit());
    }

    while (true) {
        let minimumTimeTillHit = Infinity
        for (let i = 0; i < areas.length; i++) {
            const areaInfo = areas[i]
            if (!allowedLevels.includes(areaInfo.extraData[2]))
                if (((areaInfo.timeSinceRequest + areaInfo.extraData[3] * 1000) - Date.now()) <= 0)
                    continue
            if (movements.find(movement =>
                movement.kingdomID == kingdomID &&
                movement.targetAttack.x == areaInfo.x && movement.targetAttack.y == areaInfo.y))
                continue
            minimumTimeTillHit = Math.min(minimumTimeTillHit, (areaInfo.timeSinceRequest + areaInfo.extraData[3] * 1000))
        }

        let time = Math.max(0, minimumTimeTillHit - Date.now())
        console.info("waitingForNextPossibleHit", Math.round(time / 1000), "waitingForNextPossibleHit2")
        await new Promise(r => setTimeout(r, time).unref())
        while (await sendHit());
    }
})