if (require('node:worker_threads').isMainThread)
    return module.exports = {
        pluginOptions: [
            {
                type: "Channel",
                key: "channelID"
            }
        ]
    }

const { events, botConfig } = require("../../ggeBot.js")
const { ClientCommands: { preSpyInfo }, castles, spiralCoordinates, KingdomID, AreaType, ClientCommands, unlockInfoList } = require("../../protocols.js")
const { client } = require("./discord.js")
const { sendTelegramAlert } = require("./telegram.js")

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}
const type = AreaType.stormTower
const kingdomID = KingdomID.stormIslands

events.once("load", async () => {
    const castle = castles.find(e => e.kingdomID == kingdomID && [AreaType.externalKingdom, AreaType.mainCastle].includes(e.areaInfo.type))

    if (!unlockInfoList.find(e => e.kingdomID == kingdomID)?.isUnlocked)
        return console.warn("wontRunWithoutStormUnlocked")
    
    /** @type {Array<import("../../protocols.js").Types.GAAAreaInfo>} */
    const areas = []
    done:
    for (let i = 0, j = 1; i < 13 * 13; i++) {
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
        while (true) {
            try {
                areas.push(...(await ClientCommands.getAreaInfo(kingdomID, rect.x, rect.y, rect.w, rect.h))
                    .areaInfo.filter(ai => ai.type == type))
                break
            }
            catch { attemptsLeft-- }
            if (attemptsLeft <= 0)
                continue done
        }
    }
    const sortData = () => {
        areas.sort((a, b) => a.extraData[4] - b.extraData[4])
            .sort((a, b) => (b.extraData[2] % 10) - (a.extraData[2] % 10))
            .sort((a, b) => a.extraData[3] - b.extraData[3])
    }

    sortData()

    const toLevel = {
        7: 60,
        8: 70,
        9: 80,
        10: 40,
        11: 50,
        12: 60,
        13: 70,
        14: 80,
    }

    setInterval(async () => {
        const date = Date.now()
        let msg = "```Location             Hits left\n"

        areas.every(areaInfo => {
            const deltaTime = areaInfo.extraData[3] - (date - areaInfo.timeSinceRequest) / 1000
            const type = areaInfo.extraData[2]
            const hitsLeft = 10 - areaInfo.extraData[4]
            
            if(deltaTime > 0)
                return false

            if (deltaTime <= 0)
                preSpyInfo(areaInfo.x, areaInfo.y, kingdomID).then(({ areaInfo: area }) =>
                    area.extraData[3] > 0 && sortData())

            msg += `${areaInfo.x}\:${areaInfo.y} lv ${toLevel[type]} (${[7, 8, 9].includes(type) ? "Easy" : "Hard"}) ${hitsLeft}\n`

            if (msg.length >= 2000 - 3)
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

        await sendTelegramAlert("aquaTower", msg, null, "fortress")

        if (message) {
            if (message.content == msg)
                return
            await message.edit(msg)
        }
    }, 6 * 1000).unref()
})