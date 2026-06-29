if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            {
                type: "Checkbox",
                key: "fastHelp",
                default: false
            }
        ]
    }

const { xtHandler, sendXT, botConfig } = require("../ggeBot.js")

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}

const randomIntFromInterval = (min, max) => 
    Math.floor(Math.random() * (max - min + 1) + min)

let sentRequest = false
xtHandler.on("ahh", () => {
    let rndInt = 1
    if (sentRequest)
        return

    sentRequest = true

    if (pluginOptions.fastHelp)
        rndInt = randomIntFromInterval(1, 5)
    else
        rndInt = randomIntFromInterval(60, 60 * 2)

    setTimeout(async () => {
        sendXT("aha", JSON.stringify({ KID: 15 }))
        sentRequest = false
    }, rndInt * 1000)
})