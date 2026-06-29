if (require('node:worker_threads').isMainThread)
    return module.exports = {}

const { SlashCommandBuilder, Interaction } = require('discord.js')
const { commands } = require("./discord.js")
const { xtHandler, sendXT, waitForResult, events, botConfig, playerInfo } = require("../../ggeBot.js")
const { ClientCommands, HighscoreType, AreaType, castles, KingdomID } = require("../../protocols.js")
const ggeConfig = require("../../ggeConfig.json")

let playerids = []
async function getStormRanks(i) {
    await i.deferReply()
    if (playerids.length == 0) {
        try {
            await sendXT("hgh", JSON.stringify({ LT: 2, SV: `` }))
            let [obj2, _2] = await waitForResult("hgh", 1000 * 60 * 5, (obj, result) => {
                if (result != 0)
                    return false

                if (obj.LT != 2 || obj.SV != ``)
                    return false
                return true
            })
            let promises = []
            for (let j = 1; j + 1 <= 3000; j += 8) {
                promises.push((async () => {
                    try {
                        await sendXT("hgh", JSON.stringify({ LT: 2, SV: `${j}` }))
                        let [obj, _2] = await waitForResult("hgh", 1000 * 60 * 5, (obj, result) => {
                            if (result != 0)
                                return false

                            if (obj.LT != 2 || obj.SV != `${j}`)
                                return false
                            return true
                        })

                        obj.L.forEach(e => {
                            if (e[2].R)
                                return
                            if (!playerids.every(a => a != e[2].OID))
                                return

                            playerids.push(e[2].OID)
                        })
                    }
                    catch (e) {
                        console.warn(j)
                    }
                })())

                await Promise.all(promises)
            }
        }
        catch (e) {
            console.error(e)
        }
    }
    let lootTable = []
    await Promise.all(playerids.map(async (pid) => {
        try {
            await sendXT("gpe", JSON.stringify({ PID: pid, EID: 102 }))
            let [obj, _2] = await waitForResult("gpe", 1000 * 60, (obj, result) => {
                if (result != 0)
                    return false

                if (obj.PID != pid || obj.EID != 102)
                    return false
                return true
            })

            lootTable.push([obj.NOM, obj.AMT])
        }
        catch (e) {
            console.error(e)
        }
    }))
    lootTable.sort((a, b) => b[1] - a[1])

    let msg = ""

    for (let i = 0; i < lootTable.length; i++) {
        const element = lootTable[i]
        msg += `${i + 1}. ${element[0]} ${element[1].toLocaleString()}\n`
        if (i > 50)
            break
    }
    while (msg.length >= 2000 - 6)
        msg = msg.replace(/\n.*$/, '')
    await i.editReply("```" + msg + "```")
}

