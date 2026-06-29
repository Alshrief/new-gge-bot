const { isMainThread, workerData : botConfig, parentPort } = require("node:worker_threads")
if (isMainThread)
    throw new Error("Run as worker")

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception in worker thread:", err)
    process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection in worker thread at promise:", String(promise), "reason:", reason)
    process.exit(1)
})

const { getCallSites } = require("node:util")
const EventEmitter = require("node:events")
const path = require("node:path")
const { RateLimiter } = require("limiter")
const WebSocket = require("ws")
const { HttpsProxyAgent } = require('https-proxy-agent')
const { SocksProxyAgent } = require('socks-proxy-agent')
const { I18n } = require("i18n")
const ggeConfig = require("./ggeConfig.json")
const ActionType = require("./actions.json")
const err = require("./err.json")

const limiter = new RateLimiter({ tokensPerInterval: 5, interval: "sec" })
const events = new EventEmitter()
const xtHandler = new EventEmitter()
events.setMaxListeners(100)
xtHandler.setMaxListeners(100)
const i18n = new I18n({
    locales: ['en', 'de', 'ar', 'fi', 'he', 'hu', 'pl', 'ro', 'tr', 'cs', 'nl', 'fr'],
    directory: path.join(__dirname, "website", "public", 'locales'),
    updateFiles: false
})
const _console = console
let isForwardingLog = false

function translateLogPart(part) {
    const text = String(part ?? "")
    const translated = i18n.__(text)
    return translated === undefined || translated === null ? text : translated
}

function mngLog(logLevel, msg) {
    let callSites = getCallSites(6)
    let scriptName = path.basename(callSites[2]?.scriptName).slice(0, -3)
    
    let now = new Date()
    let hours = now.getHours()
    let minutes = now.getMinutes()

    hours = hours < 10 ? '0' + hours : hours
    minutes = minutes < 10 ? '0' + minutes : minutes

    let message = [`[${hours + ':' + minutes}] `, '[', `${scriptName}`, '] ']

    message.push(...msg)

    message = message.map(msg => {
        if(msg instanceof Error)
            return msg.message
        if(msg instanceof Promise || (msg && typeof msg.then === 'function'))
            return "[Promise]"
        if(typeof msg === 'function')
            return msg.toString()
        if(typeof msg === 'object' && msg !== null) {
            try {
                if (msg.constructor && msg.constructor.name !== 'Object' && msg.constructor.name !== 'Array') {
                    return `[${msg.constructor.name}]`
                }
            } catch (e) {}
        }

        return msg
    })

    const plainText = message.map(translateLogPart).join("")
    _console.log(`[${botConfig.name}] ${plainText}`)
    parentPort.postMessage([ActionType.GetLogs, logLevel, message])

    // Forward to Telegram if enabled and not logged by Telegram itself to avoid loops
    if (!isForwardingLog && botConfig.telegramData && botConfig.telegramData.telegramEnabled && scriptName !== "telegram") {
        isForwardingLog = true
        try {
            const { sendTelegramAlert } = require("./addons/discord/telegram.js")
            const alertType = (logLevel === 0) ? "system" : "errors"
            sendTelegramAlert(`log_${Date.now()}`, `[${botConfig.name}] ${plainText}`, null, alertType)
        } catch (e) {
            _console.warn("Failed to forward log to Telegram:", e)
        } finally {
            isForwardingLog = false
        }
    }
}

if (!botConfig.internalWorker) {
    console = {}
    console.log = (...msg) => mngLog(0, msg)
    console.info = (...msg) => mngLog(0, msg)
    console.warn = (...msg) => mngLog(1, msg)
    console.error = (...msg) => mngLog(2, msg)
    console.debug = ggeConfig.debug ? _console.debug : _ => { }
    console.trace = _console.trace
}
let requestCount = 0
async function sendXT(cmdName, paramObj) {
    try {
    console.debug(cmdName, JSON.parse(paramObj))
    } catch {}
    await limiter.removeTokens(1)
    requestCount++
    webSocket.send(`%xt%${botConfig.gameServer}%${cmdName}%1%${paramObj}%`)
}

let importantErrors = 0
let timedOut = 0
/**
 * 
 * @param {string} key 
 * @param {number} timeout 
 * @param {function(object,number)} func 
 * @returns {Promise<[obj: object, result: Number]>}
 */
