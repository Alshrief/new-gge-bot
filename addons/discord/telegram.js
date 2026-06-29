if (require('node:worker_threads').isMainThread)
    return module.exports = {}

const { botConfig } = require("../../ggeBot.js")
const undici = require("undici")

const lastMessageIds = new Map()
const lastMessageTexts = new Map()

function formatForTelegram(text) {
    // Strip ANSI escape codes
    let formatted = text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?::[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    
    // Replace Discord timestamps: <t:1716300000:R> or similar with localized date time + remaining time
    formatted = formatted.replace(/<t:(\d+):[A-Za-z]>/g, (match, ts) => {
        const timestamp = Number(ts) * 1000
        const date = new Date(timestamp)
        const diffMs = timestamp - Date.now()
        const diffMins = Math.round(diffMs / 60000)
        
        let remaining = ""
        if (diffMins > 0) {
            remaining = ` (in ${diffMins}m)`
        } else if (diffMins === 0) {
            const diffSecs = Math.round(diffMs / 1000)
            if (diffSecs > 0) {
                remaining = ` (in ${diffSecs}s)`
            }
        }
        return `${date.toLocaleTimeString()}${remaining}`
    })
    
    // Replace Discord mentions <@123456789>
    formatted = formatted.replace(/<@\d+>/g, '')

    // Remove ```ansi tag but keep standard ``` for Telegram markdown
    formatted = formatted.replace(/```ansi/g, '```')

    return formatted
}

async function sendTelegramAlert(messageKey, text, imageStreamOrBuffer = null, alertType = null) {
    const tgData = botConfig.telegramData
    if (!tgData || !tgData.telegramEnabled || !tgData.telegramToken || !tgData.telegramChatId) {
        return
    }

    // 1. Check if blocked by admin
    if (alertType && tgData.allowedAlerts) {
        try {
            const allowed = typeof tgData.allowedAlerts === "string"
                ? JSON.parse(tgData.allowedAlerts)
                : tgData.allowedAlerts
            if (Array.isArray(allowed) && !allowed.includes(alertType)) {
                return // Blocked by admin!
            }
        } catch (e) {}
    }

    // 2. Check user's own toggle preference
    if (alertType && tgData.telegramAlertSettings) {
        try {
            const settings = typeof tgData.telegramAlertSettings === "string"
                ? JSON.parse(tgData.telegramAlertSettings)
                : tgData.telegramAlertSettings
            if (settings && settings[alertType] === false) {
                return
            }
        } catch (e) {
            // Default to sending if parsing fails
        }
    }

    const { telegramToken, telegramChatId } = tgData
    const formattedText = formatForTelegram(text)

    if (!imageStreamOrBuffer) {
        const lastText = lastMessageTexts.get(messageKey)
        if (lastText === formattedText) {
            return
        }
    }

    try {
        if (imageStreamOrBuffer) {
            let buffer;
            if (Buffer.isBuffer(imageStreamOrBuffer)) {
                buffer = imageStreamOrBuffer;
            } else {
                const chunks = [];
                for await (const chunk of imageStreamOrBuffer) {
                    chunks.push(chunk);
                }
                buffer = Buffer.concat(chunks);
            }

            const formData = new undici.FormData()
            formData.append("chat_id", telegramChatId)
            formData.append("caption", formattedText)
            formData.append("parse_mode", "Markdown")
            
            const blob = new undici.Blob([buffer], { type: "image/png" })
            formData.append("photo", blob, "layout.png")

            const response = await undici.request(`https://api.telegram.org/bot${telegramToken}/sendPhoto`, {
                method: "POST",
                body: formData
            })
            if (response.statusCode === 200) {
                const resBody = await response.body.json()
                if (resBody.ok && resBody.result) {
                    lastMessageIds.set(messageKey, resBody.result.message_id)
                }
            }
        } else {
            // Check if we should edit an existing message
            const existingMessageId = lastMessageIds.get(messageKey)
            if (existingMessageId) {
                try {
                    const response = await undici.request(`https://api.telegram.org/bot${telegramToken}/editMessageText`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            chat_id: telegramChatId,
                            message_id: existingMessageId,
                            text: formattedText,
                            parse_mode: "Markdown"
                        })
                    })
                    
                    if (response.statusCode === 200) {
                        const resBody = await response.body.json()
                        if (resBody.ok) {
                            lastMessageTexts.set(messageKey, formattedText)
                            return // Successfully edited
                        }
                    }
                } catch (e) {
                    // Fall back to sending a new message if edit fails
                }
            }

            // Send new message
            const response = await undici.request(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    chat_id: telegramChatId,
                    text: formattedText,
                    parse_mode: "Markdown"
                })
            })
            if (response.statusCode === 200) {
                const resBody = await response.body.json()
                if (resBody.ok && resBody.result) {
                    lastMessageIds.set(messageKey, resBody.result.message_id)
                    lastMessageTexts.set(messageKey, formattedText)
                }
            }
        }
    } catch (e) {
        console.warn("Failed to send Telegram message:", e)
    }
}