async function getAllianceEventRank(interaction, LT) {
    let getAllianceByName = (name) => new Promise(async (resolve, reject) => {
        try {
            await sendXT("hgh", JSON.stringify({ "LT": 11, "SV": name }))
            let [obj, _2] = await waitForResult("hgh", 1000 * 60 * 5, (obj, result) => {
                if (result != 0)
                    return false

                if (obj.LT != 11 || obj.SV.toLowerCase() != name.toLowerCase())
                    return false
                return true
            })

            let item = obj.L?.find(e => e[2][1].toLowerCase() == name.toLowerCase())
            if (item == undefined) {
                return reject("Could not find alliance name")
            }
            resolve(item[2][0])
        }
        catch (e) {
            return reject("Could not find alliance name")
        }
    })
    let getAllianceMembers = (AID) => new Promise((resolve, reject) => {
        sendXT("ain", JSON.stringify({ AID: AID }))
        let listener = (obj, result) => {
            if (result == 114) {
                xtHandler.removeListener("ain", listener)
                reject("Could not find player")
            }
            else if (result != 0) {
                xtHandler.removeListener("ain", listener)
                reject("unknown error")
            }

            if (obj.A.AID != AID)
                return

            let members = obj.A.M.map((e) => e)
            resolve(members)
            xtHandler.removeListener("ain", listener)
        }
        xtHandler.addListener("ain", listener)
    })
    let getAlliancePlayerID = (AID) => new Promise((resolve, reject) => {
        sendXT("ain", JSON.stringify({ AID: AID }))
        let listener = (obj, result) => {
            if (result == 114) {
                xtHandler.removeListener("ain", listener)
                reject("Could not find player")
            }
            else if (result != 0) {
                xtHandler.removeListener("ain", listener)
                reject("unknown error")
            }
            if (obj.A.AID != AID)
                return

            let members = obj.A.M.map((e) => e.OID)
            resolve(members)
            xtHandler.removeListener("ain", listener)
        }
        xtHandler.addListener("ain", listener)
    })
    await interaction.deferReply()

    if (typeof LT === 'number') {
        try {
            const probeSV = LT == 30 ? "1" : "";
            await sendXT("hgh", JSON.stringify({ LT: LT, LID: 1, SV: probeSV }))
            let [, res] = await waitForResult("hgh", 4000, (obj, result) => {
                return result != 0 || (Number(obj.LT) === LT && Number(obj.LID) === 1 && obj.SV === probeSV)
            })
            if (res !== 0) {
                await interaction.editReply("❌ The event is not active or has ended.\n❌ هذا الحدث غير نشط أو انتهى حالياً.")
                return
            }
        } catch (e) {
            await interaction.editReply("❌ The event is not active or has ended.\n❌ هذا الحدث غير نشط أو انتهى حالياً.")
            return
        }
    }

    let allianceName = interaction.options.getString('name')
    let AID = playerInfo.alliance.id
    try {
        if (allianceName)
            AID = await getAllianceByName(allianceName)
    }
    catch {
        await interaction.editReply("Could not find the alliance specified")
        return
    }
    let members = await getAllianceMembers(AID)

    let commonGetFunc = async (j) => {
        for (let i = 1; i <= j; i++) {
            await sendXT("hgh", JSON.stringify({ LT: LT, LID: i, SV: LT == 30 ? `1` : `` }))
            let [obj, _2] = await waitForResult("hgh", 1000 * 60 * 5, (obj, result) => {
                if (result != 0)
                    return false

                if (obj.LT != LT || obj.LID != i || obj.SV != ``)
                    return false
                return true
            })
            if (_2 !== 0) {
                break
            }
            let promises = []
            for (let j = 1; j + 1 <= obj.LR; j += 8) {
                promises.push((async () => {
                    try {
                        await sendXT("hgh", JSON.stringify({ LT: LT, LID: i, SV: `${j}` }))
                        let [obj, _2] = await waitForResult("hgh", 1000 * 10, (obj, result) => {
                            if (result != 0)
                                return false

                            if (obj.LT != LT || obj.LID != i || obj.SV != `${j}`)
                                return false
                            return true
                        })

                        obj.L.forEach(e => {
                            try {
                                if (e[2].AID != AID)
                                    return
                                if (!lootTable.every(a => a[0] != e[2].N))
                                    return
                            }
                            catch (e2) {
                                console.error(JSON.stringify(e))
                                console.error(e2)
                            }
                            lootTable.push([e[2].N, e[1]])
                        })
                    }
                    catch (e) {
                        console.warn(e)
                    }
                })())
            }
            await Promise.all(promises)
        }
    }
    let lootTable = []
    if (LT == 30) {
        for (let i = 0; i < members.length; i++) {
            const member = members[i]

            if (member.R) {
                if (!lootTable.every(a => a[0] != member.N))
                    return
                lootTable.push([member.N, -1])
                return
            }
            await sendXT("hgh", JSON.stringify({ LT: LT, SV: `${member.N}` }))
            let [obj, ret] = await waitForResult("hgh", 1000 * 30, (obj, result) => { //TODO: LOCK
                if (result != 0)
                    return true

                if (obj.LT != LT || obj.SV != `${member.N}`)
                    return false
                return true
            })
            if (ret != 0) {
                if (!lootTable.every(a => a[0] != member.N))
                    return
                lootTable.push([member.N, 0])
            }
            else {
                obj.L.forEach(e => {
                    if (e[2].AID != AID)
                        return
                    if (!lootTable.every(a => a[0] != e[2].N))
                        return
                    lootTable.push([e[2].N, e[1]])
                })
            }
        }
    }
    else if (LT == 2) {
        let promises = members.map(async e => {
            if (e.R) {
                if (!lootTable.every(a => a[0] != e.N))
                    return
                lootTable.push([e.N, -1])
                return
            }
            await sendXT("hgh", JSON.stringify({ LT: LT, SV: `${e.N}` }))
            try {
                let [obj, _2] = await waitForResult("hgh", 1000 * 30, (obj, result) => {
                    if (result != 0)
                        return false

                    if (obj.LT != LT || obj.SV != `${e.N}`)
                        return false
                    return true
                })

                obj.L.forEach(e => {
                    if (e[2].AID != AID)
                        return
                    if (!lootTable.every(a => a[0] != e[2].N))
                        return
                    lootTable.push([e[2].N, e[1]])
                })
            } catch (a) {
                if (!lootTable.every(a => a[0] != e.N))
                    return
                lootTable.push([e.N, -1])
            }
        })

        await Promise.all(promises)
    }
    else if (LT == "Storm") {
        let playerids = await getAlliancePlayerID(AID)
        await Promise.all(playerids.map(async pid => {
            await sendXT("gpe", JSON.stringify({ PID: pid, EID: 102 }))
            let [obj, _2] = await waitForResult("gpe", 1000 * 60 * 5, (obj, result) => {
                if (result != 0)
                    return false

                if (obj.PID != pid || obj.EID != 102)
                    return false
                return true
            })
            lootTable.push([obj.NOM, obj.AMT])
        }))
    }
    else if (LT == 54 || LT == 55) {
        let promises = members.map(async e => {
            if (e.R) {
                if (!lootTable.every(a => a[0] != e.N))
                    return
                lootTable.push([e.N, -1])
                return
            }
            LT = 54
            await sendXT("hgh", JSON.stringify({ LT: LT, LID: 1, SV: `${e.N}` }))
            try {
                let [obj, _2] = await waitForResult("hgh", 1000 * 30, (obj, result) => {
                    if (result != 0)
                        return false

                    if (obj.LT != LT || obj.SV != `${e.N}`)
                        return false
                    return true
                })
                lootTable.push([e.N, obj.FR])
            } catch (a) {
                console.warn(a)
                if (!lootTable.every(a => a[0] != e.N))
                    return
                lootTable.push([e.N, -1])
            }
            LT == 55
            await sendXT("hgh", JSON.stringify({ LT: LT, LID: 2, SV: `${e.N}` }))
            try {
                let [obj, _2] = await waitForResult("hgh", 1000 * 30, (obj, result) => {
                    if (result != 0)
                        return false

                    if (obj.LT != LT || obj.SV != `${e.N}`)
                        return false
                    return true
                })
                let loot = lootTable.find(a => a[0] != e.N)
                if (loot) {
                    loot[1] += obj.FR
                    return
                }
                lootTable.push([e.N, obj.LR])
            } catch (a) {
                console.warn(a)
                if (!lootTable.every(a => a[0] != e.N))
                    return
                lootTable.push([e.N, -1])
            }
        })

        await Promise.all(promises)
    }
    else {
        await commonGetFunc(5)
    }

    members.forEach(e => {
        if (lootTable.every(a => a[0] != e.N))
            lootTable.push([e.N, 0])
    })

    lootTable.sort((a, b) => b[1] - a[1])

    let msg = ""

    for (let i = 0; i < lootTable.length; i++) {
        const element = lootTable[i]
        msg += `${i + 1}. ${element[0]} ${element[1].toLocaleString()}\n`
    }

    await interaction.editReply("```" + msg + "```")
}

