if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            {
                type: "Channel",
                key: "channelID"
            }, 
            {
                type: "Channel",
                key: "stormChannelID"
            }
        ]
    }

const { PresenceUpdateStatus, AttachmentBuilder } = require("discord.js")

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

const storedMessages = new WeakMap()

movementEvents.on("outgoing", async (/** @type {import("../../protocols.js").ClassTypes.Movement} */ movement) => {
    await clientReady

    if (![0, 25, 31, 24, 29].includes(movement.type))
        return
    if (movement.sourceOwner.ownerID < 0)
        return
    if (movement.targetOwner.ownerID < 0)
        return
    if (movement.sourceOwner.allianceID == playerInfo.alliance.id)
        return
    if (movement.targetOwner.allianceID != playerInfo.alliance.id)
        return

    if (kingdomName[movement.kingdomID] == undefined)
        return

    const isMe = movement.targetOwner.ownerID === playerInfo.playerID
    const alertType = isMe ? "incomingMe" : "incomingAlliance"

    if (movement.canSeeArmy) {
        const message = await storedMessages.get(movement)
        if (message) {
            if (message?.attachments.size == 0) {
                const stream = await createLayout(movement.left, movement.middle, movement.right, movement.courtyard)
                stream.on("error", console.warn)
                message.edit({
                    content: message.content,
                    files: [
                        new AttachmentBuilder(stream)
                    ]
                })
            }
            if (movement.telegramMessageKey) {
                const streamForTg = await createLayout(movement.left, movement.middle, movement.right, movement.courtyard)
                sendTelegramAlert(movement.telegramMessageKey, message.content, streamForTg, alertType)
            }
            return
        }
    }

    const timeLeft = (movement.totalTime - (movement.deltaTime - Date.now())) / 1000

    let channelAlert = null
    let channelAquaAlert = null
    let channel = null
    let member = null

    if (client) {
        try {
            channelAlert = await client.channels.fetch(pluginOptions.channelID)
        }
        catch (e) {
            console.warn(e)
        }
        try {
            if (pluginOptions.channelAquaAlert)
                channelAquaAlert = await client.channels.fetch(pluginOptions.stormChannelID)
        }
        catch (e) {
            console.warn(e)
        }
        channel = movement.kingdomID != 4 ? channelAlert : channelAquaAlert
        if (channelAlert) {
            member = channelAlert.members.find(e => e.displayName == (botConfig.externalEvent ? movement.targetOwner.name.replace(/_[^_]+$/, '') : movement.targetOwner.name))
        }
    }

    const clicks = Math.round(Math.sqrt(Math.pow(movement.sourceAttack.x - movement.targetAttack.x, 2) + Math.pow(movement.sourceAttack.y - movement.targetAttack.y, 2)) * 10) / 10

    const mention = member?.displayName ? `<@${member.id}> ` : ``
    const data = {
        content : `${mention}` +
        "```ansi\n" +
        `${movement.sourceOwner.name} (${movement.sourceAttack.extraData[7]})${i18n.__("incomingFrom")}${movement.sourceOwner.allianceName}` +
        `${i18n.__("incomingIsAttacking")}${movement.targetOwner.name} (${movement.targetAttack.extraData[7]})${i18n.__("incomingIn")}${kingdomName[movement.kingdomID]} ${clicks}${i18n.__("incomingClicks")}` +
        "```" +
        `<t:${Math.round(Date.now() / 1000 + timeLeft)}:R>`
    }

    if (movement.canSeeArmy)
        data.files = [new AttachmentBuilder(await createLayout(movement.left, movement.middle, movement.right,movement.courtyard))]
    
    if (channel) {
        storedMessages.set(movement, channel.send(data))
    }

    movement.telegramMessageKey = `incoming_${Date.now()}_${movement.sourceOwner.name}`
    let tgImage = null
    if (movement.canSeeArmy) {
        tgImage = await createLayout(movement.left, movement.middle, movement.right, movement.courtyard)
    }
    
    let tgHeader = ""
    if (isMe) {
        tgHeader = `🚨🚨 *تنبيه: هجوم وارد على حسابك! (INCOMING ATTACK ON YOU!)* 🚨🚨\n\n`
    }
    
    const tgText = tgHeader + `${member?.displayName ? member.displayName + ' ' : ''}` +
        "```ansi\n" +
        `${movement.sourceOwner.name} (${movement.sourceAttack.extraData[7]})${i18n.__("incomingFrom")}${movement.sourceOwner.allianceName}` +
        `${i18n.__("incomingIsAttacking")}${movement.targetOwner.name} (${movement.targetAttack.extraData[7]})${i18n.__("incomingIn")}${kingdomName[movement.kingdomID]} ${clicks}${i18n.__("incomingClicks")}` +
        "```" +
        `<t:${Math.round(Date.now() / 1000 + timeLeft)}:R>`
    sendTelegramAlert(movement.telegramMessageKey, tgText, tgImage, alertType)

    if (client && member != undefined) {
        if (movement.kingdomID != KingdomID.stormIslands && shouldAlertMember()) {
            const spreadAlert = () =>
                (member?.presence?.status == undefined ||
                    member?.presence?.status !== PresenceUpdateStatus.Online &&
                    member?.presence?.status !== PresenceUpdateStatus.DoNotDisturb) ? channelAlert.send(`<@${member.id}> `) : undefined
            setTimeout(spreadAlert, timeLeft * 1000 / 4).unref()
            setTimeout(spreadAlert, timeLeft * 1000 / 3).unref()
            setTimeout(spreadAlert, timeLeft * 1000 / 2).unref()
            setTimeout(spreadAlert, timeLeft * 1000 / 1.5).unref()
        }
    }
})