const waitForResult = (key, timeout, func) => new Promise((resolve, reject) => {
    if (timeout == undefined)
        reject(`waitForResult: No timeout specified`)

    func ??= _ => true

    let timer
    let result
    const checkForIssues = () => {
        if (["ATTACK_TOO_MANY_UNITS"].includes(err[result]))
            importantErrors++
        if (importantErrors == 8) {
            console.error("closedReason", "tooManyImportantErrors")
            return webSocket.pause()
        }
        if (err[result] == "MOVEMENT_HAS_NO_UNITS") {
            console.error("closedReason", "MOVEMENT_HAS_NO_UNITS")
            return webSocket.pause()
        }
        if (err[result] == "CANT_START_NEW_ARMIES") {
            console.error("closedReason", "CANT_START_NEW_ARMIES")
            return webSocket.pause()
        }
    }

    if (timeout > 0) {
        timer = setTimeout(() => {
            xtHandler.removeListener(key, helperFunction)
            const msg = (result == undefined || result == 0) ? "TIMED_OUT" : !err[result] ? result : err[result]
            result = -1

            if(msg == "TIMED_OUT") {
                if(timedOut++ == 5) {
                    process.exit(0)
                }
            }
            
            if (msg === "COOLING_DOWN" || msg === "NOT_COOLING_DOWN")
                console.debug(key, msg)
            else
                console.warn(key, msg)

            reject(msg)
        }, timeout * (ggeConfig.timeoutMultiplier ?? 1))
    }

    const helperFunction = (data, _result) => {
        if (result != 0)
            result = _result

        const msg = (_result == undefined || _result == 0) ? "TIMED_OUT" : !err[_result] ? _result : err[_result]
        if(result != 0)
            checkForIssues()
        if (_result == 0 && !func(Object(data), Number(_result)))
            return
        const isSilentPlacementError = ["ebu", "eup"].includes(key) && ["INVALID_POSITION", "POSITION_IS_BLOCKED"].includes(msg)
        if (_result != 0 && msg !== "COOLING_DOWN" && msg !== "NOT_COOLING_DOWN" && !isSilentPlacementError)
            console.warn(key, msg)
        else if (_result != 0)
            console.debug(key, msg)

        timedOut = 0

        xtHandler.removeListener(key, helperFunction)
        clearTimeout(timer)
        resolve([Object(data), Number(_result)])
    }

    xtHandler.addListener(key, helperFunction)
})

const socketOptions = {
    skipUTF8Validation: ggeConfig.skipUTF8Validation ? true : false,
    handshakeTimeout: 15000
}

if (botConfig.proxyEnabled && botConfig.proxyHost && botConfig.proxyPort && botConfig.proxyType) {
    const type = botConfig.proxyType.toLowerCase()
    const auth = botConfig.proxyUser && botConfig.proxyPass ? `${encodeURIComponent(botConfig.proxyUser)}:${encodeURIComponent(botConfig.proxyPass)}@` : ''
    const proxyUrl = `${type}://${auth}${botConfig.proxyHost}:${botConfig.proxyPort}`
    
    if (type === 'http' || type === 'https') {
        socketOptions.agent = new HttpsProxyAgent(proxyUrl)
    } else if (type === 'socks4' || type === 'socks5' || type === 'socks') {
        socketOptions.agent = new SocksProxyAgent(proxyUrl)
    }
}

const webSocket = new WebSocket(`wss://${botConfig.gameURL}/`, socketOptions)

const status = {}
const playerInfo = {
    level: NaN,
    userID: NaN,
    playerID: NaN,
    email: String(),
    acceptedTOS: Boolean(),
    verifiedEmail: Boolean(),
    isCheater: Boolean(),
    name: String(),
    alliance: {
        id: NaN,
        rank: Number(),
        name: String(),
        fame: Number(),
        searchingForPlayers: Boolean()
    }
}

module.exports = {
    sendXT,
    waitForResult,
    xtHandler,
    webSocket,
    events,
    botConfig,
    playerInfo,
    status,
    i18n
}

webSocket.onopen = () => {
    if (webSocket._socket && typeof webSocket._socket.setKeepAlive === 'function') {
        webSocket._socket.setKeepAlive(true, 30000);
    }
    webSocket.send('<msg t="sys"><body action="verChk" r="0"><ver v="166"/></body></msg>')
}
let errorCount = 0