let alliances = []
events.once("load", async () => {
    let canFuckingWork = false
    while (!canFuckingWork) {
        try {
            await sendXT("hgh", JSON.stringify({ LT: 11, LID: 6, SV: `${1}` }))
            await waitForResult("hgh", 1000 * 5)
            canFuckingWork = true
        }
        catch (e) {
            console.warn(e)
        }
    }
    if (alliances.length == 0) {
        for (let j = 1; j < 32000; j += 8) {
            try {
                await sendXT("hgh", JSON.stringify({ LT: 11, LID: 6, SV: `${j}` }))
                let [obj, _2] = await waitForResult("hgh", 1000 * 60 * 5, (obj, result) => {
                    if (result != 0)
                        return false

                    if (obj.LT != 11 || obj.SV != `${j}`)
                        return false
                    return true
                })

                obj.L.forEach(e => {
                    if (!alliances.includes(e[2][1]))
                        alliances.push(e[2][1])
                })
                if ((j + 1) > obj.LR)
                    break

            }

            catch (e) {
                console.warn(e)
            }
        }
    }
})

let genericAutoComplete = async (interaction) => {
    const focusedValue = interaction.options.getFocused()
    const filtered = alliances.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()))
    filtered.splice(25, Infinity)

    await interaction.respond(
        filtered.map(choice => ({ name: choice, value: choice })),
    )
}
let getHonourRanking = async (interaction) => {
    await interaction.deferReply()
    let getHonourList = async function* () {
        fullout:
        for (let j = 1; j + 1 <= 3000; j += 8) {
            let highScoreData;
            try {
                highScoreData = await ClientCommands.getHighScore(HighscoreType.honour, 0, j)()
            } catch (err) {
                console.warn("Error fetching honour highscore:", err)
                break fullout
            }
            if (!highScoreData || highScoreData.result !== 0 || !highScoreData.list) {
                console.warn(`Honour highscore returned result code: ${highScoreData ? highScoreData.result : 'null'}`)
                break fullout
            }
            for (let i = 0; i < highScoreData.list.length; i++) {
                const e = highScoreData.list[i]
                if (e.playerData.isRuin && !e.playerData.castlePositionList.every(e => e.areaInfo == AreaType.outpost))
                    continue
                if (e.playerData.remainingNoobTime)
                    continue
                if (e.playerData.remainingPeaceTime)
                    continue
                if (e.amount == 0)
                    break fullout
                if (ggeConfig.blackListedAlliances?.includes(e.playerData.allianceName))
                    continue

                yield e.playerData
            }
        }
    }
    let playerList = []
    try {
        for await (const player of getHonourList()) {
            if (!playerList.find(e => e[0] == player.name))
                playerList.push([player.name, `${Math.round(player.mightPoints / 1000000)}M`, player.honour])
        }
    } catch (e) {
        console.error("Error generating honour targets:", e)
    }

    if (playerList.length === 0) {
        await interaction.editReply("❌ No targets found or highscore request failed.\n❌ لم يتم العثور على أهداف أو فشل طلب الترتيب.")
        return
    }

    playerList.sort((a, b) => b[2] - a[2])
    let msg = "```"
    for (let i = 0; i < playerList.length; i++) {
        const playerData = playerList[i]
        msg += `${playerData[0]} ${playerData[1]} ${playerData[2]}\n`
    }

    while (msg.length >= 2000 - 3)
        msg = msg.replace(/\n.*$/, '')

    msg += "```"
    await interaction.editReply(msg)
}

