if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            {
                type: "Channel",
                key: "channelID"
            }
        ]
    }

const { AttachmentBuilder } = require("discord.js")

const { botConfig, playerInfo, i18n } = require("../../ggeBot.js")
const { movementEvents, KingdomID } = require("../../protocols.js")
const { createLayout } = require("../../imageGen.js")
const { clientReady, client } = require("./discord.js")
const { sendTelegramAlert } = require("./telegram.js")

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}

const kingdomName = [
    `\u001b[2;32m${i18n.__(KingdomID[0])}\u001b[0m`,
    `\u001b[2;33m${i18n.__(KingdomID[1])}\u001b[0m`,
    `\u001b[2;34m${i18n.__(KingdomID[2])}\u001b[0m`,
    `\u001b[2;31m${i18n.__(KingdomID[3])}\u001b[0m`,
    `\u001b[2;36m${i18n.__(KingdomID[4])}\u001b[0m`
]

movementEvents.on("outgoing", async (/** @type {import("../../protocols.js").ClassTypes.Movement} */ movement) => {
    await clientReady

    if (![0, 25, 31, 24, 29].includes(movement.type))
        return
    if (movement.sourceOwner.ownerID < 0)
        return
    if (movement.targetOwner.ownerID < 0)
        return
    if (movement.sourceOwner.allianceID != playerInfo.alliance.id)
        return
    if (movement.targetOwner.allianceID == playerInfo.alliance.id)
        return

    if (kingdomName[movement.kingdomID] == undefined)
        return

    const timeLeft = (movement.totalTime - (movement.deltaTime - Date.now())) / 1000

    let channel = null
    if (client) {
        try {
            channel = await client.channels.fetch(pluginOptions.channelID)
        }
        catch (e) {
            console.warn(e)
        }
    }

    const clicks = Math.round(Math.sqrt(Math.pow(movement.sourceAttack.x - movement.targetAttack.x, 2) + Math.pow(movement.sourceAttack.y - movement.targetAttack.y, 2)) * 10) / 10

    const data = {}
    data.content = "```ansi\n" +
        `${movement.targetOwner.name} (${movement.targetAttack.extraData[7]})` +
        `${i18n.__("incomingFrom")}${movement.targetOwner.allianceName}` +
        `${i18n.__("incomingIsAttacking")}${movement.sourceOwner.name}` +
        ` (${movement.sourceAttack.extraData[7]})${i18n.__("incomingIn")}` +
        `${kingdomName[movement.kingdomID]} ${clicks}${i18n.__("incomingClicks")}` +
        "```" +
        `<t:${Math.round(Date.now() / 1000 + timeLeft)}:R>`
    data.files = [new AttachmentBuilder(await createLayout(movement.left, movement.middle, movement.right,movement.courtyard))]
    
    if (channel) {
        channel.send(data)
    }

    const tgText = "```ansi\n" +
        `${movement.targetOwner.name} (${movement.targetAttack.extraData[7]})` +
        `${i18n.__("incomingFrom")}${movement.targetOwner.allianceName}` +
        `${i18n.__("incomingIsAttacking")}${movement.sourceOwner.name}` +
        ` (${movement.sourceAttack.extraData[7]})${i18n.__("incomingIn")}` +
        `${kingdomName[movement.kingdomID]} ${clicks}${i18n.__("incomingClicks")}` +
        "```" +
        `<t:${Math.round(Date.now() / 1000 + timeLeft)}:R>`
    
    const tgImage = await createLayout(movement.left, movement.middle, movement.right, movement.courtyard)
    const isMe = movement.sourceOwner.ownerID === playerInfo.playerID
    const alertType = isMe ? "outgoingMe" : "outgoingAlliance"
    sendTelegramAlert(`outgoing_${Date.now()}_${movement.targetOwner.name}`, tgText, tgImage, alertType)
})