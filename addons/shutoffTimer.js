const { isMainThread, parentPort } = require('node:worker_threads')

if (isMainThread) {
    module.exports = {
        pluginOptions: [
            {
                type: "Text",
                key: "hours",
                default: "2"
            }
        ]
    }
    
    return
}

const ActionType = require("../actions.json")
const { botConfig, events } = require("../ggeBot.js")
const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}

if (isNaN(Number(pluginOptions.hours)))
    return console.error("hoursOptionIsNotNumber")

events.once("load", () => {
    setTimeout(() => 
        parentPort.postMessage([ActionType.KillBot]),
        Number(pluginOptions.hours) * 1000 * 60 * 60)
})