let getAllianceQuestPointCount = async (interaction) => {
    await interaction.deferReply()
    let allianceQuestsScore = await ClientCommands.allianceQuestPointCount()
    if (!allianceQuestsScore || typeof allianceQuestsScore !== 'object' || !allianceQuestsScore.list) {
        let errCode = allianceQuestsScore;
        let errMsg = `❌ Failed to fetch Grand Tournament rankings. (Error: ${errCode || 'Unknown'})`;
        if (errCode === 145 || String(errCode).includes("NO_EVENT")) {
            errMsg = `❌ The Grand Tournament event is not active or has ended.\n❌ حدث البطولة الكبرى (Grand Tournament) غير نشط أو انتهى حالياً.`;
        }
        await interaction.editReply(errMsg);
        return;
    }
    allianceQuestsScore.list.sort((a, b) => a.points - b.points)
    let msg = "```"

    allianceQuestsScore.list.forEach((e, i) => msg += `${i + 1}. ${e.playerName} ${e.points}\n`)

    while (msg.length >= 2000 - 3)
        msg = msg.replace(/\n.*$/, '')

    msg += "```"
    await interaction.editReply(msg)
}

function listUserCastles() {
    let msg = "Your castles:\n"
    castles.forEach((c, idx) => {
        const name = c.areaInfo?.extraData?.[7] || `Castle ${c.id}`
        const kidName = KingdomID[c.kingdomID] || `Kingdom ${c.kingdomID}`
        msg += `${idx + 1}. *${name}* (ID: \`${c.id}\`, Kingdom: ${kidName})\n`
    })
    return msg
}

