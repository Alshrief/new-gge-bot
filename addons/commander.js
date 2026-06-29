if (require('node:worker_threads').isMainThread)
    return module.exports = { hidden: true }

const { xtHandler, playerInfo, waitForResult, botConfig } = require('../ggeBot.js')
const { ClassTypes: { Lord }, movementEvents } = require('../protocols.js')

const event = new EventTarget()
/** @type {Array<Number>} */
let usedCommanders = []
/** @type {Array<import("../protocols.js").ClassTypes.Lord>} */
let commanders = []

xtHandler.on("gli", (obj, r) => !r ?
    commanders = Array.from(obj.C).map(e => new Lord(e)) : undefined)

function freeCommander(lordID) {
    const index = usedCommanders.findIndex(e => e == lordID)
    if (index == -1)
        return

    usedCommanders.splice(index, 1)
    event.dispatchEvent(new CustomEvent('freedCommander', { detail: lordID }))
}
function useCommander(lordID) {
    if (!usedCommanders.includes(lordID))
        usedCommanders.push(lordID)

    return lordID
}

movementEvents.on("outgoing", (/** @type {import("../protocols.js").ClassTypes.Movement} */ movement) => {
    if (movement.owner.ownerID != playerInfo.playerID)
        return

    // console.log(`using: ${movement.lord.lordID}`)

    useCommander(movement.lord.lordID)
})

movementEvents.on("return", (/** @type {import("../protocols.js").ClassTypes.Movement} */ movement) => {
    if (movement.targetOwner.ownerID != playerInfo.playerID)
        return

    // console.log(`freeing: ${movement.lord.lordID}`)

    freeCommander(movement.lord.lordID)
})
/**
 * 
 * @param {string} commanderWhitelist 
 * @param {filterCallback} filterCallback 
 * @param {sortCallback} sortCallback 
 * @returns 
 */

function parseWhitelist(whitelist) {
    if ([, 0, ""].includes(whitelist)) return []
    if (Array.isArray(whitelist)) return whitelist
    return String(whitelist)
        .split(",")
        .map(e => e.trim())
        .filter(e => e !== "")
        .map(e => {
            let [start, end] = e.split("-").map(Number)
            if (isNaN(start)) return []
            return Array.from({ length: (isNaN(end) ? start : end) - start + 1 }, (_, i) => start + i)
        }).flat()
}

const waitForCommanderAvailable = async (commanderWhitelist, filterCallback, sortCallback) => {
    // 1. Identify the calling plugin key from the call stack
    let callingPluginKey = null
    const stack = new Error().stack
    if (botConfig && botConfig.plugins) {
        for (const [key, val] of Object.entries(botConfig.plugins)) {
            const targetPath = (val.filename || "").replace(/[\\/]/g, require("path").sep)
            if (val.state && targetPath && stack.includes(targetPath)) {
                callingPluginKey = key
                break
            }
        }
    }

    // 2. Parse the whitelist for the calling plugin
    const parsedWhitelist = parseWhitelist(commanderWhitelist)

    if (commanders.length == 0)
        commanders = Array.from((await waitForResult("gli", 1000 * 10))[0].C)
            .map(e => new Lord(e))



    // 4. Build active whitelist from parsed positions
    //    If user provided a whitelist, use it directly (no filtering against existing positions).
    //    This ensures we respect exactly what the user specified.
    let activeWhitelist = null
    if (parsedWhitelist.length > 0) {
        // Use the whitelist exactly as provided by the user
        activeWhitelist = parsedWhitelist
    }

    let usableCommanders = commanders.filter(e =>
    ((!activeWhitelist || activeWhitelist.includes(e.lordPosition + 1)) &&
        !usedCommanders.includes(e.lordID)))

    if (sortCallback)
        usableCommanders.sort(sortCallback)
    if (filterCallback)
        usableCommanders = usableCommanders.filter(filterCallback)

    let lordID = usableCommanders[0]?.lordID

    lordID ??= await new Promise(resolve => {
        const checkForCommander = currentEvent => {
            const commander = commanders.find(e => e.lordID == currentEvent.detail)
            if (activeWhitelist && !activeWhitelist.includes(commander.lordPosition + 1))
                return
            if (!(!filterCallback || filterCallback(commander)))
                return

            event.removeEventListener("freedCommander", checkForCommander)
            currentEvent.stopImmediatePropagation()
            resolve(currentEvent.detail)
        }
        event.addEventListener("freedCommander", checkForCommander)
    })

    useCommander(lordID)
    return commanders.find(e => e.lordID == lordID)
}

/**
 * @callback filterCallback
 * @param {import("../protocols.js").ClassTypes.Lord}
 * @callback sortCallback
 * @param {import("../protocols.js").ClassTypes.Lord}
 * @param {import("../protocols.js").ClassTypes.Lord}
 */

module.exports = {
    movementEvents,
    waitForCommanderAvailable,
    useCommander,
    freeCommander
}