// Telegram command listener on worker thread
const { parentPort } = require('node:worker_threads')

if (parentPort) {
    parentPort.on('message', async (obj) => {
        if (Array.isArray(obj) && obj[0] === 'TelegramCommand') {
            const { command, chatId, token } = obj[1]
            await handleWorkerTelegramCommand(command, chatId, token)
        }
    })
}

async function handleWorkerTelegramCommand(commandText, chatId, token) {
    const parts = commandText.trim().split(/\s+/)
    const commandName = parts[0].toLowerCase()
    const argument = parts.slice(1).join(' ') || null

    let commandNameWithoutSlash = commandName.startsWith('/') ? commandName.slice(1) : commandName
    const atIndex = commandNameWithoutSlash.indexOf('@')
    if (atIndex !== -1) {
        commandNameWithoutSlash = commandNameWithoutSlash.substring(0, atIndex)
    }

    async function sendReply(text) {
        const formatted = formatForTelegram(text)
        try {
            await undici.request(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: formatted,
                    parse_mode: "Markdown"
                })
            })
        } catch (e) {
            console.warn("Failed to send command reply to Telegram:", e)
        }
    }

    // Ensure all slash commands are required and registered
    try {
        require("./slashCommands.js")
    } catch (e) {
        console.warn("Failed to load slashCommands in Telegram poller:", e)
    }
    try {
        require("../../addons-extra/discord/extraSlashCommands.js")
    } catch (e) {
        // extra commands might not be present or licensed
    }

    const { commands } = require("./discord.js")
    let targetCommandName = commandNameWithoutSlash
    if (targetCommandName === 'berimond') {
        targetCommandName = 'battle-for-berimond'
    } else if (targetCommandName === 'storm_top_players' || targetCommandName === 'stormtopplayers') {
        targetCommandName = 'storm-top-players'
    }

    let cmd = commands.get(targetCommandName)
    if (!cmd && targetCommandName === 'loot') {
        cmd = commands.get('external_loot')
    } else if (!cmd && targetCommandName === 'external_loot') {
        cmd = commands.get('loot')
    }

    if (!cmd) {
        const mainThreadCommands = ['/start', '/help', '/status', '/alerts_on', '/alerts_off', '/settings', 
                                    '/toggle_incoming_me', '/toggle_incoming_alliance', '/toggle_outgoing_me', 
                                    '/toggle_outgoing_alliance', '/toggle_chat', '/toggle_fortress', 
                                    '/toggle_errors', '/toggle_system']
        const isMainThreadText = mainThreadCommands.includes(commandName) || 
                                 commandName.includes('📋') || 
                                 commandName.includes('📊') || 
                                 commandName.includes('❓') ||
                                 commandText.toLowerCase().includes('control panel') ||
                                 commandText.toLowerCase().includes('status report') ||
                                 commandText.toLowerCase().includes('help & commands')

        if (isMainThreadText) {
            return // handled by main thread
        }
        await sendReply(`❓ *Unknown Command.* Type /help to see all available commands.`)
        return
    }

    let messageId = null
    const mockInteraction = {
        options: {
            getString: (name) => {
                if (name === 'name') return argument
                return null
            }
        },
        deferReply: async () => {
            try {
                const response = await undici.request(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: "⏳ _Processing request..._"
                    })
                })
                if (response.statusCode === 200) {
                    const resBody = await response.body.json()
                    if (resBody.ok && resBody.result) {
                        messageId = resBody.result.message_id
                    }
                }
            } catch (e) {
                console.warn("Telegram mock deferReply failed:", e)
            }
        },
        editReply: async (replyData) => {
            let text = typeof replyData === "string" ? replyData : (replyData.content || "")
            text = formatForTelegram(text)

            if (messageId) {
                try {
                    await undici.request(`https://api.telegram.org/bot${token}/editMessageText`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            chat_id: chatId,
                            message_id: messageId,
                            text: text,
                            parse_mode: "Markdown"
                        })
                    })
                } catch (e) {
                    console.warn("Telegram mock editReply failed:", e)
                }
            } else {
                await sendReply(text)
            }
        },
        reply: async (replyData) => {
            let text = typeof replyData === "string" ? replyData : (replyData.content || "")
            await sendReply(text)
        }
    }

    try {
        await cmd.execute(mockInteraction)
    } catch (error) {
        console.error(`Error executing Telegram command ${commandName}:`, error)
        if (messageId) {
            try {
                await undici.request(`https://api.telegram.org/bot${token}/editMessageText`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        message_id: messageId,
                        text: `❌ *Error executing command:* ${error.message || error}`
                    })
                })
            } catch (e) {}
        } else {
            await sendReply(`❌ *Error executing command:* ${error.message || error}`)
        }
    }
}

module.exports = { sendTelegramAlert }