([
    {
        data: new SlashCommandBuilder()
            .setName('nomads')
            .setDescription('grabs Nomad rankings from selected alliance')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Alliance that you want to see the rankings of")
                    .setAutocomplete(true),
            )
        ,
        async execute(/**@type {Interaction}*/interaction) {
            await getAllianceEventRank(interaction, 46)
        },
        autoComplete: genericAutoComplete
    },
    {
        data: new SlashCommandBuilder()
            .setName('warofrealms')
            .setDescription('grabs War of the Realms rankings from selected alliance')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Alliance that you want to see the rankings of")
                    .setAutocomplete(true),
            )
        ,
        async execute(/**@type {Interaction}*/interaction) {
            await getAllianceEventRank(interaction, 44)
        },
        autoComplete: genericAutoComplete
    },
    {
        data: new SlashCommandBuilder()
            .setName('samurai')
            .setDescription('grabs Samurai rankings from selected alliance')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Alliance that you want to see the rankings of")
                    .setAutocomplete(true),
            )
        ,
        async execute(/**@type {Interaction}*/interaction) {
            await getAllianceEventRank(interaction, 51)
        },
        autoComplete: genericAutoComplete
    },
    {
        data: new SlashCommandBuilder()
            .setName('bloodcrows')
            .setDescription('grabs Bloodcrows rankings from selected alliance')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Alliance that you want to see the rankings of")
                    .setAutocomplete(true),
            )
        ,
        async execute(/**@type {Interaction}*/interaction) {
            await getAllianceEventRank(interaction, 58)
        },
        autoComplete: genericAutoComplete
    },
    {
        data: new SlashCommandBuilder()
            .setName('honour')
            .setDescription('grabs honour from useful targets')
        ,
        async execute(/**@type {Interaction}*/interaction) {
            await getHonourRanking(interaction)
        },
    },
    // {
    //     data: new SlashCommandBuilder()
    //         .setName('berimond-invasion')
    //         .setDescription('grabs Berimond rankings from selected alliance')
    //         .addStringOption(option =>
    //             option.setName("name")
    //                 .setDescription("Alliance that you want to see the rankings of")
    //                 .setAutocomplete(true),
    //         )
    //     ,
    //     async execute(/**@type {Interaction}*/interaction) {
    //         await getAllianceEventRank(interaction, 54)
    //     },
    //     autoComplete: genericAutoComplete
    // },
    {
        data: new SlashCommandBuilder()
            .setName('battle-for-berimond')
            .setDescription('grabs Berimond rankings from selected alliance')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Alliance that you want to see the rankings of")
                    .setAutocomplete(true),
            )
        ,
        async execute(/**@type {Interaction}*/interaction) {
            await getAllianceEventRank(interaction, 30)
        },
        autoComplete: genericAutoComplete
    },
    {
        data: new SlashCommandBuilder()
            .setName('storm')
            .setDescription('grabs Storm rankings from selected alliance')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Alliance that you want to see the rankings of")
                    .setAutocomplete(true),
            )
        ,
        async execute(/**@type {Interaction}*/interaction) {
            await getAllianceEventRank(interaction, "Storm")
        },
        autoComplete: genericAutoComplete
    },
    {
        data: new SlashCommandBuilder()
            .setName(botConfig.externalEvent ? "external_loot" : 'loot')
            .setDescription('grabs loot rankings from selected alliance')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Alliance that you want to see the rankings of")
                    .setAutocomplete(true),
            ),
        async execute(/**@type {Interaction}*/interaction) {
            await getAllianceEventRank(interaction, 2)
        },
        autoComplete: genericAutoComplete
    },
    {
        data: new SlashCommandBuilder()
            .setName('storm-top-players')
            .setDescription('grabs storm rankings'),
        async execute(/**@type {Interaction}*/interaction) {
            await getStormRanks(interaction)
        },
        autoComplete: genericAutoComplete
    },
    {
        data: new SlashCommandBuilder()
            .setName('grandtournament')
            .setDescription('grabs grand tournament scores'),
        async execute(/**@type {Interaction}*/interaction) {
            await getAllianceQuestPointCount(interaction)
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('renameaccount')
            .setDescription('Rename your player account name')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("New account name")
                    .setRequired(true)
            ),
        async execute(interaction) {
            const newName = interaction.options.getString('name')
            if (!newName) {
                return await interaction.reply("Usage: /renameaccount <new_name>")
            }
            await interaction.deferReply()
            try {
                const result = await ClientCommands.renameAccount(newName)
                if (result === 0) {
                    await interaction.editReply(`✅ Account successfully renamed to: ${newName}\n✅ تم تغيير اسم الحساب بنجاح إلى: ${newName}`)
                } else if (result === 22) {
                    await interaction.editReply(`❌ Failed to rename account. Error code: 22 (الاسم الجديد مستخدم بالفعل من قبل لاعب آخر)\n❌ The new name is already taken by another player.`)
                } else if (result === 95) {
                    await interaction.editReply(`❌ Failed to rename account. Error code: 95 (قد لا تملك الياقوت الكافي أو أنك قمت بتغيير الاسم مؤخراً ويجب الانتظار 12 ساعة)\n❌ You may not have enough rubies or the name was changed recently (must wait 12 hours).`)
                } else {
                    await interaction.editReply(`❌ Failed to rename account. Error code: ${result}`)
                }
            } catch (e) {
                await interaction.editReply(`❌ Error: ${e.message || e}`)
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('renamecastle')
            .setDescription('Rename a castle or outpost')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Usage: <castle_id_or_index> <new_name>")
                    .setRequired(true)
            ),
        async execute(interaction) {
            const arg = interaction.options.getString('name')
            if (!arg) {
                return await interaction.reply("Usage: /renamecastle <castle_id_or_index> <new_name>\n\n" + listUserCastles())
            }
            const parts = arg.trim().split(/\s+/)
            if (parts.length < 2) {
                return await interaction.reply("Usage: /renamecastle <castle_id_or_index> <new_name>\n\n" + listUserCastles())
            }
            const targetRef = parts[0]
            const newName = parts.slice(1).join(" ")

            let targetCastle = null
            const idx = parseInt(targetRef, 10)
            if (!isNaN(idx) && idx > 0 && idx <= castles.length) {
                targetCastle = castles[idx - 1]
            } else {
                targetCastle = castles.find(c => String(c.id) === targetRef || (c.areaInfo?.extraData?.[7] && c.areaInfo.extraData[7].toLowerCase() === targetRef.toLowerCase()))
            }

            if (!targetCastle) {
                return await interaction.reply(`❌ Castle "${targetRef}" not found.\n\n` + listUserCastles())
            }

            await interaction.deferReply()
            try {
                const result = await ClientCommands.renameCastle(targetCastle.id, targetCastle.kingdomID, newName)
                if (result === 0) {
                    await interaction.editReply(`✅ Castle renamed successfully to: ${newName}\n✅ تم تغيير اسم القلعة بنجاح إلى: ${newName}`)
                } else if (result === 22) {
                    await interaction.editReply(`❌ Failed to rename castle. Error code: 22 (الاسم الجديد مستخدم بالفعل من قبل لاعب آخر أو الاسم الحالي للبوت)\n❌ The new name is already taken or matches the current castle name.`)
                } else if (result === 95) {
                    await interaction.editReply(`❌ Failed to rename castle. Error code: 95 (قد لا تملك الياقوت الكافي - تغيير الاسم يتطلب 2,500 ياقوتة - أو الاسم غير صالح)\n❌ You may not have enough rubies (renaming costs 2,500 rubies) or the name is invalid.`)
                } else {
                    await interaction.editReply(`❌ Failed to rename castle. Error code: ${result}`)
                }
            } catch (e) {
                await interaction.editReply(`❌ Error: ${e.message || e}`)
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('opengate')
            .setDescription('Open or extend gate of a castle')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Usage: <castle_id_or_index> <6_or_12>")
                    .setRequired(true)
            ),
        async execute(interaction) {
            const arg = interaction.options.getString('name')
            if (!arg) {
                return await interaction.reply("Usage: /opengate <castle_id_or_index> <6_or_12>\n\n" + listUserCastles())
            }
            const parts = arg.trim().split(/\s+/)
            if (parts.length < 2) {
                return await interaction.reply("Usage: /opengate <castle_id_or_index> <6_or_12>\n\n" + listUserCastles())
            }
            const targetRef = parts[0]
            const hoursStr = parts[1]

            let targetCastle = null
            const idx = parseInt(targetRef, 10)
            if (!isNaN(idx) && idx > 0 && idx <= castles.length) {
                targetCastle = castles[idx - 1]
            } else {
                targetCastle = castles.find(c => String(c.id) === targetRef || (c.areaInfo?.extraData?.[7] && c.areaInfo.extraData[7].toLowerCase() === targetRef.toLowerCase()))
            }

            if (!targetCastle) {
                return await interaction.reply(`❌ Castle "${targetRef}" not found.\n\n` + listUserCastles())
            }

            let cdChoice = 0
            if (hoursStr === "12") {
                cdChoice = 1
            } else if (hoursStr !== "6") {
                return await interaction.reply("❌ Duration must be 6 or 12 hours.")
            }

            await interaction.deferReply()
            try {
                const result = await ClientCommands.openGate(targetCastle.id, targetCastle.kingdomID, cdChoice)
                if (result === 0) {
                    await interaction.editReply(`✅ Gate successfully opened/extended for ${hoursStr} hours on castle: ${targetCastle.areaInfo?.extraData?.[7] || targetCastle.id}`)
                } else {
                    await interaction.editReply(`❌ Failed to open gate. Error code: ${result}`)
                }
            } catch (e) {
                await interaction.editReply(`❌ Error: ${e.message || e}`)
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('sendmessage')
            .setDescription('Send a direct message to a player')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Usage: <player_name> <subject> | <body>")
                    .setRequired(true)
            ),
        async execute(interaction) {
            const arg = interaction.options.getString('name')
            if (!arg) {
                return await interaction.reply("Usage: /sendmessage <recipient_name> <subject> | <body>\nExample: `/sendmessage username Hello | Are you online?`")
            }
            const parts = arg.trim().split(/\s+/)
            if (parts.length < 2) {
                return await interaction.reply("Usage: /sendmessage <recipient_name> <subject> | <body>")
            }
            const recipientName = parts[0]
            const rest = arg.substring(arg.indexOf(recipientName) + recipientName.length).trim()
            const pipeIdx = rest.indexOf('|')
            if (pipeIdx === -1) {
                return await interaction.reply("❌ Please separate the subject and the body with a vertical bar `|`.\nExample: `/sendmessage username Subject Here | Body message here`")
            }
            const subject = rest.substring(0, pipeIdx).trim()
            const body = rest.substring(pipeIdx + 1).trim()

            if (!subject || !body) {
                return await interaction.reply("❌ Subject and body cannot be empty.")
            }

            await interaction.deferReply()
            try {
                const result = await ClientCommands.sendMessage(recipientName, subject, body)
                if (result === 0) {
                    await interaction.editReply(`✅ Message successfully sent to player: ${recipientName}`)
                } else {
                    await interaction.editReply(`❌ Failed to send message. Error code: ${result}`)
                }
            } catch (e) {
                await interaction.editReply(`❌ Error: ${e.message || e}`)
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('sendresources')
            .setDescription('Send resources to coordinates')
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Usage: <source_castle> <target_x> <target_y> <wood> <stone> [food]")
                    .setRequired(true)
            ),
        async execute(interaction) {
            const arg = interaction.options.getString('name')
            if (!arg) {
                return await interaction.reply("Usage:\n" +
                    "• `/sendresources <source_castle_or_index> <x> <y> <wood> <stone> [food]`\n" +
                    "• `/sendresources <source_castle_or_index> <x> <y> w:10000 s:5000 f:2000`\n\n" +
                    listUserCastles())
            }

            await interaction.deferReply()
            const cleanedArg = arg.replace(/(\b\w+)\s*:\s*(\w+)/g, "$1:$2")
            const parts = cleanedArg.trim().split(/\s+/)

            const firstTargetPart = parts[1]
            const isCoords = firstTargetPart && !isNaN(parseInt(firstTargetPart, 10))
            const isPlayerName = !isCoords
            const minParts = isPlayerName ? 3 : 4
            if (parts.length < minParts) {
                return await interaction.editReply("❌ Invalid format. Please specify source, target, and resource amounts.")
            }

            const sourceRef = parts[0]
            let targetX, targetY
            let targetKingdomID = 0
            let resourceStartIndex = 3

            let sourceCastle = null
            const idx = parseInt(sourceRef, 10)
            if (!isNaN(idx) && idx > 0 && idx <= castles.length) {
                sourceCastle = castles[idx - 1]
            } else {
                sourceCastle = castles.find(c => String(c.id) === sourceRef || (c.areaInfo?.extraData?.[7] && c.areaInfo.extraData[7].toLowerCase() === sourceRef.toLowerCase()))
            }

            if (!sourceCastle) {
                return await interaction.editReply(`❌ Source castle "${sourceRef}" not found.\n\n` + listUserCastles())
            }

            if (isPlayerName) {
                const playerName = firstTargetPart.toLowerCase().startsWith("player:") ? firstTargetPart.substring(7) : firstTargetPart
                try {
                    const spyResult = await ClientCommands.searchPlayerName(playerName)
                    if (spyResult.result !== 0 || !spyResult.areaInfo || spyResult.areaInfo.length === 0) {
                        return await interaction.editReply(`❌ Player "${playerName}" not found.`)
                    }
                    targetX = spyResult.areaInfo[0].x
                    targetY = spyResult.areaInfo[0].y
                    targetKingdomID = spyResult.kingdomID
                    resourceStartIndex = 2
                } catch (e) {
                    return await interaction.editReply(`❌ Error finding player: ${e.message || e}`)
                }
            } else {
                targetX = parseInt(parts[1], 10)
                targetY = parseInt(parts[2], 10)
                targetKingdomID = sourceCastle.kingdomID
                if (isNaN(targetX) || isNaN(targetY)) {
                    return await interaction.editReply("❌ Target X and Y coordinates must be numbers.")
                }
            }

            const goods = []
            const isKeyValuePair = parts[resourceStartIndex] && parts[resourceStartIndex].includes(":")
            if (isKeyValuePair) {
                for (let i = resourceStartIndex; i < parts.length; i++) {
                    const item = parts[i]
                    const kv = item.split(":")
                    if (kv.length === 2) {
                        const key = kv[0].toUpperCase()
                        let val
                        if (kv[1].toLowerCase() === 'max') {
                            if (key === 'W') val = sourceCastle.wood || 0
                            else if (key === 'S') val = sourceCastle.stone || 0
                            else if (key === 'F') val = sourceCastle.food || 0
                            else if (key === 'C') val = sourceCastle.coal || 0
                            else if (key === 'O') val = sourceCastle.oil || 0
                            else if (key === 'G') val = sourceCastle.glass || 0
                            else if (key === 'I') val = sourceCastle.iron || 0
                            else if (key === 'HONEY') val = sourceCastle.honey || 0
                            else if (key === 'MEAD') val = sourceCastle.mead || 0
                            else val = 0
                        } else {
                            val = parseInt(kv[1], 10)
                        }
                        if (!isNaN(val) && val > 0) {
                            goods.push([key, val])
                        }
                    }
                }
            } else {
                const woodVal = parts[resourceStartIndex]
                const stoneVal = parts[resourceStartIndex + 1]
                const foodVal = parts[resourceStartIndex + 2]

                let wood = 0
                if (woodVal) {
                    wood = woodVal.toLowerCase() === 'max' ? (sourceCastle.wood || 0) : parseInt(woodVal, 10)
                }
                let stone = 0
                if (stoneVal) {
                    stone = stoneVal.toLowerCase() === 'max' ? (sourceCastle.stone || 0) : parseInt(stoneVal, 10)
                }
                let food = 0
                if (foodVal) {
                    food = foodVal.toLowerCase() === 'max' ? (sourceCastle.food || 0) : parseInt(foodVal, 10)
                }

                if (isNaN(wood) || isNaN(stone) || isNaN(food)) {
                    return await interaction.editReply("❌ Resource amounts must be valid numbers or 'max'.")
                }
                if (wood > 0) goods.push(["W", wood])
                if (stone > 0) goods.push(["S", stone])
                if (food > 0) goods.push(["F", food])
            }

            if (goods.length === 0) {
                return await interaction.editReply("❌ No valid resources specified to send.")
            }

            try {
                const result = await ClientCommands.sendResources(
                    targetKingdomID,
                    sourceCastle.id,
                    targetX,
                    targetY,
                    -1,
                    1,
                    0,
                    goods
                )
                if (result === 0) {
                    await interaction.editReply(`✅ Resources successfully sent from: ${sourceCastle.areaInfo?.extraData?.[7] || sourceCastle.id} to (${targetX}, ${targetY})`)
                } else {
                    await interaction.editReply(`❌ Failed to send resources. Error code: ${result}`)
                }
            } catch (e) {
                await interaction.editReply(`❌ Error: ${e.message || e}`)
            }
        }
    }
]).forEach(e => {
    if (botConfig.externalEvent && !e.data.name.includes("external_"))
        return
    commands.set(e.data.name, e)
})

module.exports = { genericAutoComplete }

try {
    require('../../addons-extra/discord/extraSlashCommands.js')
}
catch (e) {
    console.debug(e)
}