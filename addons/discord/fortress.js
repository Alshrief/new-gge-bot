if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            {
                type: "Channel",
                key: "channelID"
            }
        ]
    }

const pretty = require('pretty-time')
const { events, botConfig } = require("../../ggeBot.js")
const { ClientCommands: { preSpyInfo, getAreaInfo }, spiralCoordinates, castles, AreaType } = require("../../protocols")
const { client } = require("./discord.js")
const { sendTelegramAlert } = require("./telegram.js")

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}
const type = 11

events.once("load", async () => {
    /** @type {Array<import("../../protocols.js").Types.GAAAreaInfo>} */
    const areas = []

    for (let kingdomID = 1; kingdomID < 4; kingdomID++) {
        const castle = castles.find(e => e.kingdomID == kingdomID && [AreaType.externalKingdom, AreaType.mainCastle].includes(e.areaInfo.type))
        done:
        for (let i = 0, j = 0; i < 13 * 13; i++) {
            let rX, rY
            let rect
            do {
                ({ x: rX, y: rY } = spiralCoordinates(j++))
                rX *= 100
                rY *= 100

                rect = {
                    x: castle.areaInfo.x + rX - 50,
                    y: castle.areaInfo.y + rY - 50,
                    w: castle.areaInfo.x + rX + 50,
                    h: castle.areaInfo.y + rY + 50
                }
                if (j > Math.pow(13 * 13, 2))
                    break done
            } while ((castle.areaInfo.x + rX) <= -50 || (castle.areaInfo.y + rY) <= -50 || (castle.areaInfo.x + rX) >= (1286 + 50) || (castle.areaInfo.y + rY) >= (1286 + 50))
            rect.x = rect.x < 0 ? 0 : rect.x
            rect.y = rect.y < 0 ? 0 : rect.y
            rect.w = rect.w < 0 ? 0 : rect.w
            rect.h = rect.h < 0 ? 0 : rect.h
            rect.x = rect.x > 1286 ? 1286 : rect.x
            rect.y = rect.y > 1286 ? 1286 : rect.y
            rect.w = rect.w > 1286 ? 1286 : rect.w
            rect.h = rect.h > 1286 ? 1286 : rect.h
            let attemptsLeft = 5
            do {
                try {
                    const res = await getAreaInfo(kingdomID, rect.x, rect.y, rect.w, rect.h)
                    if (res && res.areaInfo) {
                        areas.push(...res.areaInfo.filter(e => e.type == type))
                    }
                    break
                }
                catch { attemptsLeft-- }
                if (attemptsLeft <= 0)
                    continue done
            } while (true)
        }
    }

    const sortData = () => {
        const KIDPOW = [, 1, 0, 3]

        areas.sort((a, b) => KIDPOW[a.extraData[4]] - KIDPOW[b.extraData[4]]).sort((a, b) =>
            a.extraData[2] - b.extraData[2])
    }

    sortData()

    const KingdomNames = [,
        "\u001b[2;33mBurning Sands\u001b[0m     ",
        "\u001b[2;34mEverwinter Glacier\u001b[0m",
        "\u001b[2;31mFire peaks\u001b[0m        "
    ]

    setInterval(async () => {
        const date = Date.now()
        let msg = "```ansi\nLocation           Coords  Time\n"
        let everwinterGlacier = 0

        areas.every(areaInfo => {
            const kingdomID = areaInfo.extraData[4]
            const deltaTime = areaInfo.extraData[2] - (date - areaInfo.timeSinceRequest) / 1000

            if (kingdomID == 2 && everwinterGlacier++ >= 15)
                return true

            if (deltaTime <= 0)
                preSpyInfo(areaInfo.x, areaInfo.y, kingdomID).then(({ areaInfo }) =>
                    areaInfo.extraData[2] > 0 && sortData())

            msg += `${KingdomNames[kingdomID]} ${areaInfo.x}\:${areaInfo.y} ${pretty(Math.max(0, Math.round(1000000000 * deltaTime)), 's')}\n`

            if (msg.length > 2000 - 3)
                return (msg = msg.replace(/\n.*\n$/, ''), false)

            return true
        })

        msg += "```"

        let channel = null
        let message = null
        if (client) {
            try {
                channel = await client.channels.fetch(pluginOptions.channelID)
                message = (await channel.messages.fetch({ limit: 1 })).first()
                if (!message?.editable || message.author.id != client.user.id)
                    message = await channel.send({ content: "```Loading...```", flags: [4096] })
            } catch (e) {
                console.warn(e)
            }
        }

        await sendTelegramAlert("fortress", msg, null, "fortress")

        if (message) {
            if (message.content == msg)
                return
            await message.edit(msg)
        }
    }, 6 * 1000).unref()
})