webSocket.onmessage = ({data : message}) => {
    message = message.toString()
    if (message.charAt(0) == "%") {
        let [,,cmd,, r, obj] = message.split("%")
        const result = Number(r)
        try { obj = JSON.parse(obj) }
        catch(e) {
            console.debug(e)
        }

        switch (cmd) {
            case "gbd":
                for (const [key, value] of Object.entries(obj))
                    xtHandler.emit(key, value, 0)
                break
            case "vck":
                xtHandler.emit(cmd, obj, result)
                break
            case "gfl":
                xtHandler.emit(cmd, obj, result)
                break
            default:
                console.debug(err[result] ?? result, cmd)
            case "core_pol":
            case "rlu":
            case "lli":
                xtHandler.emit(cmd, obj, result)
        }
    }

    else if (message[0] == "<") {
        switch (message) {
            case "<msg t='sys'><body action='apiOK' r='0'></body></msg>":
                webSocket.send(`<msg t="sys"><body action="login" r="0"><login z="${botConfig.gameServer}"><nick><![CDATA[]]></nick><pword><![CDATA[undefined%en%0]]></pword></login></body></msg>`)
                break
            case "<msg t='sys'><body action='joinOK' r='1'><pid id='0'/><vars /><uLs r='1'></uLs></body></msg>":
                webSocket.send('<msg t="sys"><body action="roundTrip" r="1"></body></msg>')
                sendXT("vck", `undefined%web-html5%<RoundHouseKick>%${(Math.random() * Number.MAX_VALUE).toFixed()}`)
                break
            case "<msg t='sys'><body action='roundTripRes' r='1'></body></msg>":
                break
        }
    }
}
webSocket.onerror = () => {
    events.emit("unload")
    process.exit(0)
}
webSocket.onclose = () => {
    events.emit("unload")
    process.exit(0)
}

events.on("configModified", () => console.log("botConfigReloaded"))

events.once("load", async () => {
    const { KingdomID, castles } = require("./protocols.js")
    const castle = castles.find(e => e.kingdomID == KingdomID.stormIslands)
    function getStormStats() {
        Object.assign(status, {
            aquamarin_name: castle.aqua != 0 ? Math.floor(castle.aqua) : undefined,
            food: castle.food != 0 ? Math.floor(castle.food) : undefined,
            mead: Math.floor(castle.mead != 0 ? Math.floor(castle.mead) : undefined)
        })
        parentPort.postMessage([ActionType.StatusUser, status])
    }
    if(!castle)
        return

    castle.on("resourceUpdate", getStormStats)
    getStormStats()
})

xtHandler.on("rlu", () => webSocket.send('<msg t="sys"><body action="autoJoin" r="-1"></body></msg>'))
xtHandler.on("gal", obj => {
    playerInfo.alliance.id = Number(obj.AID)
    playerInfo.alliance.rank = Number(obj.R)
    playerInfo.alliance.name = String(obj.N)
    playerInfo.alliance.fame = Number(obj.ACF)
    playerInfo.alliance.searchingForPlayers = Boolean(obj.SA)
})
xtHandler.on("gxp", obj => {
    playerInfo.level = obj.LVL + obj.LL

    if (!botConfig.externalEvent)
        return

    Object.assign(status, { level: playerInfo.level })
    parentPort.postMessage([ActionType.StatusUser, status])
})
xtHandler.on("gpi", obj => {
    playerInfo.userID = Number(obj.UID)
    playerInfo.playerID = Number(obj.PID)
    playerInfo.name = String(obj.PN)
    playerInfo.email = String(obj.E)
    playerInfo.verifiedEmail = Boolean(obj.V)
    playerInfo.acceptedTOS = Boolean(obj.CTAC)
    playerInfo.isCheater = Boolean(obj.CL)
})
xtHandler.on("gcu", obj => {
    Object.assign(status, {
        gold: obj.C1 != 0 ? Math.floor(playerInfo.coin = obj.C1) : undefined,
        cash: obj.C2 != 0 ? Math.floor(playerInfo.rubies = obj.C2) : undefined,
        requestCount,
        errorCount
    })
    parentPort.postMessage([ActionType.StatusUser, status])
})
xtHandler.on("gai", obj => {
    Object.assign(status, {
        attackDailyCount: obj.AC != 0 ? Math.floor(playerInfo.attackDailyCount = obj.AC) : undefined,
    })
    parentPort.postMessage([ActionType.StatusUser, status])
})
parentPort.on("message", async obj => {
    switch (obj[0]) {
        case ActionType.SetPluginOptions:
            function deepCopy(old_, new_) {
                Object.keys(new_).forEach(key => {
                    if (typeof new_[key] === "object" && !Array.isArray(new_[key]) && new_[key] !== null)
                        deepCopy(old_[key], new_[key])
                    else
                        old_[key] = new_[key]
                })
            }
            deepCopy(botConfig, obj[1])
            events.emit("configModified")
            break
            break
        case ActionType.SetTelegramConfig:
            botConfig.telegramData = obj[1]
            break
        case ActionType.StatusUser:
            parentPort.postMessage([ActionType.StatusUser, status])
            break
        case ActionType.GetExternalEvent:
            await sendXT("sei", JSON.stringify({}))
            let [sei, _] = await waitForResult("sei", 1000 * 10)
            if (sei.E.find(e => e.EID == 113))
                await sendXT("glt", JSON.stringify({ GST: 3 }))
            else
                await sendXT("glt", JSON.stringify({ GST: 2 }))
            let [glt, _2] = await waitForResult("glt", 1000 * 10)
            parentPort.postMessage([ActionType.GetExternalEvent, { sei: sei, glt: glt }])
            break

    }
})

