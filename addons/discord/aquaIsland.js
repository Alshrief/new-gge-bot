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
const { ClientCommands: { preSpyInfo }, castles, spiralCoordinates, KingdomID, AreaType, ClientCommands, unlockInfoList } = require("../../protocols.js")
const { client } = require("./discord.js")
const { sendTelegramAlert } = require("./telegram.js")

const pluginOptions = botConfig.plugins[require("path").basename(__filename).slice(0, -3)] ?? {}
const type = AreaType.stormIsland
const kingdomID = KingdomID.stormIslands

events.once("load", async () => {
    if (!unlockInfoList.find(e => e.kingdomID == kingdomID)?.isUnlocked)
        return console.warn("wontRunWithoutStormUnlocked")
    const castle = castles.find(e => e.kingdomID == kingdomID && [AreaType.externalKingdom, AreaType.mainCastle].includes(e.areaInfo.type))

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
        while(true) {
            try {
                areas.push(...(await ClientCommands.getAreaInfo(kingdomID, rect.x, rect.y, rect.w, rect.h)).areaInfo
                    .filter(ai => ai.type == type)
                    .filter(ai => [3, 6].includes(ai.extraData[5])))
                    break
            }
            catch { 
                attemptsLeft-- 
            }
            if (attemptsLeft <= 0)
                continue done
        } 
        
    }
    const sortData = () => { //6 is small
        areas.sort((a, b) => b.extraData[5] - a.extraData[5])
            .sort((a, b) => a.extraData[6] - b.extraData[6])
            .sort((a, b) => a.extraData[1] - b.extraData[1])
    }

    sortData()

    setInterval(async () => {
        const date = Date.now()
        let msg = "```Coords  Time\n"

        areas.every(areaInfo => {
            const deltaTime = areaInfo.extraData[6] - (date - areaInfo.timeSinceRequest) / 1000
            const playerId = areaInfo.extraData[1]
            const isSmallIsland = areaInfo.extraData[5] == 6
            
            if(playerId > 0)
                return false

            if (deltaTime <= 0)
                preSpyInfo(areaInfo.x, areaInfo.y, kingdomID).then(({ areaInfo: area }) =>
                    area.extraData[6] > 0 && sortData())

            let hour12 = new Date((deltaTime + 3600) * 1000 + date).toLocaleTimeString()
            if (hour12.length <= 10)
                hour12 += ' '

            msg += `${areaInfo.x}\:${areaInfo.y}   ${isSmallIsland ? "(Small)" : "(Big)  "} ${hour12} ${pretty(Math.round(Math.max(0, Math.round(1000000000 * deltaTime))), 's')}\n`

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

        await sendTelegramAlert("aquaIsland", msg, null, "fortress")

        if (message) {
            if (message.content == msg)
                return
            await message.edit(msg)
        }
    }, 6 * 1000).unref()
})