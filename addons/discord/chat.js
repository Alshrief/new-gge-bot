if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            {
                type: "Channel",
                key: "channelID",
            },

            {
                type: "Checkbox",
                key: "hideDiscordName",
                default: false
            }
        ]
    }

const turl = require("turl")
const emoji = require("emoji-dictionary")
const { xtHandler, sendXT, botConfig } = require("../../ggeBot.js")
const { clientReady } = require("./discord")
const { sendTelegramAlert } = require("./telegram.js")

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}

function parseMessage(e) {
    return e ? e.replace(/&percnt;/g, "%")
        .replace(/&quot;/g, '"')
        .replace(/&145;/g, "'")
        .replace(/<br \/>/g, "\n")
        .replace(/%5C/g, "\\")
        .replace(/(\[|\])/g, " ") : ""
}
const cleanUnmatchedTags = t =>
    t.replace(/<(?![^<>]*>)/g, '').replace(/(?<!<[^<>]*)>/g, '')

function unparseMessage(e) {
    if (!e)
        return ""
    
    return cleanUnmatchedTags(e).replace(/<.*?>/g, m => {
        if (m.match(/<\/?color.*?>/))
            return m
        if (m.match(/<\/?b>/))
            return m
        if (m.match(/<\/?br>/))
            return m
        if (m.match(/<\/?a.*?>/))
            return m

        return ""
    }).replaceAll("%", "&percnt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&145;")
        .replaceAll("\n", "<br>")
        .replaceAll("\\", "%5C")
        .replaceAll(/(\[|\])/g, " ")
}
clientReady.then(async client => {
    let channel = null
    if (client) {
        try {
            channel = await client.channels.fetch(pluginOptions.channelID)
        } catch (e) {
            console.warn(e)
        }
    }
    xtHandler.on("acm", obj => {
        if (obj.CM.PN.toLowerCase() == botConfig.name.toLowerCase())
            return

        if (channel) {
            channel.send(obj.CM.PN + ": " + parseMessage(obj.CM.MT))
        }
        sendTelegramAlert(`chat_${Date.now()}_${obj.CM.PN}`, obj.CM.PN + ": " + parseMessage(obj.CM.MT), null, "chat")
    })
    if (client) {
        client.on("messageCreate", async message => {
            if (message.author.bot)
                return

            if(message.channel.id != pluginOptions.channelID)
                return

            let msg = message.content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
            msg.match(/\p{Emoji_Presentation}/gu)?.forEach(element => {
                if (emoji.getName(element) == "slightly_smiling_face")
                    msg = msg.replace(element, ":)")
                else if (emoji.getName(element) == "smile")
                    msg = msg.replace(element, ":D")
                else if (emoji.getName(element) == "frowning")
                    msg = msg.replace(element, ":(")
                else if (emoji.getName(element) == "sob")
                    msg = msg.replace(element, ";(")
                else if (emoji.getName(element) == "wink")
                    msg = msg.replace(element, ";)")
                else if (emoji.getName(element) == undefined)
                    msg = msg.replace(element, "")
                else
                    msg = msg.replace(element, ":" + emoji.getName(element) + ":")
            })

            if (message.attachments.size > 0) {
                if (msg != "")
                    msg += "<br>"
                msg += "attached: "
            }
            let i = 0
            for await (const [, attachment] of message.attachments.entries()) {
                msg += `<a href="${await turl.shorten(attachment.proxyURL)}">${i++}</a> `
            }

            if (msg == "")
                return
            
            const name = "<color=" + message.member.displayHexColor + ">" + ((message.member.nickname != null) ? message.member.nickname : message.author.displayName) + "<color>"

            sendXT("acm", JSON.stringify({ 
                M: unparseMessage(`${!pluginOptions.hideDiscordName ? unparseMessage(name) + ": " : ""} ${msg}`)
            }))
        })
    }
})