async function retry() {
    if (botConfig.externalEvent) {
        sendXT("tlep", JSON.stringify({ TLT: botConfig.tempServerData.glt.TLT }))
    }
    if (botConfig.lt) {
        sendXT("lli", JSON.stringify({
            "CONM": 350,
            "RTM": 57,
            "ID": 0,
            "PL": 1,
            "NOM": botConfig.name,
            "LT": botConfig.lt,
            "LANG": "en",
            "DID": "0",
            "AID": "17254677223212351",
            "KID": "",
            "REF": "https://empire.goodgamestudios.com",
            "GCI": "",
            "SID": 9,
            "PLFID": 1
        }))
    }
    else {
        sendXT("lli", JSON.stringify({
            CONM: 212,
            RTM: 25,
            ID: 0,
            PL: 1,
            NOM: botConfig.name,
            PW: botConfig.pass,
            LT: null,
            LANG: "en",
            DID: "0",
            AID: "1745592024940879420",
            KID: "",
            REF: "https://empire.goodgamestudios.com",
            GCI: "",
            SID: 9,
            PLFID: 1
        }))
    }
    events.emit("sentLLI")
}
xtHandler.on("vck", retry)

let loginAttempts = 0
xtHandler.on("lli", async (obj, r) => {
    if (r == 453) {
        console.log("retryLogin", obj.CD, "retryLoginSeconds")
        setTimeout(retry, obj.CD * 1000)
        return
    }

    if (err[r] == "IS_BANNED") {
        console.log("retryLogin", obj.CD, "retryLoginSeconds")
        console.log("retryLogin", (obj.RS / 60 / 60).toFixed(2), "retryLoginHours")
        setTimeout(retry, obj.RS * 1000)
        return
    }

    if (r == 0) {
        //Due to exploits that can break the client this is to give limited access again.
        const timer = setTimeout(() => {
            console.warn("loggedIn", "loggedInWithoutEventData")
            console.warn("featuresMightNotWork")
            events.emit("load")
        }, 30 * 1000 * (ggeConfig.timeoutMultiplier ?? 1))

        xtHandler.once("sei", () => {
            parentPort.postMessage([ActionType.Started])
            console.log("loggedIn")
            setTimeout(() => events.emit("load"), 4500)
            clearTimeout(timer)
        })
        events.emit("earlyLoad")
        setInterval(() => sendXT("pin", "<RoundHouseKick>"), 1000 * 60).unref()
        return
    }

    if (r == err["INVALID_LOGIN_TOKEN"]) {
        loginAttempts++
        if (loginAttempts < 3) {
            console.warn(`[Login] Invalid login token. Retrying attempt ${loginAttempts}/3 in 10 seconds...`)
            setTimeout(retry, 10000)
            return
        }
    }
    if (botConfig.internalWorker)
        process.exit(0)

    status.hasError = true
    parentPort.postMessage([ActionType.StatusUser, status])
    console.error(err[r])
    setTimeout(() => parentPort.postMessage([ActionType.KillBot]), 1000 * 8)
})

try {
    require("./addons/misc.js")
}
catch(e) {
    console.debug(e)
}

for (const [, val] of Object.entries(botConfig.plugins)) {
    if (!val.state)
        continue
    if (path.basename(val.filename ?? "").startsWith("shared"))
        continue
    try {
        require(`./${val.filename}`)
    }
    catch (e) {
        console.warn(e)
    }
}
