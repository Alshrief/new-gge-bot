if (require('node:worker_threads').isMainThread)
    return module.exports = {
        hidden: true
    }

const { Client, Events, GatewayIntentBits, Collection, REST, Routes } = require('discord.js')
const ggeConfig = require("../../ggeConfig.json")
const { events, botConfig } = require('../../ggeBot')

const hasDiscordConfig = ggeConfig.discordToken && ggeConfig.discordClientId;

const client = hasDiscordConfig ? new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences]
}) : null;

if (client) {
    client.on(Events.ClientReady, () =>
        client.user.setActivity(ggeConfig.discordBanner ? ggeConfig.discordBanner : 'https://github.com/Alshrief'))
    client.login(ggeConfig.discordToken).catch(err => {
        console.error("Failed to login to Discord inside worker thread:", err)
    })
}

/** @type {Promise<Client>} */
const clientPromise = client ? new Promise((resolve) => {
    client.once(Events.Error, (err) => {
        console.error("Discord client error in worker thread:", err)
        resolve(null)
    })
    client.once(Events.ClientReady, () => {
        resolve(client)
    })
}) : Promise.resolve(null);

const commands = new Collection()

if (client) {
    client.on(Events.InteractionCreate, async interaction => {
        const command = commands.get(interaction.commandName)

        if (!command)
            return console.debug("noMatchingCommandWasFound", interaction.commandName)

        if (interaction.isAutocomplete()) {
            try {
                await command.autoComplete(interaction)
            } catch (error) {
                console.error(error)
            }
            return
        }
        if (!interaction.isChatInputCommand())
            return

        try {
            await command.execute(interaction)
        } catch (error) {
            console.error(error)
            if (interaction.replied || interaction.deferred)
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true })
            else
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
        }
    })
}
async function refreshCommands() {
    const resolvedClient = await clientPromise
    if (!resolvedClient)
        return
    const rest = new REST().setToken(ggeConfig.discordToken)
    if (commands.size == 0)
        return console.warn("noCommands")

    try {
        await rest.put(
            Routes.applicationGuildCommands(
                ggeConfig.discordClientId,
                botConfig.discordData.discordGuildId),
            { body: commands.map(command => command.data.toJSON()) },
        )
    } catch (e) {
        console.error("Failed to register application commands with Discord:", e)
    }
}

events.on("load", () => {
    refreshCommands.bind(this)()
})

module.exports = { client, clientReady: clientPromise, commands }
