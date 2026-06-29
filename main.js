const path = require("path")
const crypto = require('crypto')
const undici = require('undici')
const os = require('node:os')
const fs = require('fs/promises')
const fsSync = require('fs')

if (!fsSync.existsSync(path.join(__dirname, 'uploads'))) {
  fsSync.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true })
}
const http = require('node:http')
const { createProxyMiddleware } = require("http-proxy-middleware")
const express = require('express')
const https = require('node:https')
const { HttpsProxyAgent } = require('https-proxy-agent')
const { SocksProxyAgent } = require('socks-proxy-agent')
const bodyParser = require('body-parser')
const { WebSocketServer } = require("ws")
const { parseStringPromise } = require('xml2js')
const { DatabaseSync } = require('node:sqlite')
const { Worker } = require('node:worker_threads')
const { Client, Events, GatewayIntentBits, PermissionFlagsBits } = require('discord.js')
const ErrorType = require('./errors.json')
const ActionType = require('./actions.json')
const { I18n } = require('i18n')
const { EventEmitter } = require('node:stream')
const { processMessage } = require('./chatbotEngine')
// if(process.platform === "win32")
// require("node-prevent-sleep").enable()
const events = new EventEmitter()

function createProxyAgent(proxyHost, proxyPort, proxyUser, proxyPass, proxyType) {
  if (!proxyHost || !proxyPort || !proxyType) return null
  const type = proxyType.toLowerCase()
  const auth = proxyUser && proxyPass ? `${encodeURIComponent(proxyUser)}:${encodeURIComponent(proxyPass)}@` : ''
  const proxyUrl = `${type}://${auth}${proxyHost}:${proxyPort}`

  if (type === 'http' || type === 'https') {
    return new HttpsProxyAgent(proxyUrl)
  } else if (type === 'socks4' || type === 'socks5' || type === 'socks') {
    return new SocksProxyAgent(proxyUrl)
  } else {
    throw new Error(`Unsupported proxy type: ${proxyType}`)
  }
}


const i18n = new I18n({
  locales: ['en', 'de', 'ar', 'fi', 'he', 'hu', 'pl', 'ro', 'tr', 'cs', 'nl', 'fr'],
  directory: path.join(__dirname, 'website', 'public', 'locales'),
  updateFiles: false
})

const clientOptions = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildIntegrations,
  ]
}

const client = new Client(clientOptions)

console.info(i18n.__("startBanner"))
console.info("There is a new testing branch at the moment only barons are functional within it.")
console.info("This branch is aimed to those who face time out errors regularly.")
const ggeConfigExample = `{
    "webPort" : "3001",
    "fontPath" : "",
    "privateKey" : "",
    "cert" : "",
    "signupToken" : "",
    "discordToken" : "",
    "discordClientId" : "",
    "discordClientSecret" : "",
    "timeoutMultiplier" : 1,
    "secondsTillRestartBot": 120,
    "startupDelaySeconds": 0,
    "staggerDelaySeconds": 10,
    "debug" : false,
    "recaptchaEnabled": false,
    "recaptchaSiteKey": "",
    "recaptchaSecretKey": ""
}`

const loggedInUsers = {}
const botMap = new Map()
const botRestartTracker = new Map()
const activeTelegramPollers = new Map()
const pendingTelegramInputs = new Map()
const telegramResourceSession = new Map()
const telegramRenameSession = new Map()
const autoReconnectTimers = new Map()
const autoReconnectCooldowns = new Map()
const botStatuses = new Map()

// ─── Security: IP Rate Limiters ───────────────────────────────────────────────
// Login: max 100 failed attempts per IP per hour
const loginFailMap = new Map()   // ip → { count, resetAt }
// Register: max 1 account per IP per hour
const registerMap = new Map()   // ip → { count, resetAt }

const LOGIN_MAX_FAILS = 100
const LOGIN_WINDOW_MS = 60 * 60 * 1000   // 1 hour
const REGISTER_MAX = 1
const REGISTER_WINDOW_MS = 60 * 60 * 1000   // 1 hour

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
}

function isLoginBlocked(ip) {
  const entry = loginFailMap.get(ip)
  if (!entry) return false
  if (Date.now() > entry.resetAt) { loginFailMap.delete(ip); return false }
  return entry.count >= LOGIN_MAX_FAILS
}
function recordLoginFail(ip) {
  const now = Date.now()
  const entry = loginFailMap.get(ip)
  if (!entry || now > entry.resetAt) {
    loginFailMap.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
  } else {
    entry.count++
  }
}
function clearLoginFails(ip) { loginFailMap.delete(ip) }

function isRegisterBlocked(ip) {
  const entry = registerMap.get(ip)
  if (!entry) return false
  if (Date.now() > entry.resetAt) { registerMap.delete(ip); return false }
  return entry.count >= REGISTER_MAX
}
function recordRegister(ip) {
  const now = Date.now()
  const entry = registerMap.get(ip)
  if (!entry || now > entry.resetAt) {
    registerMap.set(ip, { count: 1, resetAt: now + REGISTER_WINDOW_MS })
  } else {
    entry.count++
  }
}

// Magic bytes for allowed image types
const IMAGE_MAGIC = [
  { ext: 'png', magic: [0x89, 0x50, 0x4E, 0x47] },
  { ext: 'jpg', magic: [0xFF, 0xD8, 0xFF] },
  { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46], offset: 0, extra: [0x57, 0x45, 0x42, 0x50], extraOffset: 8 },
  { ext: 'gif', magic: [0x47, 0x49, 0x46, 0x38] },
]
function detectImageType(buffer) {
  for (const sig of IMAGE_MAGIC) {
    const start = sig.offset || 0
    const match = sig.magic.every((b, i) => buffer[start + i] === b)
    if (!match) continue
    if (sig.extra) {
      const extraMatch = sig.extra.every((b, i) => buffer[sig.extraOffset + i] === b)
      if (!extraMatch) continue
    }
    return sig.ext
  }
  return null
}

// UUID format validator
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function sanitizeUuid(raw) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().substring(0, 36)
  return UUID_REGEX.test(trimmed) ? trimmed : null
}
// ──────────────────────────────────────────────────────────────────────────────

const userDatabase = new DatabaseSync('./user.db', { timeout: 1000 * 60 })
userDatabase.exec('PRAGMA journal_mode = WAL;')
userDatabase.exec('PRAGMA synchronous = NORMAL;')
userDatabase.exec(
  `CREATE TABLE IF NOT EXISTS "Users" (
	"username"	TEXT NOT NULL UNIQUE,
	"passwordHash" BLOB NOT NULL,
  "passwordSalt" INTEGER NOT NULL,
  "uuid" TEXT UNIQUE,
	"privilege"	INTEGER,
  "discordUserId"	TEXT,
  "discordGuildId" TEXT,
  "maxGameAccounts" INTEGER DEFAULT 1
)
`)

userDatabase.exec(
  `CREATE TABLE IF NOT EXISTS "BannedEmails" (
	"email"	TEXT NOT NULL UNIQUE,
	"bannedAt"	INTEGER NOT NULL
)
`)

userDatabase.exec(
  `CREATE TABLE IF NOT EXISTS "BannedIPs" (
	"ip"	TEXT NOT NULL UNIQUE,
	"bannedAt"	INTEGER NOT NULL
)
`)

function isIpBanned(ip) {
  try {
    const row = userDatabase.prepare('SELECT 1 FROM BannedIPs WHERE ip = ?').get(ip)
    return !!row
  } catch (e) {
    console.error("Error checking banned IP:", e)
    return false
  }
}

// Database migrations for Telegram
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN telegramToken TEXT')
} catch (e) {
  // Column might already exist
}
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN telegramChatId TEXT')
} catch (e) {
  // Column might already exist
}
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN telegramEnabled INTEGER DEFAULT 0')
} catch (e) {
  // Column might already exist
}
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN telegramAlertSettings TEXT')
} catch (e) {
  // Column might already exist
}
try {
  userDatabase.exec("ALTER TABLE Users ADD COLUMN telegramLanguage TEXT DEFAULT 'ar'")
} catch (e) {
  // Column might already exist
}
// Database migrations for maxGameAccounts limit
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN maxGameAccounts INTEGER DEFAULT 1')
} catch (e) {
  // Column might already exist
}
// Database migrations for allowedPlugins whitelist
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN allowedPlugins TEXT')
} catch (e) {
  // Column might already exist
}
// Database migrations for custom restart delay and allowedAlerts
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN secondsTillRestartBot INTEGER DEFAULT 120')
} catch (e) {
  // Column might already exist
}
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN autoReconnectEnabled INTEGER DEFAULT 1')
} catch (e) {
  // Column might already exist
}
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN allowedAlerts TEXT')
} catch (e) {
  // Column might already exist
}
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN subscriptionPlan TEXT DEFAULT "trial"')
} catch (e) {
  // Column might already exist
}
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN subscriptionExpiry TEXT')
} catch (e) {
  // Column might already exist
}
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN subscriptionAlliance TEXT')
} catch (e) {
  // Column might already exist
}
try {
  userDatabase.exec('ALTER TABLE Users ADD COLUMN credits INTEGER DEFAULT 0')
} catch (e) {
  // Column might already exist
}
userDatabase.exec(
  `CREATE TABLE IF NOT EXISTS "SubUsers" (
  "id"	INTEGER,
	"uuid"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"pass"	TEXT NOT NULL,
	"plugins"	TEXT,
	"state"	INTEGER,
  "externalEvent" INTEGER,
	"server"	INTEGER,
  PRIMARY KEY("id" AUTOINCREMENT)
)
`)
userDatabase.exec('CREATE INDEX IF NOT EXISTS idx_subusers_uuid ON SubUsers(uuid);')

userDatabase.exec(
  `CREATE TABLE IF NOT EXISTS "UserNotifications" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "uuid" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" INTEGER DEFAULT 0,
  "createdAt" TEXT NOT NULL
)
`)
userDatabase.exec('CREATE INDEX IF NOT EXISTS idx_usernotifications_uuid ON UserNotifications(uuid);')

userDatabase.exec(
  `CREATE TABLE IF NOT EXISTS "CreditRequests" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "senderNumber" TEXT NOT NULL,
    "screenshotPath" TEXT NOT NULL,
    "promoCode" TEXT,
    "status" TEXT DEFAULT 'pending',
    "createdAt" TEXT NOT NULL
  )
`)
userDatabase.exec('CREATE INDEX IF NOT EXISTS idx_creditrequests_uuid ON CreditRequests(uuid);')

userDatabase.exec(
  `CREATE TABLE IF NOT EXISTS "PromoCodes" (
    "code" TEXT PRIMARY KEY,
    "creditAmount" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "active" INTEGER DEFAULT 1,
    "maxUses" INTEGER,
    "usedCount" INTEGER DEFAULT 0,
    "expiryDate" TEXT
  )
`)

// Database migrations for PromoCodes limits
try {
  userDatabase.exec('ALTER TABLE PromoCodes ADD COLUMN maxUses INTEGER')
} catch (e) { }
try {
  userDatabase.exec('ALTER TABLE PromoCodes ADD COLUMN usedCount INTEGER DEFAULT 0')
} catch (e) { }
try {
  userDatabase.exec('ALTER TABLE PromoCodes ADD COLUMN expiryDate TEXT')
} catch (e) { }

// Database migrations for Proxy under SubUsers
try {
  userDatabase.exec('ALTER TABLE SubUsers ADD COLUMN proxyHost TEXT')
} catch (e) { }
try {
  userDatabase.exec('ALTER TABLE SubUsers ADD COLUMN proxyPort INTEGER')
} catch (e) { }
try {
  userDatabase.exec('ALTER TABLE SubUsers ADD COLUMN proxyUser TEXT')
} catch (e) { }
try {
  userDatabase.exec('ALTER TABLE SubUsers ADD COLUMN proxyPass TEXT')
} catch (e) { }
try {
  userDatabase.exec('ALTER TABLE SubUsers ADD COLUMN proxyType TEXT')
} catch (e) { }
try {
  userDatabase.exec('ALTER TABLE SubUsers ADD COLUMN proxyEnabled INTEGER DEFAULT 0')
} catch (e) { }

userDatabase.exec(`
  CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "key" TEXT PRIMARY KEY,
    "value" TEXT
  )
`)

// ─── Sessions Table (for secure server-side session management) ───
userDatabase.exec(`
  CREATE TABLE IF NOT EXISTS "Sessions" (
    "token"     TEXT PRIMARY KEY,
    "uuid"      TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "persistent" INTEGER DEFAULT 0
  )
`)
userDatabase.exec('CREATE INDEX IF NOT EXISTS idx_sessions_uuid ON Sessions(uuid);')

// Purge expired sessions on startup
userDatabase.exec('DELETE FROM Sessions WHERE expiresAt < ' + Date.now())

const SESSION_TTL_MS = 24 * 60 * 60 * 1000   // 24 hours (non-persistent)
const SESSION_TTL_PERSIST_MS = 365 * 24 * 60 * 60 * 1000 // 1 year  ("keep me signed in")

function createSession(uuid, persistent = false) {
  const token = crypto.randomBytes(32).toString('hex')
  const now = Date.now()
  const expiresAt = now + (persistent ? SESSION_TTL_PERSIST_MS : SESSION_TTL_MS)
  userDatabase.prepare('INSERT INTO Sessions (token, uuid, createdAt, expiresAt, persistent) VALUES (?,?,?,?,?)')
    .run(token, uuid, now, expiresAt, persistent ? 1 : 0)
  return { token, expiresAt, persistent }
}

function validateSession(token) {
  if (!token || typeof token !== 'string' || token.length !== 64) return null
  const row = userDatabase.prepare('SELECT uuid, expiresAt FROM Sessions WHERE token = ?').get(token)
  if (!row) return null
  if (Date.now() > row.expiresAt) {
    userDatabase.prepare('DELETE FROM Sessions WHERE token = ?').run(token)
    return null
  }
  return row.uuid
}

function deleteSession(token) {
  if (token) userDatabase.prepare('DELETE FROM Sessions WHERE token = ?').run(token)
}

function deleteAllSessions(uuid) {
  userDatabase.prepare('DELETE FROM Sessions WHERE uuid = ?').run(uuid)
}

// Periodic cleanup of expired sessions (every hour)
setInterval(() => {
  try {
    userDatabase.exec('DELETE FROM Sessions WHERE expiresAt < ' + Date.now())
  } catch (e) { /* ignore */ }
}, 60 * 60 * 1000).unref()

// ─── Audit Log Table ───────────────────────────────────────────────────────────
userDatabase.exec(`
  CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id"         INTEGER PRIMARY KEY AUTOINCREMENT,
    "adminUuid"  TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "targetUuid" TEXT,
    "details"    TEXT,
    "timestamp"  INTEGER NOT NULL
  )
`)
userDatabase.exec('CREATE INDEX IF NOT EXISTS idx_auditlog_admin ON AuditLog(adminUuid);')

function logAudit(adminUuid, action, targetUuid, details) {
  try {
    userDatabase.prepare('INSERT INTO AuditLog (adminUuid, action, targetUuid, details, timestamp) VALUES (?,?,?,?,?)')
      .run(adminUuid, action, targetUuid || null, details ? JSON.stringify(details) : null, Date.now())
  } catch (e) {
    console.error('[AuditLog] Failed to write audit entry:', e)
  }
}
// ──────────────────────────────────────────────────────────────────────────────

async function sendAdminTelegramNotification(text) {
  try {
    const enabledRow = userDatabase.prepare('SELECT value FROM SystemSettings WHERE key = ?').get('adminTelegramEnabled')
    const tokenRow = userDatabase.prepare('SELECT value FROM SystemSettings WHERE key = ?').get('adminTelegramToken')
    const chatIdRow = userDatabase.prepare('SELECT value FROM SystemSettings WHERE key = ?').get('adminTelegramChatId')

    const enabled = enabledRow ? Number(enabledRow.value) === 1 : false
    const token = tokenRow ? tokenRow.value : ''
    const chatId = chatIdRow ? chatIdRow.value : ''

    if (!enabled || !token || !chatId) return

    const response = await undici.request(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No parse_mode — plain text avoids Markdown special-char parse errors
      body: JSON.stringify({ chat_id: chatId, text })
    })

    // [Fix] Always consume the response body (undici requirement)
    const resBody = await response.body.json().catch(() => null)

    if (response.statusCode !== 200) {
      console.warn('[AdminTelegram] Telegram API error:', response.statusCode, JSON.stringify(resBody))
    }
  } catch (e) {
    console.error('[AdminTelegram] Failed to send notification:', e.message)
  }
}

class User {
  constructor(obj) {
    if (obj == undefined)
      return
    this.id = Number(obj?.id)
    this.uuid = String(obj?.uuid)
    this.state = Number(obj?.state)
    this.name = String(obj?.name)
    this.pass = String(obj?.pass)
    this.server = Number(obj?.server)
    this.plugins = obj?.plugins ?? {}
    this.externalEvent = Boolean(obj?.externalEvent)
    this.proxyHost = obj?.proxyHost ? String(obj.proxyHost) : ""
    this.proxyPort = obj?.proxyPort ? Number(obj.proxyPort) : null
    this.proxyUser = obj?.proxyUser ? String(obj.proxyUser) : ""
    this.proxyPass = obj?.proxyPass ? String(obj.proxyPass) : ""
    this.proxyType = obj?.proxyType ? String(obj.proxyType) : ""
    this.proxyEnabled = obj?.proxyEnabled !== undefined ? Boolean(obj.proxyEnabled) : false
  }
}
const addUser = (uuid, user) => {
  userDatabase.prepare('INSERT INTO SubUsers (uuid, name, pass, plugins, state, externalEvent, server, proxyHost, proxyPort, proxyUser, proxyPass, proxyType, proxyEnabled) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(uuid, user.name, user.pass, JSON.stringify(user.plugins), 0, Number(user.externalEvent), user.server, user.proxyHost || "", user.proxyPort || null, user.proxyUser || "", user.proxyPass || "", user.proxyType || "", user.proxyEnabled ? 1 : 0)
}
const getSpecificUser = (uuid, user) => {
  const row = userDatabase.prepare('Select id, name, plugins, pass, state, externalEvent, server, proxyHost, proxyPort, proxyUser, proxyPass, proxyType, proxyEnabled From SubUsers WHERE uuid=? AND id=?')
    .get(uuid, user.id)

  if (row) {
    row.plugins = JSON.parse(row.plugins ?? '{}')
  }

  return new User(row)
}
const changeUser = (uuid, user) => {
  events.emit("userChange", user)
  if (user.pass == undefined || user.pass === '' || user.pass == "null") {
    userDatabase.prepare('UPDATE SubUsers SET name=?, state=?, plugins=?, externalEvent =?, server=?, proxyHost=?, proxyPort=?, proxyUser=?, proxyPass=?, proxyType=?, proxyEnabled=? WHERE uuid=? AND id=?')
      .run(user.name, user.state, JSON.stringify(user.plugins), Number(user.externalEvent), user.server, user.proxyHost || "", user.proxyPort || null, user.proxyUser || "", user.proxyPass || "", user.proxyType || "", user.proxyEnabled ? 1 : 0, uuid, user.id)

    const row = userDatabase.prepare('Select id, name, plugins, pass, state, externalEvent, server, proxyHost, proxyPort, proxyUser, proxyPass, proxyType, proxyEnabled From SubUsers WHERE uuid=? AND id=?')
      .get(uuid, user.id)

    if (row) {
      row.plugins = JSON.parse(row.plugins ?? '{}')
    }

    return new User(row)
  }
  userDatabase.prepare(`UPDATE SubUsers SET name = ?, pass = ?, state = ?, plugins = ?, externalEvent = ?, server = ?, proxyHost=?, proxyPort=?, proxyUser=?, proxyPass=?, proxyType=?, proxyEnabled=? WHERE uuid = ? AND id = ?`)
    .run(user.name, user.pass, user.state, JSON.stringify(user.plugins), Number(user.externalEvent), user.server, user.proxyHost || "", user.proxyPort || null, user.proxyUser || "", user.proxyPass || "", user.proxyType || "", user.proxyEnabled ? 1 : 0, uuid, user.id)

  const row = userDatabase.prepare("Select id, name, plugins, pass, state, externalEvent, server, proxyHost, proxyPort, proxyUser, proxyPass, proxyType, proxyEnabled From SubUsers WHERE uuid=? AND id=?")
    .get(uuid, user.id)
  if (row) {
    row.plugins = JSON.parse(row.plugins ?? '{}')
  }

  return new User(row)

}
const removeUser = (uuid, user) => {
  events.emit("userRemoved", user)
  if (uuid === undefined || user.id === undefined)
    return

  userDatabase.prepare('DELETE FROM SubUsers WHERE uuid = ? AND id = ?')
    .run(uuid, user.id)
}
const getUser = uuid => {
  let str = uuid === undefined ? '' : 'Where uuid=?'

  const prep = userDatabase.prepare(`Select id, uuid, name, plugins, pass, state, externalEvent, server, proxyHost, proxyPort, proxyUser, proxyPass, proxyType, proxyEnabled From SubUsers ${str}`)
  const rows = uuid ? prep.all(uuid) : prep.all()

  return rows?.map(e => {
    e.plugins = JSON.parse(e.plugins)
    return new User(e)
  })
}

const getPrivilege = uuid => {
  const row = userDatabase.prepare('SELECT privilege FROM Users WHERE uuid = ?').get(uuid ?? "")
  return row ? row.privilege : 0
}

const isSubscriptionActive = uuid => {
  const row = userDatabase.prepare('SELECT privilege, subscriptionExpiry FROM Users WHERE uuid = ?').get(uuid ?? "")
  if (!row) return false
  if (row.privilege === 1) return true // Admin is always active
  if (!row.subscriptionExpiry) return false

  const expiryDate = new Date(row.subscriptionExpiry)
  if (isNaN(expiryDate.getTime())) return false

  // Set expiry to end of day
  expiryDate.setHours(23, 59, 59, 999)
  return expiryDate.getTime() >= Date.now()
}

const deleteOldNotifications = () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const result = userDatabase.prepare('DELETE FROM UserNotifications WHERE createdAt < ?').run(oneDayAgo)
    if (result.changes > 0) {
      console.info(`[Database Cleanup] Pruned ${result.changes} notifications older than 24 hours.`)
    }
  } catch (e) {
    console.error("Error in deleteOldNotifications:", e)
  }
}

const broadcastAdminNotifications = () => {
  try {
    const query = `
      SELECT 
        MIN(un.id) as id, 
        un.uuid, 
        u.username, 
        un.message, 
        un.createdAt, 
        COUNT(*) as recipientCount
      FROM UserNotifications un
      LEFT JOIN Users u ON un.uuid = u.uuid
      GROUP BY un.message, un.createdAt
      ORDER BY un.createdAt DESC
    `
    const notifications = userDatabase.prepare(query).all()
    for (const adminUuid of Object.keys(loggedInUsers)) {
      if (getPrivilege(adminUuid) === 1) {
        loggedInUsers[adminUuid].forEach(({ ws: adminWs }) => {
          adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetSentNotifications, notifications]))
        })
      }
    }
  } catch (e) {
    console.error("Error broadcasting admin notifications:", e)
  }
}

const getAllDashboardUsers = () => {
  return userDatabase.prepare(`
    SELECT username, uuid, privilege, discordUserId, discordGuildId, maxGameAccounts, allowedPlugins, allowedAlerts,
    subscriptionPlan, subscriptionExpiry, subscriptionAlliance, credits,
    (SELECT COUNT(*) FROM SubUsers WHERE SubUsers.uuid = Users.uuid) AS gameAccountsCount,
    (SELECT group_concat(name, ', ') FROM SubUsers WHERE SubUsers.uuid = Users.uuid) AS gameEmails
    FROM Users
  `).all()
}

const hashPassword = (password, salt) => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 600000, 64, 'sha256', (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

const adminCreateUser = async (username, password) => {
  const salt = crypto.randomBytes(256)
  const passwordHash = await hashPassword(password, salt)
  const uuid = crypto.randomUUID()
  userDatabase.prepare('INSERT INTO Users (username, passwordHash, passwordSalt, uuid, privilege) VALUES(?,?,?,?,?)')
    .run(username, passwordHash, salt, uuid, 0)
}

const adminDeleteUser = (userUuid) => {
  const subUsers = userDatabase.prepare('SELECT id FROM SubUsers WHERE uuid = ?').all(userUuid)
  for (const subUser of subUsers) {
    try {
      events.emit("removeBot", subUser.id)
    } catch (e) {
      console.warn(e)
    }
  }
  userDatabase.prepare('DELETE FROM SubUsers WHERE uuid = ?').run(userUuid)
  userDatabase.prepare('DELETE FROM Users WHERE uuid = ?').run(userUuid)
}

const changePassword = async (uuid, currentPassword, newPassword) => {
  const row = userDatabase.prepare('SELECT * FROM Users WHERE uuid = ?').get(uuid)
  if (!row) {
    throw new Error('User not found')
  }
  const currentHash = await hashPassword(currentPassword, row.passwordSalt)
  if (currentHash.compare(row.passwordHash) !== 0) {
    throw new Error('Invalid current password')
  }
  const salt = crypto.randomBytes(256)
  const passwordHash = await hashPassword(newPassword, salt)
  userDatabase.prepare('UPDATE Users SET passwordHash = ?, passwordSalt = ? WHERE uuid = ?')
    .run(passwordHash, salt, uuid)
}

const getSystemStats = () => {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const ramUsagePercent = ((usedMem / totalMem) * 100).toFixed(1)

  const cpus = os.cpus()
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0
  for (const cpu of cpus) {
    user += cpu.times.user
    nice += cpu.times.nice
    sys += cpu.times.sys
    idle += cpu.times.idle
    irq += cpu.times.irq
  }
  const total = user + nice + sys + idle + irq
  const cpuUsagePercent = (100 - (idle / total * 100)).toFixed(1)

  return {
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    hostname: os.hostname(),
    cpuModel: cpus[0]?.model || 'Unknown CPU',
    cpuCores: cpus.length,
    ramUsed: (usedMem / 1024 / 1024 / 1024).toFixed(2),
    ramTotal: (totalMem / 1024 / 1024 / 1024).toFixed(2),
    ramUsagePercent,
    cpuUsagePercent,
    nodeVersion: process.version,
    uptime: os.uptime(),
  }
}

async function start() {
  try {
    await fs.access('./ggeConfig.json')
  }
  catch {
    await fs.writeFile('./ggeConfig.json', ggeConfigExample)
    console.info(i18n.__('ggeConfigGenerated'))
  }
  const ggeConfig = JSON.parse((await fs.readFile('./ggeConfig.json')).toString())

  if (ggeConfig.recaptchaEnabled && (!ggeConfig.recaptchaSiteKey || !ggeConfig.recaptchaSecretKey)) {
    console.warn("⚠️ Warning: reCAPTCHA is enabled but recaptchaSiteKey or recaptchaSecretKey is missing in ggeConfig.json. reCAPTCHA will be disabled.")
    ggeConfig.recaptchaEnabled = false
  }

  console.debug = ggeConfig.debug ? console.debug : _ => { }

  ggeConfig.webPort ??= '3001'

  if (ggeConfig.cert)
    await fs.access(ggeConfig.cert)

  if (ggeConfig.privateKey)
    await fs.access(ggeConfig.privateKey)

  let certFound = true
  if (!(ggeConfig.privateKey || ggeConfig.cert)) {
    certFound = false
    if (!ggeConfig.privateKey)
      console.warn(i18n.__("couldntFindPrivateKey"))
    if (!ggeConfig.cert)
      console.warn(i18n.__("couldntFindCertificate"))
  }
  let hasDiscord = true

  if (!ggeConfig.fontPath) {
    try {
      if ([, ''].includes(ggeConfig.fontPath))
        ggeConfig.fontPath = process.platform == "linux" ?
          "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" :
          'C:\\Windows\\Fonts\\segoeui.ttf'

      await fs.access(ggeConfig.fontPath)
    }
    catch {
      console.warn(`${i18n.__("couldntAccessFont")} ${ggeConfig.fontPath}`)
    }
  }

  if (!ggeConfig.discordToken || !ggeConfig.discordClientId) {
    console.warn(i18n.__("couldntSetupDiscord"))
    console.warn(i18n.__("configurationsMissing"))
    if (!ggeConfig.discordToken)
      console.warn('discordToken')
    if (!ggeConfig.discordClientId)
      console.warn('discordClientId')

    hasDiscord = false
  }

  let needLang = false
  async function getItemsJSON() {
    try {
      const response = await fetch('https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties')
      const str = await response.text()

      let str2 = undefined
      try {
        str2 = (await fs.readFile('./ItemsVersion.properties')).toString()
      }
      catch { }

      let needItems = needLang = str != str2
      try {
        await fs.access('./items')
      }
      catch {
        needItems = true
        await fs.mkdir('./items')
      }
      if (needItems) {
        await fs.writeFile('./ItemsVersion.properties', str)

        const response = await fetch(`https://empire-html5.goodgamestudios.com/default/items/items_v${str.match(new RegExp(/(?!.*=).*/))[0]}.json`)
        for (const [key, value] of Object.entries(await response.json())) {
          if (!/^[A-Za-z\_]+$/.test(key))
            continue

          await fs.writeFile(`./items/${key}.json`, JSON.stringify(value))
        }
      }
    } catch (e) {
      console.warn("⚠️ Warning: Failed to fetch items from GGE CDN. Checking cached files...")
      try {
        await fs.access('./ItemsVersion.properties')
        await fs.access('./items')
        console.info("ℹ️ Using cached items files.")
      } catch {
        console.error("❌ Critical: No cached items files found and CDN is unreachable!")
        throw e
      }
    }
  }

  async function getLangJSON() {
    try {
      try {
        await fs.access("./lang")
      } catch {
        await fs.mkdir("./lang")
      }
      try {
        await fs.access(`./lang/${i18n.getLocale()}.json`)
      } catch {
        needLang = true
      }
      if (needLang) {
        const response = await new Promise(async (resolve, reject) => {
          try {
            const versionRes = await fetch(`https://empire-html5.goodgamestudios.com/config/languages/version.json`)
            const versionJson = await versionRes.json()
            const version = versionJson.languages[i18n.getLocale()]
            resolve(fetch(`https://empire-html5.goodgamestudios.com/config/languages/${version}/${i18n.getLocale()}.json`))
          } catch (err) {
            reject(err)
          }
        })
        const str = await response.text()

        await fs.writeFile(`./lang/${i18n.getLocale()}.json`, str)
      }
    } catch (e) {
      console.warn(`⚠️ Warning: Failed to fetch language files from GGE CDN for locale: ${i18n.getLocale()}. Checking cached files...`)
      try {
        await fs.access(`./lang/${i18n.getLocale()}.json`)
        console.info(`ℹ️ Using cached language file for: ${i18n.getLocale()}`)
      } catch {
        console.error(`❌ Critical: No cached language file found for: ${i18n.getLocale()} and CDN is unreachable!`)
        throw e
      }
    }
  }
  async function getServerXML() {
    try {
      try {
        await fs.access('./1.xml')
      } catch {
        needLang = true
      }
      if (needLang) {
        const response = await fetch('https://empire-html5.goodgamestudios.com/config/network/1.xml')
        const str = await response.text()

        await fs.writeFile('./1.xml', str)
      }
    } catch (e) {
      console.warn("⚠️ Warning: Failed to fetch server list (1.xml) from GGE CDN. Checking cached files...")
      try {
        await fs.access('./1.xml')
        console.info("ℹ️ Using cached 1.xml file.")
      } catch {
        console.error("❌ Critical: No cached 1.xml found and CDN is unreachable!")
        throw e
      }
    }
  }

  await getItemsJSON()
  await getLangJSON()
  await getServerXML()

  const instances = []
  const json = await parseStringPromise((await fs.readFile('./1.xml')).toString())

  json.network.instances[0].instance.forEach(e =>
    instances.push({
      gameURL: e.server[0],
      gameServer: e.zone[0],
      gameID: e['$'].value
    }))

  let pluginData = require('./addons')

  try {
    pluginData.push(...require('./addons-extra'))
  } catch (e) {
    console.debug(e)
  }
  try {
    pluginData.push(...require('./plugins-personal'))
  } catch { }

  const plugins = pluginData
    .map(e => new Object({ key: path.basename(e[0]), filename: e[0], description: e[1].description, force: e[1].force, pluginOptions: e[1]?.pluginOptions, hidden: e[1].hidden }))
    .sort((a, b) => (a.force ?? 0) - (b.force ?? 0))

  pluginData = undefined

  const getVisiblePluginsForUser = targetUuid => {
    const userRow = userDatabase.prepare('SELECT allowedPlugins, privilege FROM Users WHERE uuid = ?').get(targetUuid ?? "")
    let filteredPlugins = plugins.filter(e => !e.hidden)
    if (userRow && userRow.privilege !== 1 && userRow.allowedPlugins) {
      try {
        const allowed = JSON.parse(userRow.allowedPlugins)
        if (Array.isArray(allowed)) {
          filteredPlugins = filteredPlugins.filter(p => allowed.includes(p.key))
        }
      } catch (e) {
        console.error(e)
      }
    }
    return filteredPlugins
  }

  // Seed default admin account if table is empty
  const usersCountRow = userDatabase.prepare('SELECT COUNT(*) as count FROM Users').get()
  if (usersCountRow.count === 0) {
    const defaultAdminUsername = 'adminuser'
    // Generate a secure random password on first run — never hardcode credentials
    const defaultAdminPassword = crypto.randomBytes(12).toString('hex')
    const salt = crypto.randomBytes(256)
    const passwordHash = crypto.pbkdf2Sync(defaultAdminPassword, salt, 600000, 64, 'sha256')
    const uuid = crypto.randomUUID()

    // Seed user
    userDatabase.prepare('INSERT INTO Users (username, passwordHash, passwordSalt, uuid, privilege, maxGameAccounts, credits, subscriptionPlan, subscriptionExpiry) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(defaultAdminUsername, passwordHash, salt, uuid, 1, 999, 1000, 'master', '2030-12-31')

    userDatabase.prepare('INSERT INTO SubUsers (uuid, name, pass, plugins, state, externalEvent, server, proxyHost, proxyPort, proxyUser, proxyPass, proxyType, proxyEnabled) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(uuid, 'example@gmail.com', '', '{}', 0, 0, 34, "", null, "", "", "SOCKS5", 0)

    console.warn("==================================================")
    console.warn("CRITICAL: No users found in database.")
    console.warn("CRITICAL: Created default Admin account!")
    console.warn(`CRITICAL: Username: ${defaultAdminUsername}`)
    console.warn(`CRITICAL: Password: ${defaultAdminPassword}`)
    console.warn("CRITICAL: Please log in and change this password immediately!")
    console.warn("==================================================")
  }

  const loginCheck = uuid =>
    !!userDatabase.prepare('SELECT * FROM Users WHERE uuid = ?').get(uuid ?? "")

  function getRequestLanguage(req) {
    const cookieHeader = req.headers.cookie
    if (cookieHeader) {
      const langMatch = cookieHeader.split(/;\s*/).find(e => e.startsWith('lang='))
      if (langMatch) {
        const val = langMatch.substring(5)
        if (val === 'ar' || val === 'en') return val
      }
    }
    const acceptLang = req.headers['accept-language']
    if (acceptLang && acceptLang.toLowerCase().startsWith('ar')) return 'ar'
    return 'en'
  }

  function getBannedMessage(req) {
    const lang = getRequestLanguage(req)
    if (lang === 'ar') {
      return 'نظراً لأن نظامنا الأمني وجد انتهاكات في هذا الحساب، تم حظره من تسجيل الدخول للبوت وإيقاف أي بوتات نشطة له أو وجدت ولن تستطيع إنشاء حساب جديد بهذا الإيميل.<br/><br/>إن كنت تظن أن هذا الحظر عن طريق الخطأ تواصل معنا من فضلك:<br/>Telegram ID: @gangcard<br/>Discord: ahmedlord4673'
    } else {
      return 'Because our security system detected violations on this account, it has been banned from logging into the bot, and any of its active or existing bots have been stopped. You will also not be able to create a new account using this email.<br/><br/>If you believe this ban was made in error, please contact us:<br/>Telegram ID: @gangcard<br/>Discord: ahmedlord4673'
    }
  }

  const app = express()
  app.disable('x-powered-by')  // [Security] Hide Express fingerprint

  // [Security] Block banned IPs
  app.use((req, res, next) => {
    const clientIp = getClientIp(req)
    if (isIpBanned(clientIp)) {
      console.warn(`[Security] Request blocked from banned IP: ${clientIp}`)
      return res.status(403).send("Forbidden: Your IP is banned.")
    }
    next()
  })

  // ─── Security Headers ──────────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: blob: https://*.goodgamestudios.com https://empire-html5.goodgamestudios.com https://raw.githubusercontent.com https://cdn.jsdelivr.net; " +
      "connect-src 'self' wss: ws: https://www.google.com; " +
      "frame-src 'self' https://www.google.com/recaptcha/ https://recaptcha.google.com/ https://www.youtube.com https://www.youtube-nocookie.com; " +
      "frame-ancestors 'none'"
    )
    next()
  })
  // ──────────────────────────────────────────────────────────────────────────

  app.use("/ggeProxyEmpire5", createProxyMiddleware({
    target: 'https://empire-html5.goodgamestudios.com',
    changeOrigin: true,
    followRedirects: true,
  }))

  app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }))
  // Helper: extract session token from cookie
  function getSessionToken(req) {
    const cookieHeader = req.headers.cookie || ''
    const match = cookieHeader.split(/;\s*/).find(c => c.startsWith('sid='))
    return match ? match.substring(4) : null
  }

  // Helper: build secure Set-Cookie string
  function buildSessionCookie(token, maxAgeSeconds, certFound) {
    let cookie = `sid=${token}; HttpOnly; SameSite=Lax; Path=/`
    if (maxAgeSeconds !== null) cookie += `; Max-Age=${maxAgeSeconds}`
    if (certFound) cookie += `; Secure`
    return cookie
  }

  app.get('/', (req, res) => {
    const uuid = validateSession(getSessionToken(req))
    if (uuid && loginCheck(uuid)) return res.redirect('/index.html')
    return res.redirect('/signin.html')
  })
  app.get('/1.xml', (_, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/xml')
    res.sendFile('1.xml', { root: "." })
  })
  app.get('/assets.json', (_, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/json')
    res.sendFile('assets.json', { root: "." })
  })

  app.get('/api/recaptcha-config', (req, res) => {
    res.json({
      enabled: !!ggeConfig.recaptchaEnabled,
      siteKey: ggeConfig.recaptchaSiteKey || ''
    })
  })

  // ── Screenshot upload (bypasses 64 KB WS limit) ───────────────────────────
  app.post('/api/upload-screenshot',
    bodyParser.raw({ type: ['image/*'], limit: '6mb' }),
    async (req, res) => {
      res.setHeader('Content-Type', 'application/json')

      // [Security] Auth check via session cookie
      const sid = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith('sid='))?.substring(4)
      const uuid = validateSession(sid)
      if (!loginCheck(uuid)) {
        return res.status(401).json({ error: 'Unauthenticated' })
      }

      // [Security] Must have a body
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'No file received' })
      }

      // [Security] Hard size cap: 5 MB
      if (req.body.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'File too large (max 5 MB)' })
      }

      // [Security] Magic bytes validation — only real images allowed
      const detectedExt = detectImageType(req.body)
      if (!detectedExt) {
        return res.status(400).json({ error: 'Invalid file type. Only PNG, JPG, WEBP, and GIF are allowed.' })
      }

      try {
        const filename = `screenshot_${Date.now()}_${crypto.randomUUID()}.${detectedExt}`
        const relativePath = `uploads/${filename}`
        const fullPath = path.join(__dirname, 'uploads', filename)
        await fs.writeFile(fullPath, req.body)
        return res.json({ ok: true, path: relativePath })
      } catch (e) {
        console.error('[UploadScreenshot] Error saving file:', e)
        return res.status(500).json({ error: 'Failed to save file' })
      }
    }
  )

  async function verifyRecaptcha(token, secretKey) {
    if (!token) return false
    try {
      const response = await undici.request('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`
      })
      if (response.statusCode !== 200) return false
      const resBody = await response.body.json()
      return !!resBody.success
    } catch (e) {
      console.error("reCAPTCHA verification error:", e)
      return false
    }
  }

  app.post('/api', bodyParser.json({ limit: '2mb' }), async (req, res) => {
    let json = req.body
    const clientIp = getClientIp(req)
    res.setHeader('Content-Type', 'application/json')

    // ─── Login (id == 0) ───────────────────────────────────────────────────────
    if (json.id == 0) {
      if (ggeConfig.recaptchaEnabled) {
        const isValid = await verifyRecaptcha(json.recaptchaToken, ggeConfig.recaptchaSecretKey)
        if (!isValid) {
          return res.send(JSON.stringify({ id: 0, r: 1, error: 'reCAPTCHA verification failed. Please try again.' }))
        }
      }

      // Brute-force check: max 100 failed attempts per IP per hour
      if (isLoginBlocked(clientIp)) {
        console.warn(`[Security] Login blocked for IP ${clientIp} — rate limit reached.`)
        return res.status(429).send(JSON.stringify({ id: 0, r: 1, error: 'Too many failed login attempts. Please try again later.' }))
      }

      const directBanned = userDatabase.prepare('SELECT 1 FROM BannedEmails WHERE LOWER(email) = LOWER(?)').get(json.email_name)
      if (directBanned) {
        return res.send(JSON.stringify({ id: 0, r: 1, error: getBannedMessage(req) }))
      }

      let row = userDatabase.prepare('Select * FROM Users WHERE username = ?')
        .get(json.email_name)
      if (!row) {
        // Check if the input is a game email address associated with any user
        const subUserRow = userDatabase.prepare('SELECT uuid FROM SubUsers WHERE name = ?').get(json.email_name)
        if (subUserRow) {
          row = userDatabase.prepare('SELECT * FROM Users WHERE uuid = ?').get(subUserRow.uuid)
        }
      }
      if (!row) {
        recordLoginFail(clientIp)
        return res.send(JSON.stringify({ id: 0, r: 1, error: 'Invalid login details.' }))
      }

      const usernameBanned = userDatabase.prepare('SELECT 1 FROM BannedEmails WHERE LOWER(email) = LOWER(?)').get(row.username)
      const gameEmailBanned = userDatabase.prepare('SELECT 1 FROM SubUsers WHERE uuid = ? AND LOWER(name) IN (SELECT LOWER(email) FROM BannedEmails)').get(row.uuid)
      if (usernameBanned || gameEmailBanned) {
        return res.send(JSON.stringify({ id: 0, r: 1, error: getBannedMessage(req) }))
      }

      try {
        const derivedKey = await hashPassword(json.password, row.passwordSalt)
        if (derivedKey.compare(row.passwordHash) == 0) {
          clearLoginFails(clientIp)
          const persistent = !!json.remember
          const session = createSession(row.uuid, persistent)
          const maxAge = persistent ? SESSION_TTL_PERSIST_MS / 1000 : null
          res.setHeader('Set-Cookie', buildSessionCookie(session.token, maxAge, certFound))
          res.send(JSON.stringify({ id: 0, r: 0 }))  // uuid NOT sent to client anymore
        } else {
          recordLoginFail(clientIp)
          res.send(JSON.stringify({ id: 0, r: 1, error: 'Invalid login details.' }))
        }
      } catch (e) {
        console.error(e)
        res.status(500).send(JSON.stringify({ id: 0, r: 1, error: 'Internal server error.' }))
      }
    }

    // ─── Register (id == 1) ────────────────────────────────────────────────────
    else if (json.id == 1) {
      if (ggeConfig.recaptchaEnabled) {
        const isValid = await verifyRecaptcha(json.recaptchaToken, ggeConfig.recaptchaSecretKey)
        if (!isValid) {
          return res.send(JSON.stringify({ id: 1, r: 1, error: 'reCAPTCHA verification failed. Please try again.' }))
        }
      }

      // Rate limit: max 1 registration per IP per hour
      if (isRegisterBlocked(clientIp)) {
        console.warn(`[Security] Registration blocked for IP ${clientIp} — rate limit reached.`)
        return res.status(429).send(JSON.stringify({ id: 1, r: 1, error: 'You can only create one account per hour. Please try again later.' }))
      }

      const { username, password, email, server } = json
      if (!username || !password || !email || !server) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'All fields are required.' }))
      }

      // 1. Username validations
      if (typeof username !== 'string' || username.length < 3 || username.length > 30) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Username must be between 3 and 30 characters.' }))
      }

      // Enforce alphanumeric and underscores only (no spaces, symbols, etc.)
      const usernameRegex = /^[\p{L}\p{N}_]+$/u
      if (!usernameRegex.test(username)) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Username can only contain letters, numbers, and underscores (no spaces).' }))
      }

      // Block highly repetitive characters (e.g., aaaa, hhhh, 1111)
      if (/(.)\1{3,}/.test(username)) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Username cannot contain highly repetitive character patterns.' }))
      }

      // Block common test/reserved usernames
      const bannedKeywords = ['test', 'testing', 'admin', 'administrator', 'guest', 'support', 'staff', 'moderator', 'owner', 'bot', 'system']
      if (bannedKeywords.includes(username.toLowerCase())) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'This username is reserved or not allowed.' }))
      }

      // 2. Email validations
      if (typeof email !== 'string') {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Invalid email address.' }))
      }

      // Email format regex
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(email)) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Please enter a valid email address.' }))
      }

      const emailParts = email.toLowerCase().split('@')
      const localPart = emailParts[0]
      const domainPart = emailParts[1]

      // General length check for local part to block very short fake usernames (e.g. asd@...)
      if (localPart.length < 4) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Email username must be at least 4 characters long.' }))
      }

      // Gmail specific check: Gmail usernames must be at least 6 characters in reality
      if (domainPart === 'gmail.com' && localPart.length < 6) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Gmail username must be at least 6 characters.' }))
      }

      // Block highly repetitive characters in email local part (e.g., aaaaa@...)
      if (/(.)\1{3,}/.test(localPart)) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Email cannot contain highly repetitive character patterns.' }))
      }

      // Block known temporary / disposable email domains
      const disposableDomains = [
        'yopmail.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com',
        'guerrillamail.com', 'sharklasers.com', 'mailinator.com', 'dispostable.com',
        'getairmail.com', 'maildrop.cc', 'tempmail.net', 'fakeinbox.com',
        'throwawaymail.com', 'tempmailaddress.com', 'burnermail.io'
      ]
      if (disposableDomains.includes(domainPart)) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Temporary or disposable email domains are not allowed.' }))
      }

      // 3. Password validations
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Password must be between 8 and 128 characters.' }))
      }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Password must contain at least one letter and one number.' }))
      }

      const usernameBanned = userDatabase.prepare('SELECT 1 FROM BannedEmails WHERE LOWER(email) = LOWER(?)').get(username)
      const emailBanned = userDatabase.prepare('SELECT 1 FROM BannedEmails WHERE LOWER(email) = LOWER(?)').get(email)
      if (usernameBanned || emailBanned) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: getBannedMessage(req) }))
      }

      // Case-insensitive duplicate check for usernames
      const existing = userDatabase.prepare('SELECT 1 FROM Users WHERE LOWER(username) = LOWER(?)').get(username)
      if (existing) {
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Username already exists.' }))
      }

      try {
        const salt = crypto.randomBytes(256)
        const passwordHash = await hashPassword(password, salt)
        const uuid = crypto.randomUUID()

        // Create user in Users
        userDatabase.prepare("INSERT INTO Users (username, passwordHash, passwordSalt, uuid, privilege, maxGameAccounts, credits, subscriptionPlan, subscriptionExpiry) VALUES(?,?,?,?,?,?,?,?,?)")
          .run(username, passwordHash, salt, uuid, 0, 1, 0, 'none', null)

        // Create first game account in SubUsers with an empty password by default
        userDatabase.prepare('INSERT INTO SubUsers (uuid, name, pass, plugins, state, externalEvent, server, proxyHost, proxyPort, proxyUser, proxyPass, proxyType, proxyEnabled) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(uuid, email, "", '{}', 0, 0, Number(server), "", null, "", "", "SOCKS5", 0)

        // Record this registration IP
        recordRegister(clientIp)

        // Notify Admins
        sendAdminTelegramNotification(`🆕 *New User Registered*\n*Username:* ${username}\n*Email:* ${email}\n*Server:* ${server}`)

        // Create session and set HttpOnly cookie
        const session = createSession(uuid, false)
        res.setHeader('Set-Cookie', buildSessionCookie(session.token, null, certFound))
        return res.send(JSON.stringify({ id: 1, r: 0 }))  // uuid NOT sent to client
      } catch (e) {
        console.error("Failed to register user:", e)
        return res.send(JSON.stringify({ id: 1, r: 1, error: 'Registration failed. Please try again.' }))
      }
    }
  })

  // ─── Logout endpoint ────────────────────────────────────────────────────────────
  app.post('/api/logout', (req, res) => {
    const token = getSessionToken(req)
    if (token) deleteSession(token)
    // Clear the cookies
    res.setHeader('Set-Cookie', [
      `sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      `uuid=; SameSite=Lax; Path=/; Max-Age=0`
    ])
    res.json({ ok: true })
  })

  if (hasDiscord) {
    const loginPromise = client.login(ggeConfig.discordToken).catch(err => {
      console.error("CRITICAL: Failed to login to Discord on main thread:", err)
      hasDiscord = false
    })

    await new Promise(resolve => {
      let resolved = false
      const done = () => {
        if (resolved) return
        resolved = true
        resolve()
      }
      client.once(Events.ClientReady, done)
      client.once(Events.Error, (err) => {
        console.error("Discord error on main thread client:", err)
        hasDiscord = false
        done()
      })
      loginPromise.then(() => {
        setTimeout(done, 5000) // fallback timeout
      })
    })
  }

  app.get('/discordAuth', async (request, response) => {
    if (!hasDiscord) {
      return response.send("Discord integration is disabled or failed to initialize.")
    }
    try {
      const tokenResponseData = await undici.request('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: ggeConfig.discordClientId,
          client_secret: ggeConfig.discordClientSecret,
          code: request.query.code,
          grant_type: 'authorization_code',
          redirect_uri: (() => {
            const proto = request.headers['x-forwarded-proto'] || request.protocol
            const host = request.headers['x-forwarded-host'] || request.headers['host'] || request.hostname
            // If behind reverse proxy, use host directly (no port needed)
            const isReverseProxy = !!request.headers['x-forwarded-host']
            if (isReverseProxy) {
              return `${proto}://${host}/discordAuth`
            }
            // Direct access with port
            return `${proto}://${request.hostname}:${ggeConfig.webPort}/discordAuth`
          })(),
          scope: 'identify',
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      })

      const oauthData = await tokenResponseData.body.json()
      const userResult = await undici.request('https://discord.com/api/users/@me', {
        headers: {
          authorization: `${oauthData.token_type} ${oauthData.access_token}`,
        }
      })
      let discordIdentifier = await userResult.body.json()
      let guildId = request.query.guild_id
      if (!discordIdentifier.id)
        return response.send(i18n.__("missingDiscordID"))
      if (!guildId)
        return response.send(i18n.__("missingGuildID"))

      let guild = client.guilds.cache.get(guildId)
      if (!guild) {
        return response.send("Could not find the Discord guild. Please make sure the bot is invited to your guild.")
      }
      let channelData = guild.channels.cache.map(channel => {
        if (guild.members.me.permissionsIn(channel)
          .has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
          return { id: channel.id, name: channel.name }

        return undefined
      }).filter(e => e !== undefined)
      const token = getSessionToken(request)
      const uuid = validateSession(token)
      let valid = loginCheck(uuid)
      if (!valid)
        return response.send(i18n.__("uuidInvalid"))

      userDatabase.prepare('UPDATE Users SET discordUserId = ?, discordGuildId = ? WHERE uuid = ?')
        .run(discordIdentifier.id, guildId, uuid)

      loggedInUsers[uuid]?.forEach(o =>
        o.ws.send(JSON.stringify([ErrorType.Success, ActionType.GetChannels, [ggeConfig.discordClientId, channelData]])))
      return response.send('<html><script language="JavaScript" type="text/javascript">window.close()</script><body>Successful</body></html>')
    } catch (error) {
      console.error("Error in discordAuth handler:", error)
      return response.send("An error occurred during Discord authentication: " + error.message)
    }
  })

  app.get('/index.html', (req, res, next) => {
    const uuid = validateSession(getSessionToken(req))
    if (!loginCheck(uuid)) {
      return res.redirect('/signin.html?v=1.0.3')
    }
    next()
  })

  // Protected /uploads — only authenticated users can access screenshots
  app.use('/uploads', (req, res, next) => {
    const uuid = validateSession(getSessionToken(req))
    if (!loginCheck(uuid)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    next()
  }, express.static(path.join(__dirname, 'uploads')))

  // Prevent caching of HTML files completely
  app.use((req, res, next) => {
    const url = req.url.split('?')[0]
    if (url === '/' || url === '/index.html' || url.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    }
    next()
  })

  app.use(express.static('website/build', {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
      }
    }
  }))

  async function createBot(uuid, user, messageBuffer, messageBufferCount, options = {}) {
    messageBuffer ??= []
    messageBufferCount ??= 0
    if (user.id && botMap.get(user.id) != undefined)
      throw Error(i18n.__("gameAccountSessionAlreadyInUse"))

    const reconnectAt = autoReconnectCooldowns.get(user.id)
    if (!options.skipAutoReconnectWait && reconnectAt && reconnectAt > Date.now()) {
      const remainingMs = reconnectAt - Date.now()
      const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000))
      if (!autoReconnectTimers.has(user.id)) {
        console.info(`[${user.name}] Waiting ${remainingSeconds}s due to startup/reconnect delay before logging in.`)
        const reconnectTimer = setTimeout(() => {
          autoReconnectTimers.delete(user.id)
          autoReconnectCooldowns.delete(user.id)
          const latestUser = getSpecificUser(uuid, user)
          if (latestUser && latestUser.state == true && botMap.get(user.id) == undefined) {
            createBot(uuid, latestUser, messageBuffer, messageBufferCount, { skipAutoReconnectWait: true })
          }
        }, remainingMs)
        autoReconnectTimers.set(user.id, reconnectTimer)
      }
      return
    }
    if (options.skipAutoReconnectWait) {
      autoReconnectCooldowns.delete(user.id)
      autoReconnectTimers.delete(user.id)
    }

    let data = structuredClone(user)

    let discordCreds = uuid => {
      const row = userDatabase.prepare('SELECT * FROM Users WHERE uuid = ?').get(uuid)
      return row ? { discordGuildId: row.discordGuildId, discordUserId: row.discordUserId } : undefined
    }
    const discordData = discordCreds(uuid)

    let telegramCreds = uuid => {
      const row = userDatabase.prepare('SELECT telegramToken, telegramChatId, telegramEnabled, telegramAlertSettings, allowedAlerts FROM Users WHERE uuid = ?').get(uuid)
      return row ? {
        telegramToken: row.telegramToken || "",
        telegramChatId: row.telegramChatId || "",
        telegramEnabled: !!row.telegramEnabled,
        telegramAlertSettings: row.telegramAlertSettings || "",
        allowedAlerts: row.allowedAlerts || ""
      } : { telegramToken: "", telegramChatId: "", telegramEnabled: false, telegramAlertSettings: "", allowedAlerts: "" }
    }
    const telegramData = telegramCreds(uuid)

    const userRow = userDatabase.prepare('SELECT allowedPlugins, privilege FROM Users WHERE uuid = ?').get(uuid)
    let allowed = null
    if (userRow && userRow.privilege !== 1 && userRow.allowedPlugins) {
      try {
        allowed = JSON.parse(userRow.allowedPlugins)
      } catch (e) {
        console.error(e)
      }
    }

    plugins.forEach(plugin => {
      if (!data.plugins || typeof data.plugins !== 'object' || Array.isArray(data.plugins)) {
        data.plugins = {}
      }
      data.plugins[plugin.key] ??= {}
      if (allowed && Array.isArray(allowed) && !allowed.includes(plugin.key)) {
        data.plugins[plugin.key].state = false
        return
      }
      if (plugin.force) {
        data.plugins[plugin.key].state = true
      }
      if (data.plugins[plugin.key]?.state) {
        data.plugins[plugin.key].filename = plugin.filename
        plugin.pluginOptions?.forEach(option => {
          let objectValue = data.plugins[plugin.key][option.key]
          if (option.key == undefined || ![, ""].includes(objectValue))
            return

          data.plugins[plugin.key][option.key] = option.default
        })
      }
    })
    const instance = instances.find(e => Number(e.gameID) == data.server)

    data.gameURL ??= instance.gameURL
    data.gameServer ??= instance.gameServer
    data.gameID ??= instance.gameID

    if (user.externalEvent == true) {
      let users = getUser(uuid)
      let bot = users.find(e => user.name == e.id && user.id != e.id && e.state)
      let getExternalEvent = (worker, alreadyStarted) => new Promise(resolve => { //TODO: add timed reject method
        let func = (obj) => {
          if (obj[0] != ActionType.GetExternalEvent)
            return
          resolve(obj[1])
          worker.off('message', func)
        }

        worker.on('message', func)

        if (alreadyStarted)
          return worker.postMessage([ActionType.GetExternalEvent])

        let a = obj => {
          if (obj[0] != ActionType.Started)
            return

          worker.postMessage([ActionType.GetExternalEvent])
          worker.off('message', a)
        }
        worker.on('message', a)

        worker.once('exit', () => {
          worker.off('message', func)
          worker.off('message', a)
          resolve(null)
        })
      })

      if (bot) {
        let worker = botMap.get(bot[0].id)

        let data3 = await getExternalEvent(worker, true)

        if (data3) {
          if (data3.ths.tsid == 24)
            user.gameURL = 'EmpireEx_42'

          user.gameServer = 'ep-live-temp1-game.goodgamestudios.com'
          user.tempServerData = data3
        }
      }
      else {
        let data2 = structuredClone(user)

        plugins.forEach(plugin => {
          data2.plugins[plugin.key] ??= {}
          if (plugin.force) {
            data2.plugins[plugin.key].state = true
          }
          if (data2.plugins[plugin.key]?.state) {
            data2.plugins[plugin.key].filename = plugin.filename
            plugin.pluginOptions?.forEach(option => {
              let objectValue = data.plugins[plugin.key][option.key]
              if (option.key == undefined || ![, ""].includes(objectValue))
                return

              data2.plugins[plugin.key][option.key] = option.default
            })
          }
        })
        data2.externalEvent = false

        data2.gameURL ??= instance.gameURL
        data2.gameServer ??= instance.gameServer
        data2.gameID ??= instance.gameID

        const worker = new Worker('./ggeBot.js', {
          workerData: { ...data2, discordData, telegramData },
          resourceLimits: {
            maxOldSpaceSizeMb: 128,
            maxYoungSpaceSizeMb: 16
          }
        })
        worker.on('error', (err) => {
          console.error(`[Temp Worker Error] Temp bot instance for user ${user.name} (ID: ${user.id}) encountered an error:`, err);
        })
        worker.messageBuffer = messageBuffer
        worker.messageBufferCount = messageBufferCount
        worker.on('message', async obj => {
          switch (obj[0]) {
            case ActionType.GetLogs:
              if (!uuid)
                break
              worker.messageBuffer[worker.messageBufferCount] = [obj[1], obj[2]]
              worker.messageBufferCount = (worker.messageBufferCount + 1) % 25
              loggedInUsers[uuid]?.forEach(o => {
                if (o.viewedUser == user.id)
                  o.ws.send(JSON.stringify([ErrorType.Success, ActionType.GetLogs,
                  [worker.messageBuffer, worker.messageBufferCount]]))
              })
              break
          }
        })
        let data3 = await getExternalEvent(worker)
        if (!data3) {
          console.error(`[${user.name}] Temp bot failed to retrieve event server data.`);
          return
        }

        let tempServerEvent = data3.sei.E.find(e => e.EID == 106)
        if (data3.glt.TSIP && data3.glt.TSZ) {
          data.gameURL = `${data3.glt.TSIP}`
          data.gameServer = data3.glt.TSZ
        }
        else if (tempServerEvent?.TSID == 24) {
          data.gameServer = 'EmpireEx_42'
          data.gameURL = 'ep-live-temp1-game.goodgamestudios.com'
        }
        else if (tempServerEvent?.TSID == 21) {
          data.gameServer = 'EmpireEx_42'
          data.gameURL = 'ep-live-temp1-game.goodgamestudios.com'
        }
        else if (data3.sei.E.find(e => e.EID == 113)) {
          data.gameServer = 'EmpireEx_45'
          data.gameURL = 'ep-live-battle1-game.goodgamestudios.com'
        }
        else {
          console.error(i18n.__("failedToJoinEventServer"))
          return await worker.terminate()
        }
        data.tempServerData = data3
        await worker.terminate()
      }
    }

    const worker = new Worker('./ggeBot.js', {
      workerData: { ...data, discordData, telegramData },
      resourceLimits: {
        maxOldSpaceSizeMb: 128,
        maxYoungSpaceSizeMb: 16
      }
    })
    worker.on('error', (err) => {
      console.error(`[Worker Error] Bot instance for user ${user.name} (ID: ${user.id}) encountered an error:`, err);
    })

    worker.messageBuffer = messageBuffer
    worker.messageBufferCount = messageBufferCount

    if (user.id)
      botMap.set(user.id, worker)

    const getAutoReconnectConfig = () => {
      const row = userDatabase.prepare('SELECT secondsTillRestartBot, autoReconnectEnabled FROM Users WHERE uuid = ?').get(uuid)
      return {
        enabled: row ? row.autoReconnectEnabled !== 0 : true,
        delaySeconds: row ? Math.max(5, Number(row.secondsTillRestartBot ?? 120) || 120) : 120
      }
    }

    const scheduleAutoReconnect = (delaySeconds) => {
      const delayMs = Math.max(5, Number(delaySeconds) || 120) * 1000
      autoReconnectCooldowns.set(user.id, Date.now() + delayMs)
      if (autoReconnectTimers.has(user.id))
        return

      console.info(`[${user.name}] Auto reconnect scheduled after ${Math.ceil(delayMs / 1000)}s.`)
      const reconnectTimer = setTimeout(() => {
        autoReconnectTimers.delete(user.id)
        autoReconnectCooldowns.delete(user.id)
        user = getSpecificUser(uuid, user)
        if (user && user.state == true && botMap.get(user.id) == undefined) {
          createBot(uuid, user, worker.messageBuffer, worker.messageBufferCount, { skipAutoReconnectWait: true })
        } else {
          console.info(`[${user.name}] ${i18n.__("restartCanceledReasonBotStoppedByUser")}`)
        }
      }, delayMs)
      autoReconnectTimers.set(user.id, reconnectTimer)
    }

    const onTerminate = () => {
      if (botMap.get(user.id) == worker) {
        botMap.set(user.id, undefined)
        if (getSpecificUser(uuid, user).state == true) {
          const tracker = botRestartTracker.get(user.id) || { consecutiveRestarts: 0, lastRestartTime: 0 }
          const now = Date.now()
          if (now - tracker.lastRestartTime > 5 * 60 * 1000) {
            tracker.consecutiveRestarts = 0
          }
          tracker.consecutiveRestarts++
          tracker.lastRestartTime = now
          botRestartTracker.set(user.id, tracker)

          const userRow = userDatabase.prepare('SELECT secondsTillRestartBot, autoReconnectEnabled FROM Users WHERE uuid = ?').get(uuid)
          if (userRow && userRow.autoReconnectEnabled === 0) {
            console.info(`[${user.name}] Auto reconnect disabled by user settings.`)
            return
          }
          const customDelay = userRow ? userRow.secondsTillRestartBot : 120
          const baseDelay = Math.max(5, customDelay ?? 120)
          const backoffDelay = Math.min(300, baseDelay * Math.pow(2, Math.max(0, tracker.consecutiveRestarts - 1)))

          autoReconnectCooldowns.set(user.id, Date.now() + (backoffDelay * 1000))
          console.info(`[${user.name}] Restart delay in ${backoffDelay}s (Consecutive restart attempts: ${tracker.consecutiveRestarts})`)
          setTimeout(() => {
            user = getSpecificUser(uuid, user)
            if (user && user.state == true) {
              createBot(uuid, user, worker.messageBuffer, worker.messageBufferCount, { skipAutoReconnectWait: true })
            } else {
              console.info(`[${user.name}] ${i18n.__("restartCanceledReasonBotStoppedByUser")}`)
            }
          }, 1000 * backoffDelay)
        }
      }
    }

    worker.on('message', obj => {
      switch (obj[0]) {
        case ActionType.KillBot: {
          const reconnectConfig = getAutoReconnectConfig()
          if (reconnectConfig.enabled) {
            scheduleAutoReconnect(reconnectConfig.delaySeconds)
          } else {
            autoReconnectCooldowns.delete(user.id)
            if (autoReconnectTimers.has(user.id)) {
              clearTimeout(autoReconnectTimers.get(user.id))
              autoReconnectTimers.delete(user.id)
            }
            userDatabase.prepare('UPDATE SubUsers SET state = ? WHERE id = ?').run(0, user.id)
          }
          removeBot(user.id)

          loggedInUsers[uuid]?.forEach(({ ws }) =>
            ws.send(JSON.stringify([ErrorType.Success, ActionType.GetUsers, [getUser(uuid), getVisiblePluginsForUser(uuid)]])))
          break
        }
        case ActionType.GetLogs:
          // console.log("logged something")
          worker.messageBuffer[worker.messageBufferCount] = [obj[1], obj[2]]
          worker.messageBufferCount = (worker.messageBufferCount + 1) % 25
          loggedInUsers[uuid]?.forEach(o =>
            o.viewedUser == user.id ? o.ws.send(JSON.stringify([
              ErrorType.Success,
              ActionType.GetLogs,
              [worker.messageBuffer, worker.messageBufferCount]
            ])) : undefined)
          break
        case ActionType.StatusUser:
          obj[1].id = user.id
          botStatuses.set(user.id, obj[1])
          loggedInUsers[uuid]?.forEach(o =>
            o.ws.send(JSON.stringify([ErrorType.Success, ActionType.StatusUser, obj[1]])))
          break
        case ActionType.RemoveUser:
          worker.off('exit', onTerminate)
          autoReconnectCooldowns.delete(user.id)
          if (autoReconnectTimers.has(user.id)) {
            clearTimeout(autoReconnectTimers.get(user.id))
            autoReconnectTimers.delete(user.id)
          }
          removeUser(uuid, user)
          break
        case ActionType.SetUser:
          userDatabase.prepare('UPDATE SubUsers SET pass = ? WHERE uuid = ? AND id = ?')
            .run(obj[1], uuid, user.id)
          break
      }
    })

    worker.on('exit', onTerminate)

    await new Promise(resolve => {
      const func = obj => {
        if (obj[0] != ActionType.Started)
          return
        resolve()
        worker.once('exit', resolve)
        worker.off('message', func)
      }

      worker.on('message', func)
    })

    return worker
  }

  const removeBot = id => {
    const worker = botMap.get(id)

    if (worker == undefined)
      throw i18n.__("noThreadWorker")

    botMap.delete(id)
    worker.terminate()
  }
  //Judge me
  events.on("createBot", createBot)
  events.on("removeBot", removeBot)

  const startupDelaySeconds = Number(ggeConfig.startupDelaySeconds ?? 0)
  const staggerDelaySeconds = Number(ggeConfig.staggerDelaySeconds ?? 10)

  if (startupDelaySeconds > 0) {
    console.info(`[System] Startup delay of ${startupDelaySeconds}s enabled. Staggering account logins by ${staggerDelaySeconds}s.`)
  }

  const users = getUser()
  let activeBotCount = 0
  for (let i = 0; i < users.length; i++) {
    let user = users[i]
    let keyRemoved = false
    for (const key of Object.keys(user.plugins)) {
      const pluginFile = plugins.find(e => e?.key == key)
      if (pluginFile != undefined)
        continue
      keyRemoved = true
      delete user.plugins[key]
    }

    if (keyRemoved) {
      user = changeUser(user.uuid, user)
    }

    if (user.state != 0) {
      if (isSubscriptionActive(user.uuid)) {
        if (startupDelaySeconds > 0) {
          const delayMs = (startupDelaySeconds + activeBotCount * staggerDelaySeconds) * 1000
          autoReconnectCooldowns.set(user.id, Date.now() + delayMs)
          activeBotCount++
        }
        createBot(user.uuid, user)
      } else {
        user.state = 0
        userDatabase.prepare('UPDATE SubUsers SET state = 0 WHERE id = ?').run(user.id)
      }
    }
  }

  const wss = new WebSocketServer({ noServer: true })
  const options = {}

  if (certFound) {
    options.key = await fs.readFile(ggeConfig.privateKey, 'utf8')
    options.cert = await fs.readFile(ggeConfig.cert, 'utf8')
  }

  const socket = (certFound ? https : http)
    .createServer(options, app).listen(ggeConfig.webPort)

  socket.on('upgrade', (req, socket, head) => {
    const uuid = validateSession(
      (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith('sid='))?.substring(4)
    )
    if (!loginCheck(uuid)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req)
    })
  })

  wss.addListener('connection', (ws, req) => {
    const clientIp = getClientIp(req)
    ws.clientIp = clientIp
    if (isIpBanned(clientIp)) {
      console.warn(`[Security] WS connection rejected from banned IP: ${clientIp}`)
      ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.Unknown, { error: 'Your IP has been banned.' }]))
      return ws.terminate()
    }

    const sid = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith('sid='))?.substring(4)
    let uuid = validateSession(sid)

    const refreshUsers = () =>
      ws.send(JSON.stringify([ErrorType.Success, ActionType.GetUsers, [getUser(uuid), getVisiblePluginsForUser(uuid)]]))

    if (!loginCheck(uuid)) {
      ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.GetUUID, {}]))
      return ws.terminate()
    }

    loggedInUsers[uuid] ??= []
    loggedInUsers[uuid].push({ ws })

    const userRow = userDatabase.prepare('SELECT username, privilege, maxGameAccounts, subscriptionPlan, subscriptionExpiry, subscriptionAlliance, credits FROM Users WHERE uuid = ?').get(uuid)
    ws.send(JSON.stringify([ErrorType.Success, ActionType.GetProfile, {
      username: userRow.username,
      privilege: userRow.privilege,
      maxGameAccounts: userRow.maxGameAccounts,
      subscriptionPlan: userRow.subscriptionPlan || "none",
      subscriptionExpiry: userRow.subscriptionExpiry || "",
      subscriptionAlliance: userRow.subscriptionAlliance || "",
      credits: userRow.credits || 0
    }]))

    refreshUsers()

    let users = getUser(uuid)
    users.forEach(user => {
      if (user.state != 1)
        return

      let worker = botMap.get(user.id)
      if (worker == undefined)
        return

      worker.postMessage([ActionType.StatusUser])
    })
    if (hasDiscord) {
      const row = userDatabase.prepare('SELECT * FROM Users WHERE uuid = ?').get(uuid)
      try {
        if (!row.discordGuildId)
          throw i18n.__("missingGuildID")
        if (!row.discordUserId)
          throw i18n.__("missingDiscordUserID")

        let guild = client.guilds.cache.get(row.discordGuildId)
        let channelData = guild.channels.cache.map(channel => {
          if (guild.members.me.permissionsIn(channel)
            .has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
            return { id: channel.id, name: channel.name }

          return undefined
        }).filter((e) => e !== undefined)
        ws.send(JSON.stringify([ErrorType.Success, ActionType.GetChannels, [ggeConfig.discordClientId, channelData]]))
      }
      catch (e) {
        ws.send(JSON.stringify([ErrorType.Success, ActionType.GetChannels,
        [ggeConfig.discordClientId, ggeConfig.discordPort, undefined]]))
        console.error(e)
      }
    }

    let messageCount = 0
    let lastReset = Date.now()
    ws.addListener('message', async event => {
      // [Security] Reject oversized messages (64 KB max)
      if (event.length > 64 * 1024) {
        console.warn(`[Security] Oversized WS message (${event.length} bytes) from uuid ${uuid}. Terminating.`)
        ws.terminate()
        return
      }

      const now = Date.now()
      if (now - lastReset > 10000) {
        messageCount = 0
        lastReset = now
      }
      messageCount++
      if (messageCount > 50) {
        console.warn(`[Security] WS Rate Limit exceeded for uuid ${uuid}. Terminating connection.`)
        ws.send(JSON.stringify([ErrorType.Generic, ActionType.Unknown, { error: "Rate limit exceeded" }]))
        ws.terminate()
        return
      }

      let parsed
      try {
        parsed = JSON.parse(event.toString())
      } catch (e) {
        ws.send(JSON.stringify([ErrorType.Generic, ActionType.Unknown, { error: "Invalid JSON" }]))
        return
      }

      const [, action, obj] = parsed

      // Verify the user still exists in the DB before processing any action
      if (!userDatabase.prepare('SELECT 1 FROM Users WHERE uuid = ?').get(uuid)) {
        console.warn(`[Security] Message from deleted/unknown user ${uuid}. Terminating connection.`)
        if (loggedInUsers[uuid]) {
          delete loggedInUsers[uuid]
        }
        ws.terminate()
        return
      }

      switch (action) {
        case ActionType.GetUsers: {
          refreshUsers()
          break
        }
        case ActionType.StatusUser: {
          break
        }
        case ActionType.AddUser: {
          if (!isSubscriptionActive(uuid)) {
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AddUser, { error: 'subscriptionExpired' }]))
            break
          }
          const limitRow = userDatabase.prepare('SELECT maxGameAccounts FROM Users WHERE uuid = ?').get(uuid)
          const limit = limitRow ? limitRow.maxGameAccounts : 1
          if (getUser(uuid).length >= limit) {
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AddUser, { error: 'maxGameAccountsLimitExceeded' }]))
            break
          }
          addUser(uuid, new User(obj))
          refreshUsers()
          break
        }
        case ActionType.RemoveUser: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            console.warn(`[Security] Unauthorized attempt to delete game accounts by user ${uuid}`)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.RemoveUser, { error: 'deleteAccountDisabled' }]))
            break
          }
          let lastError = undefined
          for (let i = 0; i < obj.length; i++) {
            const user = obj[i]
            try {
              removeUser(uuid, user)
            }
            catch (e) {
              lastError = e
            }
          }
          if (lastError) {
            console.warn(lastError)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.RemoveUser, {}]))
          }
          refreshUsers()
          break
        }
        case ActionType.SetUser: {
          let oldUser = getSpecificUser(uuid, new User(obj))
          const requestedState = Number(obj.state)
          if (requestedState === 1 && oldUser.state !== 1) {
            if (!isSubscriptionActive(uuid)) {
              ws.send(JSON.stringify([ErrorType.Generic, ActionType.SetUser, { error: 'subscriptionExpired' }]))
              break
            }
            const limitRow = userDatabase.prepare('SELECT maxGameAccounts FROM Users WHERE uuid = ?').get(uuid)
            const limit = limitRow ? limitRow.maxGameAccounts : 1
            let activeCount = 0
            for (const subUser of getUser(uuid)) {
              if (subUser.id !== oldUser.id && botMap.get(subUser.id) !== undefined) {
                activeCount++
              }
            }
            if (activeCount >= limit) {
              ws.send(JSON.stringify([ErrorType.Generic, ActionType.SetUser, { error: 'maxGameAccountsRunningLimitExceeded' }]))
              break
            }
          }
          let user = changeUser(uuid, new User(obj))
          if (user.state == 0) {
            try {
              autoReconnectCooldowns.delete(user.id)
              if (autoReconnectTimers.has(user.id)) {
                clearTimeout(autoReconnectTimers.get(user.id))
                autoReconnectTimers.delete(user.id)
              }
              removeBot(user.id)
            } catch (e) {
              console.warn(e)
            }
          }
          else {
            botRestartTracker.delete(user.id)
            autoReconnectCooldowns.delete(user.id)
            if (autoReconnectTimers.has(user.id)) {
              clearTimeout(autoReconnectTimers.get(user.id))
              autoReconnectTimers.delete(user.id)
            }
            let worker = botMap.get(user.id)
            if (worker == undefined)
              worker = await createBot(uuid, user)
            else {
              let restartedUser = false
              if (user.pass !== oldUser.pass) {
                restartedUser = true
                removeBot(user.id)
                worker = await createBot(uuid, user, worker.messageBuffer, worker.messageBufferCount)
              } else {
                for (const [key, value] of Object.entries(oldUser.plugins)) {
                  if (user.plugins[key]?.state == value.state)
                    continue
                  restartedUser = true
                  removeBot(user.id)
                  worker = await createBot(uuid, user, worker.messageBuffer, worker.messageBufferCount)
                  break
                }
              }
              if (!restartedUser) {
                let data = structuredClone(user)

                plugins.forEach(plugin => {
                  data.plugins[plugin.key] ??= {}
                  if (plugin.force) {
                    data.plugins[plugin.key].state = true
                  }
                  if (data.plugins[plugin.key]?.state) {
                    data.plugins[plugin.key].filename = plugin.filename
                    plugin.pluginOptions?.forEach(option => {
                      let objectValue = data.plugins[plugin.key][option.key]
                      if (option.key == undefined || ![, ""].includes(objectValue))
                        return

                      data.plugins[plugin.key][option.key] = option.default
                    })
                  }
                })
                worker.postMessage([ActionType.SetPluginOptions, data])
              }
            }
          }
          loggedInUsers[uuid]?.forEach(({ ws }) =>
            ws.send(JSON.stringify([ErrorType.Success, ActionType.GetUsers, [getUser(uuid), getVisiblePluginsForUser(uuid)]])))
          break
        }
        case ActionType.GetLogs: {
          if (!obj) {
            loggedInUsers[uuid].find(o => o.ws == ws).viewedUser = undefined
            break
          }
          const user = new User(obj)
          const isOwner = userDatabase.prepare('SELECT 1 FROM SubUsers WHERE uuid = ? AND id = ?').get(uuid, user.id)
          if (!isOwner) {
            console.warn(`[Security] Unauthorized log access attempt by uuid ${uuid} for bot id ${user.id}`)
            return ws.send(JSON.stringify([ErrorType.Generic, ActionType.GetLogs, { error: 'Unauthorized' }]))
          }
          const worker = botMap.get(user.id)

          if (worker == undefined)
            return ws.send(JSON.stringify([ErrorType.Generic, ActionType.GetLogs, {}]))

          let loggedInUser = loggedInUsers[uuid].find(obj => obj.ws == ws)
          loggedInUser.viewedUser = user.id
          loggedInUser.ws.send(JSON.stringify([ErrorType.Success, ActionType.GetLogs,
          [worker.messageBuffer, worker.messageBufferCount]]))
          break
        }
        case ActionType.ChangePassword: {
          try {
            await changePassword(uuid, obj.currentPassword, obj.newPassword)
            // [Security] Invalidate ALL sessions for this user on password change
            deleteAllSessions(uuid)
            // Terminate all other active WS connections for this user
            const currentWs = ws
            loggedInUsers[uuid]?.forEach(({ ws: otherWs }) => {
              if (otherWs !== currentWs) {
                try { otherWs.terminate() } catch (e) { /* ignore */ }
              }
            })
            ws.send(JSON.stringify([ErrorType.Success, ActionType.ChangePassword, { success: true }]))
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.ChangePassword, { error: e.message }]))
          }
          break
        }
        case ActionType.GetTelegramConfig: {
          try {
            const row = userDatabase.prepare('SELECT telegramToken, telegramChatId, telegramEnabled, telegramAlertSettings, telegramLanguage, secondsTillRestartBot, autoReconnectEnabled, allowedAlerts FROM Users WHERE uuid = ?').get(uuid)
            const config = row ? {
              telegramToken: row.telegramToken || "",
              telegramChatId: row.telegramChatId || "",
              telegramEnabled: !!row.telegramEnabled,
              telegramAlertSettings: row.telegramAlertSettings || "",
              telegramLanguage: row.telegramLanguage || "ar",
              secondsTillRestartBot: row.secondsTillRestartBot !== null && row.secondsTillRestartBot !== undefined ? row.secondsTillRestartBot : 120,
              autoReconnectEnabled: row.autoReconnectEnabled !== null && row.autoReconnectEnabled !== undefined ? Boolean(row.autoReconnectEnabled) : true,
              allowedAlerts: row.allowedAlerts || ""
            } : { telegramToken: "", telegramChatId: "", telegramEnabled: false, telegramAlertSettings: "", telegramLanguage: "ar", secondsTillRestartBot: 120, autoReconnectEnabled: true, allowedAlerts: "" }
            ws.send(JSON.stringify([ErrorType.Success, ActionType.GetTelegramConfig, config]))
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.GetTelegramConfig, {}]))
          }
          break
        }
        case ActionType.SetTelegramConfig: {
          try {
            userDatabase.prepare('UPDATE Users SET telegramToken = ?, telegramChatId = ?, telegramEnabled = ?, telegramAlertSettings = ?, telegramLanguage = ?, secondsTillRestartBot = ?, autoReconnectEnabled = ? WHERE uuid = ?')
              .run(
                obj.telegramToken,
                obj.telegramChatId,
                obj.telegramEnabled ? 1 : 0,
                obj.telegramAlertSettings || "",
                obj.telegramLanguage || "ar",
                obj.secondsTillRestartBot !== undefined ? Number(obj.secondsTillRestartBot) : 120,
                obj.autoReconnectEnabled === undefined ? 1 : (obj.autoReconnectEnabled ? 1 : 0),
                uuid
              )

            ws.send(JSON.stringify([ErrorType.Success, ActionType.SetTelegramConfig, { success: true }]))

            // Propagate the updated telegram configuration to all running bot workers owned by this user
            const subUsers = getUser(uuid)
            for (const subUser of subUsers) {
              const worker = botMap.get(subUser.id)
              if (worker) {
                // Fetch allowedAlerts to propagate
                const latestRow = userDatabase.prepare('SELECT allowedAlerts FROM Users WHERE uuid = ?').get(uuid)
                worker.postMessage([ActionType.SetTelegramConfig, {
                  telegramToken: obj.telegramToken || "",
                  telegramChatId: obj.telegramChatId || "",
                  telegramEnabled: !!obj.telegramEnabled,
                  telegramAlertSettings: obj.telegramAlertSettings || "",
                  telegramLanguage: obj.telegramLanguage || "ar",
                  allowedAlerts: latestRow ? latestRow.allowedAlerts : ""
                }])
              }
            }

            // Sync Telegram Pollers on main thread
            syncTelegramPollers()
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.SetTelegramConfig, { error: e.message }]))
          }
          break
        }
        case ActionType.TestProxy: {
          try {
            const { proxyHost, proxyPort, proxyUser, proxyPass, proxyType } = obj
            if (!proxyHost || !proxyPort || !proxyType) {
              throw new Error("Missing required proxy parameters")
            }
            const agent = createProxyAgent(proxyHost, proxyPort, proxyUser, proxyPass, proxyType)
            if (!agent) {
              throw new Error("Failed to create agent")
            }

            let finished = false
            const req = https.get("https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties", {
              agent,
              timeout: 5000
            }, (res) => {
              if (finished) return
              finished = true
              if (res.statusCode >= 200 && res.statusCode < 400) {
                ws.send(JSON.stringify([ErrorType.Success, ActionType.TestProxy, { success: true }]))
              } else {
                ws.send(JSON.stringify([ErrorType.Generic, ActionType.TestProxy, { error: `HTTP status: ${res.statusCode}` }]))
              }
            })

            req.on("error", (err) => {
              if (finished) return
              finished = true
              ws.send(JSON.stringify([ErrorType.Generic, ActionType.TestProxy, { error: err.message }]))
            })

            req.on("timeout", () => {
              if (finished) return
              finished = true
              req.destroy()
              ws.send(JSON.stringify([ErrorType.Generic, ActionType.TestProxy, { error: "Connection timeout (5s)" }]))
            })
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.TestProxy, { error: e.message }]))
          }
          break
        }
        case ActionType.GetAdminData: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.GetAdminData, {}]))
            break
          }
          try {
            const totalSubUsersRow = userDatabase.prepare('SELECT COUNT(*) as count FROM SubUsers').get()
            const activeSubUsersRow = userDatabase.prepare('SELECT COUNT(*) as count FROM SubUsers WHERE state = 1').get()
            const adminData = {
              stats: getSystemStats(),
              totalGameAccounts: totalSubUsersRow.count,
              activeGameAccounts: activeSubUsersRow.count,
            }
            ws.send(JSON.stringify([ErrorType.Success, ActionType.GetAdminData, adminData]))
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.GetAdminData, {}]))
          }
          break
        }
        case ActionType.AdminGetSystemSettings: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminGetSystemSettings, {}]))
            break
          }
          try {
            const enabledRow = userDatabase.prepare('SELECT value FROM SystemSettings WHERE key = ?').get('adminTelegramEnabled')
            const tokenRow = userDatabase.prepare('SELECT value FROM SystemSettings WHERE key = ?').get('adminTelegramToken')
            const chatIdRow = userDatabase.prepare('SELECT value FROM SystemSettings WHERE key = ?').get('adminTelegramChatId')

            const config = {
              adminTelegramEnabled: enabledRow ? Number(enabledRow.value) === 1 : false,
              adminTelegramToken: tokenRow ? tokenRow.value : '',
              adminTelegramChatId: chatIdRow ? chatIdRow.value : ''
            }
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetSystemSettings, config]))
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminGetSystemSettings, {}]))
          }
          break
        }
        case ActionType.AdminSaveSystemSettings: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminSaveSystemSettings, {}]))
            break
          }
          try {
            const { adminTelegramEnabled, adminTelegramToken, adminTelegramChatId, isTest } = obj

            // Save settings
            userDatabase.prepare('INSERT OR REPLACE INTO SystemSettings (key, value) VALUES (?, ?)').run('adminTelegramEnabled', adminTelegramEnabled ? '1' : '0')
            userDatabase.prepare('INSERT OR REPLACE INTO SystemSettings (key, value) VALUES (?, ?)').run('adminTelegramToken', adminTelegramToken || '')
            userDatabase.prepare('INSERT OR REPLACE INTO SystemSettings (key, value) VALUES (?, ?)').run('adminTelegramChatId', adminTelegramChatId || '')

            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminSaveSystemSettings, { success: true, isTest: !!isTest }]))

            if (isTest) {
              // Send test notification message
              await sendAdminTelegramNotification('🔔 Test Admin Notification\nAdmin notification system is configured correctly! ✅')
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminSaveSystemSettings, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminListUsers: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminListUsers, {}]))
            break
          }
          try {
            const dashboardUsers = getAllDashboardUsers()
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminListUsers, {}]))
          }
          break
        }
        case ActionType.AdminGetBannedEmails: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminGetBannedEmails, {}]))
            break
          }
          try {
            const list = userDatabase.prepare('SELECT email, bannedAt FROM BannedEmails ORDER BY bannedAt DESC').all()
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBannedEmails, list]))
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminGetBannedEmails, []]))
          }
          break
        }
        case ActionType.AdminBanEmail: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminBanEmail, {}]))
            break
          }
          try {
            const { email } = obj
            if (!email) {
              throw new Error("Email cannot be empty")
            }
            const normalizedEmail = email.trim().toLowerCase()
            userDatabase.prepare('INSERT OR REPLACE INTO BannedEmails (email, bannedAt) VALUES (?, ?)').run(normalizedEmail, Date.now())
            const list = userDatabase.prepare('SELECT email, bannedAt FROM BannedEmails ORDER BY bannedAt DESC').all()

            // Find user uuid(s) affected by this ban
            const affectedUserUuids = []
            const matchedUser = userDatabase.prepare('SELECT uuid FROM Users WHERE LOWER(username) = LOWER(?)').get(normalizedEmail)
            if (matchedUser) affectedUserUuids.push(matchedUser.uuid)

            const matchedSubUsers = userDatabase.prepare('SELECT uuid FROM SubUsers WHERE LOWER(name) = LOWER(?)').all(normalizedEmail)
            matchedSubUsers.forEach(su => {
              if (!affectedUserUuids.includes(su.uuid)) affectedUserUuids.push(su.uuid)
            })

            // Perform ban enforcement on all affected accounts
            for (const targetUuid of affectedUserUuids) {
              // 1. Stop all active bots
              const subUsers = getUser(targetUuid)
              for (const subUser of subUsers) {
                userDatabase.prepare('UPDATE SubUsers SET state = 0 WHERE id = ?').run(subUser.id)
                try {
                  removeBot(subUser.id)
                } catch (e) {
                  // bot not running or already stopped
                }
              }

              // 2. Set subscription to expired
              userDatabase.prepare("UPDATE Users SET subscriptionPlan = 'none', subscriptionExpiry = '2000-01-01' WHERE uuid = ?").run(targetUuid)

              // 3. Forcibly close all active websocket connections (Sign Out)
              if (loggedInUsers[targetUuid]) {
                loggedInUsers[targetUuid].forEach(({ ws: targetWs }) => {
                  try {
                    targetWs.send(JSON.stringify([ErrorType.Generic, ActionType.Unknown, { error: 'Your account has been banned.' }]))
                    targetWs.terminate()
                  } catch (e) { /* ignore */ }
                })
                delete loggedInUsers[targetUuid]
              }
            }
            logAudit(uuid, 'AdminBanEmail', null, { email: normalizedEmail, affectedUuids: affectedUserUuids })

            // Broadcast the updated banned list and dashboard users list to all online admins
            const dashboardUsers = getAllDashboardUsers()
            for (const adminUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(adminUuid) === 1) {
                loggedInUsers[adminUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBannedEmails, list]))
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
                })
              }
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminBanEmail, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminUnbanEmail: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminUnbanEmail, {}]))
            break
          }
          try {
            const { email } = obj
            if (!email) {
              throw new Error("Email cannot be empty")
            }
            userDatabase.prepare('DELETE FROM BannedEmails WHERE email = ?').run(email.trim().toLowerCase())
            const list = userDatabase.prepare('SELECT email, bannedAt FROM BannedEmails ORDER BY bannedAt DESC').all()
            logAudit(uuid, 'AdminUnbanEmail', null, { email: email.trim().toLowerCase() })

            // Broadcast the updated banned list and dashboard users list to all online admins
            const dashboardUsers = getAllDashboardUsers()
            for (const adminUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(adminUuid) === 1) {
                loggedInUsers[adminUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBannedEmails, list]))
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
                })
              }
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminUnbanEmail, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminGetBannedIPs: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminGetBannedIPs, {}]))
            break
          }
          try {
            const list = userDatabase.prepare('SELECT ip, bannedAt FROM BannedIPs ORDER BY bannedAt DESC').all()
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBannedIPs, list]))
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminGetBannedIPs, []]))
          }
          break
        }
        case ActionType.AdminBanIP: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminBanIP, {}]))
            break
          }
          try {
            const { ip } = obj
            if (!ip) throw new Error("IP cannot be empty")
            const trimmedIp = ip.trim()
            userDatabase.prepare('INSERT OR REPLACE INTO BannedIPs (ip, bannedAt) VALUES (?, ?)').run(trimmedIp, Date.now())

            // Terminate any active WS connections from this IP
            for (const targetUuid of Object.keys(loggedInUsers)) {
              loggedInUsers[targetUuid] = loggedInUsers[targetUuid].filter(({ ws: targetWs }) => {
                if (targetWs.clientIp === trimmedIp) {
                  try {
                    targetWs.send(JSON.stringify([ErrorType.Generic, ActionType.Unknown, { error: 'Your IP has been banned.' }]))
                    targetWs.terminate()
                  } catch (e) { }
                  return false
                }
                return true
              })
              if (loggedInUsers[targetUuid].length === 0) {
                delete loggedInUsers[targetUuid]
              }
            }

            logAudit(uuid, 'AdminBanIP', null, { ip: trimmedIp })

            const list = userDatabase.prepare('SELECT ip, bannedAt FROM BannedIPs ORDER BY bannedAt DESC').all()
            // Broadcast to all admins
            for (const adminUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(adminUuid) === 1) {
                loggedInUsers[adminUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBannedIPs, list]))
                })
              }
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminBanIP, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminUnbanIP: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminUnbanIP, {}]))
            break
          }
          try {
            const { ip } = obj
            if (!ip) throw new Error("IP cannot be empty")
            userDatabase.prepare('DELETE FROM BannedIPs WHERE ip = ?').run(ip.trim())
            logAudit(uuid, 'AdminUnbanIP', null, { ip: ip.trim() })

            const list = userDatabase.prepare('SELECT ip, bannedAt FROM BannedIPs ORDER BY bannedAt DESC').all()
            // Broadcast to all admins
            for (const adminUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(adminUuid) === 1) {
                loggedInUsers[adminUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBannedIPs, list]))
                })
              }
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminUnbanIP, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminGetBlockedIPs: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminGetBlockedIPs, {}]))
            break
          }
          try {
            const blocked = []
            const now = Date.now()
            for (const [ip, entry] of loginFailMap.entries()) {
              if (now < entry.resetAt) {
                blocked.push({
                  ip,
                  type: 'login',
                  count: entry.count,
                  max: LOGIN_MAX_FAILS,
                  resetAt: entry.resetAt,
                  blocked: entry.count >= LOGIN_MAX_FAILS
                })
              }
            }
            for (const [ip, entry] of registerMap.entries()) {
              if (now < entry.resetAt) {
                blocked.push({
                  ip,
                  type: 'register',
                  count: entry.count,
                  max: REGISTER_MAX,
                  resetAt: entry.resetAt,
                  blocked: entry.count >= REGISTER_MAX
                })
              }
            }
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBlockedIPs, blocked]))
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminGetBlockedIPs, []]))
          }
          break
        }
        case ActionType.AdminClearBlockedIP: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminClearBlockedIP, {}]))
            break
          }
          try {
            const { ip, type } = obj
            if (!ip) throw new Error("IP cannot be empty")

            if (type === 'login') {
              loginFailMap.delete(ip)
            } else if (type === 'register') {
              registerMap.delete(ip)
            } else {
              loginFailMap.delete(ip)
              registerMap.delete(ip)
            }

            logAudit(uuid, 'AdminClearBlockedIP', null, { ip, type })

            // Collect updated list and broadcast
            const blocked = []
            const now = Date.now()
            for (const [k, entry] of loginFailMap.entries()) {
              if (now < entry.resetAt) {
                blocked.push({ ip: k, type: 'login', count: entry.count, max: LOGIN_MAX_FAILS, resetAt: entry.resetAt, blocked: entry.count >= LOGIN_MAX_FAILS })
              }
            }
            for (const [k, entry] of registerMap.entries()) {
              if (now < entry.resetAt) {
                blocked.push({ ip: k, type: 'register', count: entry.count, max: REGISTER_MAX, resetAt: entry.resetAt, blocked: entry.count >= REGISTER_MAX })
              }
            }

            for (const adminUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(adminUuid) === 1) {
                loggedInUsers[adminUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBlockedIPs, blocked]))
                })
              }
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminClearBlockedIP, { error: e.message }]))
          }
          break
        }

        // ─── Chatbot ───────────────────────────────────────────────────────────
        case ActionType.ChatbotMessage: {
          try {
            // [Security] Validate message is a non-empty string
            if (!obj || typeof obj.message !== 'string' || obj.message.trim().length === 0) {
              ws.send(JSON.stringify([ErrorType.Generic, ActionType.ChatbotMessage, { error: 'Empty message' }]))
              break
            }

            // [Security] Hard cap on raw message length before passing to engine
            if (obj.message.length > 400) {
              ws.send(JSON.stringify([ErrorType.Generic, ActionType.ChatbotMessage,
              { reply: '⚠️ الرسالة طويلة جداً، اكتب أقل من 300 حرف.' }]))
              break
            }

            // Gather user's game accounts and allowed plugins for context
            const userAccounts = getUser(uuid)
            const userPluginList = getVisiblePluginsForUser(uuid)

            // Run through the chatbot engine (rate-limiting & sanitisation inside)
            const result = processMessage(uuid, obj.message, userAccounts, userPluginList)

            // If the engine wants us to execute a plugin change, do it now
            if (result.ok && result.execute) {
              const { type, plugin, option, value } = result.execute

              if (type === 'SET_PLUGIN_STATE') {
                // [Security] Only allow plugins that belong to this user
                const allowed = userPluginList.find(p => p.key === plugin)
                if (!allowed) {
                  ws.send(JSON.stringify([ErrorType.Generic, ActionType.ChatbotMessage,
                  { reply: '🚫 الإضافة دي مش متاحة لحسابك.' }]))
                  break
                }

                for (const user of userAccounts) {
                  if (!user.plugins) continue
                  user.plugins[plugin] = user.plugins[plugin] ?? {}
                  user.plugins[plugin].state = value
                  // Persist and propagate
                  try { changeUser(uuid, user) } catch (e) { console.warn('[Chatbot] changeUser error:', e) }
                  const worker = botMap.get(user.id)
                  if (worker) {
                    worker.postMessage([ActionType.SetPluginOptions, user])
                  }
                }
                // Refresh all WS clients for this user
                loggedInUsers[uuid]?.forEach(({ ws: clientWs }) =>
                  clientWs.send(JSON.stringify([ErrorType.Success, ActionType.GetUsers,
                  [getUser(uuid), getVisiblePluginsForUser(uuid)]])))

              } else if (type === 'SET_PLUGIN_OPTION') {
                // [Security] Validate option key: alphanumeric + camelCase only
                if (!/^[a-zA-Z][a-zA-Z0-9]{0,49}$/.test(option)) {
                  ws.send(JSON.stringify([ErrorType.Generic, ActionType.ChatbotMessage,
                  { reply: '🚫 اسم الإعداد غير مسموح به.' }]))
                  break
                }

                for (const user of userAccounts) {
                  if (!user.plugins) continue
                  // Find which plugin owns this option key
                  for (const [pluginKey, pluginData] of Object.entries(user.plugins)) {
                    if (option in (pluginData ?? {})) {
                      user.plugins[pluginKey][option] = value
                      try { changeUser(uuid, user) } catch (e) { console.warn('[Chatbot] changeUser error:', e) }
                      const worker = botMap.get(user.id)
                      if (worker) worker.postMessage([ActionType.SetPluginOptions, user])
                      break
                    }
                  }
                }
              }
            }

            ws.send(JSON.stringify([ErrorType.Success, ActionType.ChatbotMessage, { reply: result.text }]))
          } catch (e) {
            console.error('[Chatbot] Unexpected error:', e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.ChatbotMessage,
            { reply: '⚠️ حصل خطأ غير متوقع، حاول تاني.' }]))
          }
          break
        }

        case ActionType.AdminCreateUser: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminCreateUser, {}]))
            break
          }
          try {
            await adminCreateUser(obj.username, obj.password)
            logAudit(uuid, 'AdminCreateUser', null, { username: obj.username })
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminCreateUser, { success: true }]))
            const dashboardUsers = getAllDashboardUsers()
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
          } catch (e) {
            const isDuplicate = e.code === 'ERR_SQLITE_ERROR' && e.errcode === 2067
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminCreateUser, { error: isDuplicate ? 'Username already exists' : e.message }]))
          }
          break
        }
        case ActionType.AdminDeleteUser: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminDeleteUser, {}]))
            break
          }
          try {
            if (obj === uuid) {
              ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminDeleteUser, { error: 'Cannot delete your own account' }]))
              break
            }
            adminDeleteUser(obj)
            logAudit(uuid, 'AdminDeleteUser', obj, {})
            // Forcibly close all active connections for the deleted user
            if (loggedInUsers[obj]) {
              loggedInUsers[obj].forEach(({ ws: targetWs }) => {
                try { targetWs.terminate() } catch (e) { /* ignore */ }
              })
              delete loggedInUsers[obj]
            }
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminDeleteUser, { success: true }]))
            const dashboardUsers = getAllDashboardUsers()
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminDeleteUser, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminUpdateUserLimit: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminUpdateUserLimit, {}]))
            break
          }
          try {
            const { targetUuid, limit } = obj
            if (!targetUuid || limit === undefined || limit === null) {
              throw new Error("Missing parameters")
            }
            const parsedLimit = Math.max(1, parseInt(limit, 10))
            userDatabase.prepare('UPDATE Users SET maxGameAccounts = ? WHERE uuid = ?').run(parsedLimit, targetUuid)

            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminUpdateUserLimit, { success: true }]))

            const dashboardUsers = getAllDashboardUsers()
            for (const loggedInUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(loggedInUuid) === 1) {
                loggedInUsers[loggedInUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
                })
              }
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminUpdateUserLimit, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminUpdateAllowedPlugins: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminUpdateAllowedPlugins, {}]))
            break
          }
          try {
            const { targetUuid, allowedPlugins } = obj
            if (!targetUuid || !allowedPlugins) {
              throw new Error("Missing parameters")
            }
            const allowedPluginsJson = JSON.stringify(allowedPlugins)
            userDatabase.prepare('UPDATE Users SET allowedPlugins = ? WHERE uuid = ?').run(allowedPluginsJson, targetUuid)

            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminUpdateAllowedPlugins, { success: true }]))

            const dashboardUsers = getAllDashboardUsers()
            for (const loggedInUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(loggedInUuid) === 1) {
                loggedInUsers[loggedInUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
                })
              }
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminUpdateAllowedPlugins, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminUpdateAllowedAlerts: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminUpdateAllowedAlerts, {}]))
            break
          }
          try {
            const { targetUuid, allowedAlerts } = obj
            if (!targetUuid || !allowedAlerts) {
              throw new Error("Missing parameters")
            }
            const allowedAlertsJson = JSON.stringify(allowedAlerts)
            userDatabase.prepare('UPDATE Users SET allowedAlerts = ? WHERE uuid = ?').run(allowedAlertsJson, targetUuid)

            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminUpdateAllowedAlerts, { success: true }]))

            // Propagate the changes to the user's running workers
            propagateTelegramConfigToWorkers(targetUuid)

            // Send updated dashboard user list to all connected admins
            const dashboardUsers = getAllDashboardUsers()
            for (const loggedInUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(loggedInUuid) === 1) {
                loggedInUsers[loggedInUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
                })
              }
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminUpdateAllowedAlerts, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminKillUserBots: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminKillUserBots, {}]))
            break
          }
          try {
            const { targetUuid } = obj
            if (!targetUuid) {
              throw new Error("Missing parameters")
            }
            const subUsers = getUser(targetUuid)
            for (const subUser of subUsers) {
              userDatabase.prepare('UPDATE SubUsers SET state = 0 WHERE id = ?').run(subUser.id)
              try {
                removeBot(subUser.id)
              } catch (e) {
                // Not running
              }
            }

            // Notify the target user if online to update their UI
            if (loggedInUsers[targetUuid]) {
              const filteredPlugins = getVisiblePluginsForUser(targetUuid)
              loggedInUsers[targetUuid].forEach(({ ws: uWs }) => {
                uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetUsers, [getUser(targetUuid), filteredPlugins]]))
              })
            }

            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminKillUserBots, { success: true }]))

            const dashboardUsers = getAllDashboardUsers()
            for (const loggedInUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(loggedInUuid) === 1) {
                loggedInUsers[loggedInUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
                })
              }
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminKillUserBots, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminKillAllBots: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminKillAllBots, {}]))
            break
          }
          try {
            const allSubUsers = userDatabase.prepare('SELECT id, uuid FROM SubUsers').all()
            for (const subUser of allSubUsers) {
              userDatabase.prepare('UPDATE SubUsers SET state = 0 WHERE id = ?').run(subUser.id)
              try {
                removeBot(subUser.id)
              } catch (e) {
                // Not running
              }
            }

            // Notify all connected users to update their UIs
            for (const targetUuid of Object.keys(loggedInUsers)) {
              const filteredPlugins = getVisiblePluginsForUser(targetUuid)
              loggedInUsers[targetUuid].forEach(({ ws: uWs }) => {
                uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetUsers, [getUser(targetUuid), filteredPlugins]]))
              })
            }

            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminKillAllBots, { success: true }]))

            const dashboardUsers = getAllDashboardUsers()
            for (const loggedInUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(loggedInUuid) === 1) {
                loggedInUsers[loggedInUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
                })
              }
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminKillAllBots, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminUpdateSubscription: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminUpdateSubscription, {}]))
            break
          }
          try {
            const { targetUuid, subscriptionPlan, subscriptionExpiry, subscriptionAlliance, maxGameAccounts, credits } = obj
            if (!targetUuid || !subscriptionPlan) {
              throw new Error("Missing parameters")
            }
            userDatabase.prepare('UPDATE Users SET subscriptionPlan = ?, subscriptionExpiry = ?, subscriptionAlliance = ?, maxGameAccounts = ?, credits = ? WHERE uuid = ?')
              .run(subscriptionPlan, subscriptionExpiry || null, subscriptionAlliance || null, Number(maxGameAccounts || 1), Number(credits || 0), targetUuid)
            logAudit(uuid, 'AdminUpdateSubscription', targetUuid, { subscriptionPlan, subscriptionExpiry, credits })

            // If subscription is no longer active, stop all of their running bots immediately
            if (!isSubscriptionActive(targetUuid)) {
              const subUsers = getUser(targetUuid)
              for (const subUser of subUsers) {
                userDatabase.prepare('UPDATE SubUsers SET state = 0 WHERE id = ?').run(subUser.id)
                try {
                  removeBot(subUser.id)
                } catch (e) {
                  // Not running
                }
              }
            }

            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminUpdateSubscription, { success: true }]))

            // Sync Telegram Pollers on main thread
            syncTelegramPollers()

            // Broadcast new user list to admins
            const dashboardUsers = getAllDashboardUsers()
            for (const loggedInUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(loggedInUuid) === 1) {
                loggedInUsers[loggedInUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
                })
              }
            }

            // Send updated profile & game accounts to the user if they are online
            if (loggedInUsers[targetUuid]) {
              const targetRow = userDatabase.prepare('SELECT username, privilege, maxGameAccounts, subscriptionPlan, subscriptionExpiry, subscriptionAlliance, credits FROM Users WHERE uuid = ?').get(targetUuid)
              const filteredPlugins = getVisiblePluginsForUser(targetUuid)
              loggedInUsers[targetUuid].forEach(({ ws: uWs }) => {
                uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetProfile, {
                  username: targetRow.username,
                  privilege: targetRow.privilege,
                  maxGameAccounts: targetRow.maxGameAccounts,
                  subscriptionPlan: targetRow.subscriptionPlan || "none",
                  subscriptionExpiry: targetRow.subscriptionExpiry || "",
                  subscriptionAlliance: targetRow.subscriptionAlliance || "",
                  credits: targetRow.credits || 0
                }]))
                uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetUsers, [getUser(targetUuid), filteredPlugins]]))
              })
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminUpdateSubscription, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminUpdateUserProfile: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminUpdateUserProfile, {}]))
            break
          }
          try {
            const { targetUuid, username, password, email, server, subUserId } = obj
            if (!targetUuid) {
              throw new Error("Missing target user UUID")
            }

            // 1. Update Username if provided
            if (username) {
              const existing = userDatabase.prepare('SELECT uuid FROM Users WHERE username = ?').get(username)
              if (existing && existing.uuid !== targetUuid) {
                throw new Error("Username already exists")
              }
              userDatabase.prepare('UPDATE Users SET username = ? WHERE uuid = ?').run(username, targetUuid)
            }

            // 2. Reset Password if provided
            if (password) {
              const salt = crypto.randomBytes(256)
              const passwordHash = await hashPassword(password, salt)
              userDatabase.prepare('UPDATE Users SET passwordHash = ?, passwordSalt = ? WHERE uuid = ?').run(passwordHash, salt, targetUuid)
            }

            // 3. Update primary game email in SubUsers if provided
            if (email) {
              const subUsers = getUser(targetUuid)
              if (subUsers.length > 0) {
                const primarySubUser = subUsers[0]
                const oldEmail = primarySubUser.name
                if (email !== oldEmail) {
                  userDatabase.prepare('UPDATE SubUsers SET name = ? WHERE id = ?').run(email, primarySubUser.id)
                  primarySubUser.name = email // Update in-memory reference

                  // If bot is active (running), restart it
                  const worker = botMap.get(primarySubUser.id)
                  if (worker !== undefined) {
                    removeBot(primarySubUser.id)
                    await createBot(targetUuid, primarySubUser, worker.messageBuffer, worker.messageBufferCount)
                  }
                }
              } else {
                // If the user has no game account, initialize one
                userDatabase.prepare('INSERT INTO SubUsers (uuid, name, pass, plugins, state, externalEvent, server, proxyHost, proxyPort, proxyUser, proxyPass, proxyType, proxyEnabled) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
                  .run(targetUuid, email, "", '{}', 0, 0, server || 34, "", null, "", "", "SOCKS5", 0)
              }
            }

            // 4. Update game server in SubUsers if provided
            if (server !== undefined) {
              const subUsers = getUser(targetUuid)
              const targetSubUser = subUserId
                ? subUsers.find(su => su.id === Number(subUserId))
                : (subUsers.length > 0 ? subUsers[0] : null)

              if (targetSubUser) {
                const oldServer = targetSubUser.server
                if (Number(server) !== Number(oldServer)) {
                  userDatabase.prepare('UPDATE SubUsers SET server = ? WHERE id = ?').run(Number(server), targetSubUser.id)
                  targetSubUser.server = Number(server) // Update in-memory reference

                  // If bot is active (running), restart it
                  const worker = botMap.get(targetSubUser.id)
                  if (worker !== undefined) {
                    try {
                      const msgBuf = worker.messageBuffer
                      const msgBufCount = worker.messageBufferCount
                      removeBot(targetSubUser.id)
                      const updatedUser = getSpecificUser(targetUuid, { id: targetSubUser.id })
                      await createBot(targetUuid, updatedUser, msgBuf, msgBufCount)
                    } catch (e) {
                      console.warn("Failed to restart bot on admin server change:", e)
                    }
                  }
                }
              }
            }

            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminUpdateUserProfile, { success: true }]))

            // Notify all admins of the updated user list
            const dashboardUsers = getAllDashboardUsers()
            for (const loggedInUuid of Object.keys(loggedInUsers)) {
              if (getPrivilege(loggedInUuid) === 1) {
                loggedInUsers[loggedInUuid].forEach(({ ws: adminWs }) => {
                  adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, dashboardUsers]))
                })
              }
            }

            // Notify the target user if they are currently online to refresh their UI
            if (loggedInUsers[targetUuid]) {
              const filteredPlugins = getVisiblePluginsForUser(targetUuid)
              loggedInUsers[targetUuid].forEach(({ ws: uWs }) => {
                uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetUsers, [getUser(targetUuid), filteredPlugins]]))
              })
            }
          } catch (e) {
            console.error(e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminUpdateUserProfile, { error: e.message }]))
          }
          break
        }
        case ActionType.RenewSubscription: {
          try {
            const userRow = userDatabase.prepare('SELECT credits, subscriptionExpiry FROM Users WHERE uuid = ?').get(uuid)
            const currentCredits = userRow ? (userRow.credits || 0) : 0
            if (currentCredits < 300) {
              ws.send(JSON.stringify([ErrorType.Generic, ActionType.RenewSubscription, { error: 'insufficientCredits' }]))
              break
            }

            // Deduct 300 credits
            const newCredits = currentCredits - 300

            // Calculate new expiry date: 30 days from now (or from current expiry date if it is in the future)
            let baseDate = new Date()
            if (userRow.subscriptionExpiry) {
              const currentExpiry = new Date(userRow.subscriptionExpiry)
              if (currentExpiry.getTime() > baseDate.getTime()) {
                baseDate = currentExpiry
              }
            }

            baseDate.setDate(baseDate.getDate() + 30)
            const year = baseDate.getFullYear()
            const month = String(baseDate.getMonth() + 1).padStart(2, '0')
            const day = String(baseDate.getDate()).padStart(2, '0')
            const newExpiryStr = `${year}-${month}-${day}`

            userDatabase.prepare("UPDATE Users SET credits = ?, subscriptionPlan = 'pro', subscriptionExpiry = ?, maxGameAccounts = MAX(maxGameAccounts, 1) WHERE uuid = ?")
              .run(newCredits, newExpiryStr, uuid)

            ws.send(JSON.stringify([ErrorType.Success, ActionType.RenewSubscription, { success: true }]))

            // Sync Telegram Pollers on main thread
            syncTelegramPollers()

            // Send updated profile
            const updatedRow = userDatabase.prepare('SELECT username, privilege, maxGameAccounts, subscriptionPlan, subscriptionExpiry, subscriptionAlliance, credits FROM Users WHERE uuid = ?').get(uuid)
            loggedInUsers[uuid]?.forEach(({ ws: uWs }) => {
              uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetProfile, {
                username: updatedRow.username,
                privilege: updatedRow.privilege,
                maxGameAccounts: updatedRow.maxGameAccounts,
                subscriptionPlan: updatedRow.subscriptionPlan || "pro",
                subscriptionExpiry: updatedRow.subscriptionExpiry || "",
                subscriptionAlliance: updatedRow.subscriptionAlliance || "",
                credits: updatedRow.credits || 0
              }]))

              // Also refresh users list (they are now subscribed)
              uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetUsers, [getUser(uuid), getVisiblePluginsForUser(uuid)]]))
            })
          } catch (e) {
            console.error("Failed to renew subscription:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.RenewSubscription, { error: e.message }]))
          }
          break
        }
        case ActionType.GetNotifications: {
          try {
            const notifications = userDatabase.prepare('SELECT id, message, isRead, createdAt FROM UserNotifications WHERE uuid = ? ORDER BY id DESC').all(uuid)
            ws.send(JSON.stringify([ErrorType.Success, ActionType.GetNotifications, notifications]))
          } catch (e) {
            console.error("Failed to get notifications:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.GetNotifications, []]))
          }
          break
        }
        case ActionType.ReadNotification: {
          try {
            const { notificationId } = obj
            if (!notificationId) {
              throw new Error("Missing notificationId")
            }
            userDatabase.prepare('UPDATE UserNotifications SET isRead = 1 WHERE id = ? AND uuid = ?').run(notificationId, uuid)

            // Send updated list back to user
            const notifications = userDatabase.prepare('SELECT id, message, isRead, createdAt FROM UserNotifications WHERE uuid = ? ORDER BY id DESC').all(uuid)
            ws.send(JSON.stringify([ErrorType.Success, ActionType.GetNotifications, notifications]))
          } catch (e) {
            console.error("Failed to read notification:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.ReadNotification, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminSendNotification: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminSendNotification, {}]))
            break
          }
          try {
            const { targetUuid, message } = obj
            if (!message) {
              throw new Error("Message cannot be empty")
            }
            const createdAt = new Date().toISOString()

            if (targetUuid === 'all' || !targetUuid) {
              // Global notification for all users
              const allUsers = userDatabase.prepare('SELECT uuid FROM Users').all()
              const insertStmt = userDatabase.prepare('INSERT INTO UserNotifications (uuid, message, isRead, createdAt) VALUES (?, ?, 0, ?)')
              for (const userRow of allUsers) {
                insertStmt.run(userRow.uuid, message, createdAt)
              }

              // Broadcast to all currently online users
              for (const onlineUuid of Object.keys(loggedInUsers)) {
                const userNotifs = userDatabase.prepare('SELECT id, message, isRead, createdAt FROM UserNotifications WHERE uuid = ? ORDER BY id DESC').all(onlineUuid)
                loggedInUsers[onlineUuid].forEach(({ ws: uWs }) => {
                  uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetNotifications, userNotifs]))
                })
              }
            } else {
              // Specific user notification
              userDatabase.prepare('INSERT INTO UserNotifications (uuid, message, isRead, createdAt) VALUES (?, ?, 0, ?)')
                .run(targetUuid, message, createdAt)

              // Notify the targeted user if they are online
              if (loggedInUsers[targetUuid]) {
                const userNotifs = userDatabase.prepare('SELECT id, message, isRead, createdAt FROM UserNotifications WHERE uuid = ? ORDER BY id DESC').all(targetUuid)
                loggedInUsers[targetUuid].forEach(({ ws: uWs }) => {
                  uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetNotifications, userNotifs]))
                })
              }
            }

            broadcastAdminNotifications()
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminSendNotification, { success: true }]))
          } catch (e) {
            console.error("Failed to send admin notification:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminSendNotification, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminDeleteNotification: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminDeleteNotification, {}]))
            break
          }
          try {
            const { message, createdAt } = obj
            if (!message || !createdAt) {
              throw new Error("Message and createdAt are required")
            }
            userDatabase.prepare('DELETE FROM UserNotifications WHERE message = ? AND createdAt = ?').run(message, createdAt)

            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminDeleteNotification, { success: true }]))

            broadcastAdminNotifications()

            // Notify all online users to refresh their notifications
            for (const onlineUuid of Object.keys(loggedInUsers)) {
              const userNotifs = userDatabase.prepare('SELECT id, message, isRead, createdAt FROM UserNotifications WHERE uuid = ? ORDER BY id DESC').all(onlineUuid)
              loggedInUsers[onlineUuid].forEach(({ ws: uWs }) => {
                uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetNotifications, userNotifs]))
              })
            }
          } catch (e) {
            console.error("Failed to delete admin notification:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminDeleteNotification, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminGetSentNotifications: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminGetSentNotifications, {}]))
            break
          }
          try {
            const query = `
              SELECT 
                MIN(un.id) as id, 
                un.uuid, 
                u.username, 
                un.message, 
                un.createdAt, 
                COUNT(*) as recipientCount
              FROM UserNotifications un
              LEFT JOIN Users u ON un.uuid = u.uuid
              GROUP BY un.message, un.createdAt
              ORDER BY un.createdAt DESC
            `
            const notifications = userDatabase.prepare(query).all()
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetSentNotifications, notifications]))
          } catch (e) {
            console.error("Failed to get sent notifications:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminGetSentNotifications, []]))
          }
          break
        }
        case ActionType.CreateCreditRequest: {
          try {
            const { amount, pricePaid, senderNumber, screenshotPath, promoCode } = obj
            if (!amount || !pricePaid || !senderNumber || !screenshotPath) {
              throw new Error('Missing required parameters')
            }

            // [Security] screenshotPath must be a safe relative path under uploads/
            const safePath = String(screenshotPath).replace(/\\/g, '/')
            if (!/^uploads\/screenshot_[\w\-]+\.(png|jpg|jpeg|webp|gif)$/i.test(safePath)) {
              throw new Error('Invalid screenshot path')
            }

            // [Security] Confirm the file actually exists (was uploaded via /api/upload-screenshot)
            const fullPath = path.join(__dirname, safePath)
            try { await fs.access(fullPath) } catch { throw new Error('Screenshot not found. Please re-upload.') }

            const createdAt = new Date().toISOString()
            userDatabase.prepare('INSERT INTO CreditRequests (uuid, amount, pricePaid, senderNumber, screenshotPath, promoCode, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(uuid, Number(amount), Number(pricePaid), String(senderNumber).trim(), safePath, promoCode || null, 'pending', createdAt)

            ws.send(JSON.stringify([ErrorType.Success, ActionType.CreateCreditRequest, { success: true }]))

            // Notify Admins on Telegram
            try {
              const username = userDatabase.prepare('SELECT username FROM Users WHERE uuid = ?').get(uuid)?.username || 'Unknown'
              sendAdminTelegramNotification(
                `💳 New Credit Request\nUser: ${username}\nAmount: ${amount} Credits\nPrice Paid: ${pricePaid} EGP\nSender: ${senderNumber}\nPromo: ${promoCode || 'None'}`
              )
            } catch (tgErr) {
              console.error("Failed to notify admins of credit request on Telegram:", tgErr)
            }

            try {
              const requests = userDatabase.prepare(`
                SELECT cr.*, u.username
                FROM CreditRequests cr
                LEFT JOIN Users u ON cr.uuid = u.uuid
                ORDER BY cr.id DESC
              `).all()
              for (const adminUuid of Object.keys(loggedInUsers)) {
                if (getPrivilege(adminUuid) === 1) {
                  loggedInUsers[adminUuid].forEach(({ ws: adminWs }) => {
                    adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetCreditRequests, requests]))
                  })
                }
              }
            } catch (adminNotifErr) {
              console.error("Error notifying admins of new credit request:", adminNotifErr)
            }
          } catch (e) {
            console.error("Failed to create credit request:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.CreateCreditRequest, { error: e.message }]))
          }
          break
        }
        case ActionType.ValidatePromoCode: {
          try {
            const { code } = obj
            if (!code) {
              ws.send(JSON.stringify([ErrorType.Success, ActionType.ValidatePromoCode, { valid: false, error: 'empty_code' }]))
              break
            }
            const row = userDatabase.prepare('SELECT * FROM PromoCodes WHERE code = ? AND active = 1').get(code)
            if (row) {
              if (row.expiryDate) {
                const expiry = new Date(row.expiryDate)
                expiry.setHours(23, 59, 59, 999)
                if (expiry.getTime() < Date.now()) {
                  ws.send(JSON.stringify([ErrorType.Success, ActionType.ValidatePromoCode, { valid: false, error: 'expired' }]))
                  break
                }
              }
              if (row.maxUses !== null && row.maxUses !== undefined && row.maxUses > 0) {
                if ((row.usedCount || 0) >= row.maxUses) {
                  ws.send(JSON.stringify([ErrorType.Success, ActionType.ValidatePromoCode, { valid: false, error: 'usage_limit_reached' }]))
                  break
                }
              }
              ws.send(JSON.stringify([ErrorType.Success, ActionType.ValidatePromoCode, { valid: true, code: row.code, creditAmount: row.creditAmount, price: row.price }]))
            } else {
              ws.send(JSON.stringify([ErrorType.Success, ActionType.ValidatePromoCode, { valid: false, error: 'invalid_code' }]))
            }
          } catch (e) {
            console.error("Failed to validate promo code:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.ValidatePromoCode, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminGetCreditRequests: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminGetCreditRequests, {}]))
            break
          }
          try {
            const requests = userDatabase.prepare(`
              SELECT cr.*, u.username
              FROM CreditRequests cr
              LEFT JOIN Users u ON cr.uuid = u.uuid
              ORDER BY cr.id DESC
            `).all()
            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetCreditRequests, requests]))
          } catch (e) {
            console.error("Failed to get credit requests:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminGetCreditRequests, {}]))
          }
          break
        }
        case ActionType.AdminHandleCreditRequest: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminHandleCreditRequest, {}]))
            break
          }
          try {
            const { requestId, status } = obj
            if (!requestId || !status) {
              throw new Error("Missing parameters")
            }

            const request = userDatabase.prepare('SELECT * FROM CreditRequests WHERE id = ?').get(requestId)
            if (!request) {
              throw new Error("Request not found")
            }
            if (request.status !== 'pending') {
              throw new Error("Request has already been processed")
            }

            if (status === 'approved') {
              userDatabase.prepare('UPDATE Users SET credits = COALESCE(credits, 0) + ? WHERE uuid = ?').run(Number(request.amount), request.uuid)
              userDatabase.prepare('UPDATE CreditRequests SET status = ? WHERE id = ?').run('approved', requestId)
              if (request.promoCode) {
                userDatabase.prepare('UPDATE PromoCodes SET usedCount = COALESCE(usedCount, 0) + 1 WHERE code = ?').run(request.promoCode)
              }

              const msgAr = `تمت الموافقة على طلب شحن الرصيد الخاص بك وإضافة ${request.amount} رصيد.`
              const msgEn = `Your credit request of ${request.amount} has been approved.`
              const msg = `${msgAr} / ${msgEn}`
              const createdAt = new Date().toISOString()
              userDatabase.prepare('INSERT INTO UserNotifications (uuid, message, isRead, createdAt) VALUES (?, ?, 0, ?)')
                .run(request.uuid, msg, createdAt)
            } else if (status === 'rejected') {
              userDatabase.prepare('UPDATE CreditRequests SET status = ? WHERE id = ?').run('rejected', requestId)

              const msgAr = `تم رفض طلب شحن الرصيد الخاص بك.`
              const msgEn = `Your credit request has been rejected.`
              const msg = `${msgAr} / ${msgEn}`
              const createdAt = new Date().toISOString()
              userDatabase.prepare('INSERT INTO UserNotifications (uuid, message, isRead, createdAt) VALUES (?, ?, 0, ?)')
                .run(request.uuid, msg, createdAt)
            } else {
              throw new Error("Invalid status")
            }

            ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminHandleCreditRequest, { success: true }]))

            try {
              const requests = userDatabase.prepare(`
                SELECT cr.*, u.username
                FROM CreditRequests cr
                LEFT JOIN Users u ON cr.uuid = u.uuid
                ORDER BY cr.id DESC
              `).all()
              for (const adminUuid of Object.keys(loggedInUsers)) {
                if (getPrivilege(adminUuid) === 1) {
                  loggedInUsers[adminUuid].forEach(({ ws: adminWs }) => {
                    adminWs.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetCreditRequests, requests]))
                  })
                }
              }
            } catch (err) {
              console.error("Failed to broadcast updated credit requests:", err)
            }

            if (loggedInUsers[request.uuid]) {
              const targetRow = userDatabase.prepare('SELECT username, privilege, maxGameAccounts, subscriptionPlan, subscriptionExpiry, subscriptionAlliance, credits FROM Users WHERE uuid = ?').get(request.uuid)
              const userNotifs = userDatabase.prepare('SELECT id, message, isRead, createdAt FROM UserNotifications WHERE uuid = ? ORDER BY id DESC').all(request.uuid)
              loggedInUsers[request.uuid].forEach(({ ws: uWs }) => {
                uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetProfile, {
                  username: targetRow.username,
                  privilege: targetRow.privilege,
                  maxGameAccounts: targetRow.maxGameAccounts,
                  subscriptionPlan: targetRow.subscriptionPlan || "none",
                  subscriptionExpiry: targetRow.subscriptionExpiry || "",
                  subscriptionAlliance: targetRow.subscriptionAlliance || "",
                  credits: targetRow.credits || 0
                }]))
                uWs.send(JSON.stringify([ErrorType.Success, ActionType.GetNotifications, userNotifs]))
              })
            }
          } catch (e) {
            console.error("Failed to handle credit request:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminHandleCreditRequest, { error: e.message }]))
          }
          break
        }
        case ActionType.AdminManagePromoCodes: {
          const privilege = getPrivilege(uuid)
          if (privilege !== 1) {
            ws.send(JSON.stringify([ErrorType.Unauthenticated, ActionType.AdminManagePromoCodes, {}]))
            break
          }
          try {
            const { action: subAction, code, creditAmount, price, maxUses, expiryDate } = obj
            if (subAction === 'list') {
              const list = userDatabase.prepare('SELECT * FROM PromoCodes ORDER BY code ASC').all()
              ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminManagePromoCodes, list]))
            } else if (subAction === 'create') {
              if (!code || !creditAmount || !price) {
                throw new Error("Missing parameters for promo code creation")
              }
              const parsedMaxUses = maxUses && Number(maxUses) > 0 ? Number(maxUses) : null
              const parsedExpiryDate = expiryDate && expiryDate.trim() !== '' ? expiryDate.trim() : null

              userDatabase.prepare('INSERT INTO PromoCodes (code, creditAmount, price, active, maxUses, usedCount, expiryDate) VALUES (?, ?, ?, 1, ?, 0, ?)')
                .run(code.trim(), Number(creditAmount), Number(price), parsedMaxUses, parsedExpiryDate)

              const list = userDatabase.prepare('SELECT * FROM PromoCodes ORDER BY code ASC').all()
              ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminManagePromoCodes, list]))
            } else if (subAction === 'delete') {
              if (!code) {
                throw new Error("Missing parameters for promo code deletion")
              }
              userDatabase.prepare('DELETE FROM PromoCodes WHERE code = ?').run(code)

              const list = userDatabase.prepare('SELECT * FROM PromoCodes ORDER BY code ASC').all()
              ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminManagePromoCodes, list]))
            } else {
              throw new Error("Invalid promo code action")
            }
          } catch (e) {
            console.error("Failed to manage promo codes:", e)
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.AdminManagePromoCodes, { error: e.message }]))
          }
          break
        }
        default:
          ws.send(JSON.stringify([ErrorType.UnknownAction, ActionType.Unknown, {}]))
      }
    })
    ws.addListener('close', () => {
      if (!uuid || !loggedInUsers[uuid])
        return
      let index = loggedInUsers[uuid].findIndex((obj) => obj.ws == ws)
      if (index !== -1) {
        loggedInUsers[uuid].splice(index, 1)
      }
      if (loggedInUsers[uuid].length == 0) {
        delete loggedInUsers[uuid]
      }
    })
  })

  function propagateTelegramConfigToWorkers(uuid) {
    try {
      const row = userDatabase.prepare('SELECT telegramToken, telegramChatId, telegramEnabled, telegramAlertSettings, allowedAlerts FROM Users WHERE uuid = ?').get(uuid)
      if (!row) return
      const subUsers = getUser(uuid)
      for (const subUser of subUsers) {
        const worker = botMap.get(subUser.id)
        if (worker) {
          worker.postMessage([ActionType.SetTelegramConfig, {
            telegramToken: row.telegramToken || "",
            telegramChatId: row.telegramChatId || "",
            telegramEnabled: !!row.telegramEnabled,
            telegramAlertSettings: row.telegramAlertSettings || "",
            allowedAlerts: row.allowedAlerts || ""
          }])
        }
      }
    } catch (e) {
      console.error("Failed to propagate Telegram config:", e)
    }
  }

  function getTelegramLanguage(uuid) {
    try {
      const row = userDatabase.prepare('SELECT telegramLanguage FROM Users WHERE uuid = ?').get(uuid)
      return (row && row.telegramLanguage) || 'ar'
    } catch (e) {
      return 'ar'
    }
  }

  function getMainMenuContent(uuid) {
    const lang = getTelegramLanguage(uuid)
    let text, reply_markup
    if (lang === 'ar') {
      text = `⚙️ *لوحة التحكم الرئيسية*\n\nمرحباً بك! يمكنك إدارة البوت وتعديل الإعدادات والتحكم في الحسابات من هنا.`
      reply_markup = {
        inline_keyboard: [
          [
            { text: "📊 حالة البوت", callback_data: "menu:status" },
            { text: "⚙️ إعدادات التنبيهات", callback_data: "menu:settings" }
          ],
          [
            { text: "🎮 حسابات اللعبة", callback_data: "menu:accounts" },
            { text: "❓ المساعدة والاوامر", callback_data: "menu:help" }
          ]
        ]
      }
    } else {
      text = `⚙️ *Main Control Panel*\n\nWelcome! You can manage your bot, adjust settings, and control game accounts here.`
      reply_markup = {
        inline_keyboard: [
          [
            { text: "📊 Status Report", callback_data: "menu:status" },
            { text: "⚙️ Alert Settings", callback_data: "menu:settings" }
          ],
          [
            { text: "🎮 Game Accounts", callback_data: "menu:accounts" },
            { text: "❓ Help & Commands", callback_data: "menu:help" }
          ]
        ]
      }
    }
    return { text, reply_markup }
  }

  function getSettingsMenuContent(uuid) {
    const userRow = userDatabase.prepare('SELECT telegramEnabled, telegramAlertSettings, telegramLanguage FROM Users WHERE uuid = ?').get(uuid)
    const lang = (userRow && userRow.telegramLanguage) || 'ar'
    let settings = {
      incomingMe: true,
      incomingAlliance: true,
      outgoingMe: true,
      outgoingAlliance: true,
      errors: true,
      system: true,
      chat: true,
      fortress: true
    }
    if (userRow && userRow.telegramAlertSettings) {
      try {
        settings = { ...settings, ...JSON.parse(userRow.telegramAlertSettings) }
      } catch (e) { }
    }

    let text, reply_markup
    if (lang === 'ar') {
      text = `🔔 *إعدادات تنبيهات التيليجرام*\n\nقم بتخصيص التنبيهات التي ترغب في تلقيها على هذا الحساب.`
      reply_markup = {
        inline_keyboard: [
          [
            { text: `التنبيهات: ${userRow?.telegramEnabled ? '🟢 مفعلة' : '🔴 معطلة'}`, callback_data: `toggle_alert:telegramEnabled` }
          ],
          [
            { text: `${settings.incomingMe ? '✅' : '❌'} هجوم عليّ`, callback_data: `toggle_alert:incomingMe` },
            { text: `${settings.incomingAlliance ? '✅' : '❌'} هجوم تحالف`, callback_data: `toggle_alert:incomingAlliance` }
          ],
          [
            { text: `${settings.outgoingMe ? '✅' : '❌'} هجماتي`, callback_data: `toggle_alert:outgoingMe` },
            { text: `${settings.outgoingAlliance ? '✅' : '❌'} هجمات تحالف`, callback_data: `toggle_alert:outgoingAlliance` }
          ],
          [
            { text: `${settings.chat ? '✅' : '❌'} دردشة التحالف`, callback_data: `toggle_alert:chat` },
            { text: `${settings.fortress ? '✅' : '❌'} الأبراج والقلاع`, callback_data: `toggle_alert:fortress` }
          ],
          [
            { text: `${settings.errors ? '✅' : '❌'} أخطاء البوت`, callback_data: `toggle_alert:errors` },
            { text: `${settings.system ? '✅' : '❌'} سجلات النظام`, callback_data: `toggle_alert:system` }
          ],
          [
            { text: `🌐 لغة البوت: العربية 🇸🇦`, callback_data: `toggle_lang` }
          ],
          [
            { text: "🔙 العودة للقائمة", callback_data: "menu:main" }
          ]
        ]
      }
    } else {
      text = `🔔 *Telegram Notification Settings*\n\nCustomize which notifications you want to receive on this account.`
      reply_markup = {
        inline_keyboard: [
          [
            { text: `Notifications: ${userRow?.telegramEnabled ? '🟢 Enabled' : '🔴 Disabled'}`, callback_data: `toggle_alert:telegramEnabled` }
          ],
          [
            { text: `${settings.incomingMe ? '✅' : '❌'} Attacks on Me`, callback_data: `toggle_alert:incomingMe` },
            { text: `${settings.incomingAlliance ? '✅' : '❌'} Alliance Attacks`, callback_data: `toggle_alert:incomingAlliance` }
          ],
          [
            { text: `${settings.outgoingMe ? '✅' : '❌'} My Outgoing`, callback_data: `toggle_alert:outgoingMe` },
            { text: `${settings.outgoingAlliance ? '✅' : '❌'} Alliance Outgoing`, callback_data: `toggle_alert:outgoingAlliance` }
          ],
          [
            { text: `${settings.chat ? '✅' : '❌'} Alliance Chat`, callback_data: `toggle_alert:chat` },
            { text: `${settings.fortress ? '✅' : '❌'} Towers & Fortress`, callback_data: `toggle_alert:fortress` }
          ],
          [
            { text: `${settings.errors ? '✅' : '❌'} Bot Errors`, callback_data: `toggle_alert:errors` },
            { text: `${settings.system ? '✅' : '❌'} System Logs`, callback_data: `toggle_alert:system` }
          ],
          [
            { text: `🌐 Bot Language: English 🇬🇧`, callback_data: `toggle_lang` }
          ],
          [
            { text: "🔙 Back to Menu", callback_data: "menu:main" }
          ]
        ]
      }
    }
    return { text, reply_markup }
  }

  function getAccountsMenuContent(uuid) {
    const lang = getTelegramLanguage(uuid)
    const subUsers = getUser(uuid)

    let text, backText
    if (lang === 'ar') {
      text = `🎮 *حسابات اللعبة المضافة*\n\nاختر الحساب الذي ترغب في تشغيله/إيقافه أو تعديل إضافاته.`
      backText = "🔙 العودة للقائمة"
    } else {
      text = `🎮 *Added Game Accounts*\n\nSelect an account to start/stop or manage its plugins.`
      backText = "🔙 Back to Menu"
    }

    const buttons = []
    for (const subUser of subUsers) {
      const isRunning = botMap.get(subUser.id) !== undefined
      buttons.push([{
        text: `${isRunning ? '🟢' : '🔴'} ${subUser.name}`,
        callback_data: `account_info:${subUser.id}`
      }])
    }
    buttons.push([{ text: backText, callback_data: "menu:main" }])

    const reply_markup = { inline_keyboard: buttons }
    return { text, reply_markup }
  }

  function getBotCastles(accountId) {
    const statusData = botStatuses.get(accountId)
    return (statusData && statusData.production) || []
  }

  function getAccountInfoContent(uuid, accountId) {
    const lang = getTelegramLanguage(uuid)
    const subUsers = getUser(uuid)
    const subUser = subUsers.find(su => String(su.id) === String(accountId))
    if (!subUser) {
      if (lang === 'ar') {
        return { text: `⚠️ *الحساب غير موجود.*`, reply_markup: { inline_keyboard: [[{ text: "🔙 العودة", callback_data: "menu:accounts" }]] } }
      } else {
        return { text: `⚠️ *Account not found.*`, reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu:accounts" }]] } }
      }
    }

    const isRunning = botMap.get(subUser.id) !== undefined
    const statusData = botStatuses.get(subUser.id)

    let text, reply_markup
    if (lang === 'ar') {
      text = `🎮 *تفاصيل الحساب*\n\n` +
        `👤 *الاسم:* ${subUser.name}\n` +
        `🆔 *المعرف:* ${subUser.id}\n` +
        `⚡ *الحالة:* ${isRunning ? '🟢 يعمل' : '🔴 متوقف'}\n`

      if (isRunning && statusData) {
        text += `📈 *المستوى:* ${statusData.level || 'غير معروف'}\n` +
          `🪙 *النقود:* ${statusData.cash !== undefined ? statusData.cash.toLocaleString() : 'N/A'}\n` +
          `💎 *الياقوت:* ${statusData.gold !== undefined ? statusData.gold.toLocaleString() : 'N/A'}\n` +
          `🔄 *الطلبات:* ${statusData.requestCount || 0}\n` +
          `❌ *الأخطاء:* ${statusData.errorCount || 0}\n`
      }

      const inline_keyboard = [
        [
          { text: isRunning ? "🔴 إيقاف البوت" : "🟢 تشغيل البوت", callback_data: `toggle_bot:${subUser.id}` },
          { text: "🧩 تعديل الإضافات", callback_data: `account_plugins:${subUser.id}` }
        ],
        [
          { text: "📝 السجلات (آخر 10)", callback_data: `view_logs:${subUser.id}` }
        ]
      ]

      if (isRunning) {
        inline_keyboard.push(
          [
            { text: "✏️ تغيير اسم اللاعب", callback_data: `action_rename_account:${subUser.id}` },
            { text: "🏰 تغيير اسم قلعة", callback_data: `action_select_castle_rename:${subUser.id}` }
          ],
          [
            { text: "🚪 فتح البوابة", callback_data: `action_select_castle_gate:${subUser.id}` },
            { text: "✉️ رسالة لاعب", callback_data: `action_send_msg:${subUser.id}` }
          ],
          [
            { text: "📦 إرسال موارد", callback_data: `action_select_castle_resources:${subUser.id}` }
          ]
        )
      }

      inline_keyboard.push([
        { text: "🔙 العودة للحسابات", callback_data: "menu:accounts" }
      ])

      reply_markup = { inline_keyboard }
    } else {
      text = `🎮 *Account Details*\n\n` +
        `👤 *Name:* ${subUser.name}\n` +
        `🆔 *ID:* ${subUser.id}\n` +
        `⚡ *Status:* ${isRunning ? '🟢 Running' : '🔴 Stopped'}\n`

      if (isRunning && statusData) {
        text += `📈 *Level:* ${statusData.level || 'Unknown'}\n` +
          `🪙 *Coins:* ${statusData.cash !== undefined ? statusData.cash.toLocaleString() : 'N/A'}\n` +
          `💎 *Rubies:* ${statusData.gold !== undefined ? statusData.gold.toLocaleString() : 'N/A'}\n` +
          `🔄 *Requests:* ${statusData.requestCount || 0}\n` +
          `❌ *Errors:* ${statusData.errorCount || 0}\n`
      }

      const inline_keyboard = [
        [
          { text: isRunning ? "🔴 Stop Bot" : "🟢 Start Bot", callback_data: `toggle_bot:${subUser.id}` },
          { text: "🧩 Manage Plugins", callback_data: `account_plugins:${subUser.id}` }
        ],
        [
          { text: "📝 Logs (Last 10)", callback_data: `view_logs:${subUser.id}` }
        ]
      ]

      if (isRunning) {
        inline_keyboard.push(
          [
            { text: "✏️ Rename Player", callback_data: `action_rename_account:${subUser.id}` },
            { text: "🏰 Rename Castle", callback_data: `action_select_castle_rename:${subUser.id}` }
          ],
          [
            { text: "🚪 Open Gate", callback_data: `action_select_castle_gate:${subUser.id}` },
            { text: "✉️ Send Message", callback_data: `action_send_msg:${subUser.id}` }
          ],
          [
            { text: "📦 Send Resources", callback_data: `action_select_castle_resources:${subUser.id}` }
          ]
        )
      }

      inline_keyboard.push([
        { text: "🔙 Back to Accounts", callback_data: "menu:accounts" }
      ])

      reply_markup = { inline_keyboard }
    }

    return { text, reply_markup }
  }

  function getAccountPluginsContent(uuid, accountId) {
    const lang = getTelegramLanguage(uuid)
    const subUsers = getUser(uuid)
    const subUser = subUsers.find(su => String(su.id) === String(accountId))
    if (!subUser) {
      if (lang === 'ar') {
        return { text: `⚠️ *الحساب غير موجود.*`, reply_markup: { inline_keyboard: [[{ text: "🔙 العودة", callback_data: "menu:accounts" }]] } }
      } else {
        return { text: `⚠️ *Account not found.*`, reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu:accounts" }]] } }
      }
    }

    const visiblePlugins = getVisiblePluginsForUser(uuid)

    let text, backText
    if (lang === 'ar') {
      text = `🧩 *إضافات الحساب*\n👤 *الحساب:* ${subUser.name}\n\nاضغط لتفعيل أو إيقاف أي إضافة محددة للحساب:`
      backText = "🔙 العودة لتفاصيل الحساب"
    } else {
      text = `🧩 *Account Plugins*\n👤 *Account:* ${subUser.name}\n\nToggle specific plugins for this account:`
      backText = "🔙 Back to Account"
    }

    const buttons = []
    for (let i = 0; i < visiblePlugins.length; i += 2) {
      const row = []
      const p1 = visiblePlugins[i]
      const p1State = !!subUser.plugins[p1.key]?.state
      row.push({
        text: `${p1State ? '✅' : '❌'} ${p1.key}`,
        callback_data: `toggle_plugin:${accountId}:${p1.key}`
      })

      if (i + 1 < visiblePlugins.length) {
        const p2 = visiblePlugins[i + 1]
        const p2State = !!subUser.plugins[p2.key]?.state
        row.push({
          text: `${p2State ? '✅' : '❌'} ${p2.key}`,
          callback_data: `toggle_plugin:${accountId}:${p2.key}`
        })
      }
      buttons.push(row)
    }

    buttons.push([{ text: backText, callback_data: `account_info:${accountId}` }])

    const reply_markup = { inline_keyboard: buttons }
    return { text, reply_markup }
  }

  function getHelpMenuContent(uuid) {
    const lang = getTelegramLanguage(uuid)
    let text, reply_markup
    if (lang === 'ar') {
      text = `📊 *أوامر الترتيب والألعاب*\n\n` +
        `يمكنك كتابة أو النقر على الأوامر التالية للحصول على الترتيب:\n` +
        `⚔️ /nomads - ترتيب الرحل\n` +
        `👺 /samurai - ترتيب الساموراي\n` +
        `🩸 /bloodcrows - ترتيب الغربان\n` +
        `👑 /warofrealms - ترتيب حرب الممالك\n` +
        `🎖️ /honour - البحث عن أهداف للمجد\n` +
        `🏰 /berimond - معركة بيريموند\n` +
        `⛈️ /storm - ترتيب الجزر\n` +
        `💰 /loot - ترتيب النهب\n` +
        `🏆 /storm_top_players - متصدري الجزر\n` +
        `🎯 /grandtournament - البطولة الكبرى\n` +
        `🕊️ /birded - قائمة الحمام\n\n` +
        `📋 *أوامر التحكم بالحساب:*\n` +
        `⚙️ /renameaccount <الاسم_الجديد> - تغيير اسم الحساب\n` +
        `🏰 /renamecastle <القلعة> <الاسم_الجديد> - تغيير اسم القلعة/القاعدة\n` +
        `🚪 /opengate <القلعة> <6_أو_12> - فتح/تمديد البوابة\n` +
        `✉️ /sendmessage <اللاعب> <الموضوع> | <الرسالة> - إرسال رسالة مباشرة للاعب\n` +
        `📦 /sendresources <القلعة> <X> <Y> <الخشب> <الحجر> [الطعام] - إرسال موارد`
      reply_markup = {
        inline_keyboard: [
          [
            { text: "🔙 العودة للقائمة", callback_data: "menu:main" }
          ]
        ]
      }
    } else {
      text = `📊 *Game Commands & Rankings*\n\n` +
        `You can type or click the following commands to check rankings:\n` +
        `⚔️ /nomads - Nomad rankings\n` +
        `👺 /samurai - Samurai rankings\n` +
        `🩸 /bloodcrows - Bloodcrows rankings\n` +
        `👑 /warofrealms - War of Realms rankings\n` +
        `🎖️ /honour - Search for honour targets\n` +
        `🏰 /berimond - Berimond battle rankings\n` +
        `⛈️ /storm - Storm island rankings\n` +
        `💰 /loot - Loot rankings\n` +
        `🏆 /storm_top_players - Storm top players\n` +
        `🎯 /grandtournament - Grand tournament rankings\n` +
        `🕊️ /birded - Birded players list\n\n` +
        `📋 *Account Management Commands:*\n` +
        `⚙️ /renameaccount <new_name> - Rename your account name\n` +
        `🏰 /renamecastle <castle_id_or_index> <new_name> - Rename a castle or outpost\n` +
        `🚪 /opengate <castle_id_or_index> <6_or_12> - Open or extend gate\n` +
        `✉️ /sendmessage <player_name> <subject> | <body> - Send private message to player\n` +
        `📦 /sendresources <castle> <x> <y> <wood> <stone> [food] - Send resources to coordinates`
      reply_markup = {
        inline_keyboard: [
          [
            { text: "🔙 Back to Menu", callback_data: "menu:main" }
          ]
        ]
      }
    }
    return { text, reply_markup }
  }

  function startTelegramPolling(uuid, token, chatId) {
    if (activeTelegramPollers.has(uuid)) {
      const existing = activeTelegramPollers.get(uuid)
      if (existing.token === token && existing.chatId === chatId) {
        return
      }
      existing.stop()
    }

    let offset = 0
    let running = true

    const stop = () => {
      running = false
    }

    activeTelegramPollers.set(uuid, { token, chatId, stop })

    async function poll() {
      while (running) {
        try {
          const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=10`
          const response = await undici.request(url, { method: 'GET', headers: { 'Connection': 'keep-alive' } })

          if (!running) break

          if (response.statusCode === 200) {
            const body = await response.body.json()
            if (body.ok && body.result.length > 0) {
              for (const update of body.result) {
                offset = update.update_id + 1
                if (update.message && update.message.text) {
                  const msg = update.message
                  if (String(msg.chat.id) !== String(chatId)) {
                    continue
                  }
                  await handleTelegramCommand(uuid, token, chatId, msg.text)
                } else if (update.callback_query) {
                  const cb = update.callback_query
                  if (cb.message && String(cb.message.chat.id) === String(chatId)) {
                    try {
                      await undici.request(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ callback_query_id: cb.id })
                      })
                    } catch (err) { }
                    await handleTelegramCallback(uuid, token, chatId, cb)
                  }
                }
              }
            }
          } else if (response.statusCode === 409) {
            console.warn(`[Telegram Poller] 409 Conflict for token ${token.slice(0, 8)}... Stopping polling.`)
            running = false
            break
          } else {
            await new Promise(r => setTimeout(r, 5000))
          }
        } catch (e) {
          if (running) {
            await new Promise(r => setTimeout(r, 5000))
          }
        }
      }
      activeTelegramPollers.delete(uuid)
    }

    poll()
  }

  async function handleTelegramPendingInput(uuid, token, chatId, text, pending) {
    const lang = getTelegramLanguage(uuid)
    async function reply(msgText, replyMarkup = null) {
      try {
        const bodyObj = {
          chat_id: chatId,
          text: msgText,
          parse_mode: "Markdown"
        }
        if (replyMarkup) {
          bodyObj.reply_markup = replyMarkup
        }
        await undici.request(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyObj)
        })
      } catch (e) {
        console.warn("Failed to reply to Telegram pending input:", e)
      }
    }

    const subUsers = getUser(uuid)
    const runningWorker = subUsers.map(su => botMap.get(su.id)).find(w => w !== undefined)

    if (!runningWorker) {
      if (lang === 'ar') {
        await reply("⚠️ *حساب اللعبة متوقف.*\nلا يمكن تنفيذ الأمر بينما الحساب متوقف.")
      } else {
        await reply("⚠️ *Game Account Offline.*\nCannot execute command while account is offline.")
      }
      return
    }

    if (pending.type === "rename_account") {
      const newName = text.trim()
      if (newName.includes(" ")) {
        await reply(lang === 'ar' ? "❌ لا يمكن لاسم اللاعب أن يحتوي على مسافات." : "❌ Player name cannot contain spaces.")
        return
      }
      const sessionId = crypto.randomUUID().substring(0, 8)
      telegramRenameSession.set(sessionId, { accountId: pending.accountId, newName })

      const promptText = lang === 'ar'
        ? `❓ *تأكيد تغيير اسم الحساب*\n\nهل أنت متأكد من تغيير اسم الحساب إلى: \`${newName}\`؟`
        : `❓ *Confirm Account Name Change*\n\nAre you sure you want to change the account name to: \`${newName}\`?`

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: lang === 'ar' ? "✅ تأكيد" : "✅ Confirm", callback_data: `confirm_rename:${sessionId}` },
            { text: lang === 'ar' ? "❌ إلغاء" : "❌ Cancel", callback_data: `cancel_rename:${sessionId}` }
          ]
        ]
      }

      await reply(promptText, replyMarkup)
      return
    }

    if (pending.type === "rename_castle") {
      const newName = text.trim()
      runningWorker.postMessage(["TelegramCommand", { command: `/renamecastle ${pending.castleId} ${newName}`, chatId, token }])
      return
    }

    if (pending.type === "send_msg_recipient") {
      const recipient = text.trim()
      if (recipient.includes(" ")) {
        await reply(lang === 'ar' ? "❌ لا يمكن للاسم أن يحتوي على مسافات." : "❌ Name cannot contain spaces.")
        return
      }
      const promptText = lang === 'ar' ? "✍️ اكتب موضوع الرسالة (Subject):" : "✍️ Type the message subject:"
      await reply(promptText)
      pendingTelegramInputs.set(chatId, { type: "send_msg_subject", accountId: pending.accountId, recipientName: recipient })
      return
    }

    if (pending.type === "send_msg_subject") {
      const subject = text.trim()
      const promptText = lang === 'ar' ? "📝 اكتب نص الرسالة (Body):" : "📝 Type the message body:"
      await reply(promptText)
      pendingTelegramInputs.set(chatId, { type: "send_msg_body", accountId: pending.accountId, recipientName: pending.recipientName, subject })
      return
    }

    if (pending.type === "send_msg_body") {
      const body = text.trim()
      const cmd = `/sendmessage ${pending.recipientName} ${pending.subject} | ${body}`
      runningWorker.postMessage(["TelegramCommand", { command: cmd, chatId, token }])
      return
    }

    if (pending.type === "resource_player") {
      const playerName = text.trim()
      const sessionId = crypto.randomUUID().substring(0, 8)
      telegramResourceSession.set(sessionId, { accountId: pending.accountId, sourceCastleId: pending.sourceCastleId, targetPlayerName: playerName })
      await showResourceTypeMenu(token, chatId, sessionId, lang)
      return
    }

    if (pending.type === "resource_coords") {
      const parts = text.trim().split(/\s+/)
      const targetX = parseInt(parts[0], 10)
      const targetY = parseInt(parts[1], 10)
      if (isNaN(targetX) || isNaN(targetY)) {
        await reply(lang === 'ar' ? "❌ إحداثيات غير صالحة. يرجى كتابتها بالشكل: X Y (مثال: 654 631):" : "❌ Invalid coordinates. Please write them in X Y format (e.g. 654 631):")
        pendingTelegramInputs.set(chatId, pending) // Keep pending input active
        return
      }
      const sessionId = crypto.randomUUID().substring(0, 8)
      telegramResourceSession.set(sessionId, { accountId: pending.accountId, sourceCastleId: pending.sourceCastleId, targetX, targetY })
      await showResourceTypeMenu(token, chatId, sessionId, lang)
      return
    }
  }

  async function showResourceTypeMenu(token, chatId, sessionId, lang) {
    const text = lang === 'ar'
      ? "📦 *اختر نوع الموارد المراد إرسالها بالحد الأقصى:* "
      : "📦 *Select resource type to send at MAXIMUM possible:* "

    const reply_markup = {
      inline_keyboard: [
        [
          { text: lang === 'ar' ? "🪵 الخشب" : "🪵 Wood", callback_data: `send_res:${sessionId}:w` },
          { text: lang === 'ar' ? "🪨 الحجر" : "🪨 Stone", callback_data: `send_res:${sessionId}:s` }
        ],
        [
          { text: lang === 'ar' ? "🌾 الطعام" : "🌾 Food", callback_data: `send_res:${sessionId}:f` },
          { text: lang === 'ar' ? "🪵 🪨 خشب وحجر" : "🪵 🪨 Wood & Stone", callback_data: `send_res:${sessionId}:ws` }
        ],
        [
          { text: lang === 'ar' ? "🔥 الفحم" : "🔥 Coal", callback_data: `send_res:${sessionId}:c` },
          { text: lang === 'ar' ? "🛢️ النفط" : "🛢️ Oil", callback_data: `send_res:${sessionId}:o` }
        ],
        [
          { text: lang === 'ar' ? "🍯 العسل" : "🍯 Honey", callback_data: `send_res:${sessionId}:honey` },
          { text: lang === 'ar' ? "🍺 الميد" : "🍺 Mead", callback_data: `send_res:${sessionId}:mead` }
        ],
        [
          { text: lang === 'ar' ? "🔙 إلغاء" : "🔙 Cancel", callback_data: "menu:main" }
        ]
      ]
    }

    try {
      await undici.request(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "Markdown",
          reply_markup: reply_markup
        })
      })
    } catch (e) {
      console.warn("Failed to send resource selection menu:", e)
    }
  }

  async function handleTelegramCommand(uuid, token, chatId, text) {
    const pendingInput = pendingTelegramInputs.get(chatId)
    if (pendingInput) {
      pendingTelegramInputs.delete(chatId)
      await handleTelegramPendingInput(uuid, token, chatId, text, pendingInput)
      return
    }

    const parts = text.trim().split(/\s+/)
    let command = parts[0].toLowerCase()

    // Strip bot username suffix from command (e.g. /start@my_bot -> /start)
    const atIndex = command.indexOf('@')
    if (atIndex !== -1) {
      command = command.substring(0, atIndex)
    }

    // Standardize system commands to start with slash for matching
    if (command === 'start') command = '/start'
    if (command === 'help') command = '/help'
    if (command === 'status') command = '/status'
    if (command === 'settings') command = '/settings'
    if (command === 'alerts_on') command = '/alerts_on'
    if (command === 'alerts_off') command = '/alerts_off'

    // Normalize game actions
    let commandText = text
    if (command === 'تغيير_الحساب' || command === 'تغييرالحساب' || command === 'اسم_الحساب' || command === 'renameaccount' || command === '/renameaccount') {
      command = '/renameaccount'
      commandText = command + text.substring(parts[0].length)
    }
    if (command === 'تغيير_القلعة' || command === 'تغييرالقلعة' || command === 'اسم_القلعة' || command === 'renamecastle' || command === '/renamecastle') {
      command = '/renamecastle'
      commandText = command + text.substring(parts[0].length)
    }
    if (command === 'بوابة' || command === 'البوابة' || command === 'فتح_البوابة' || command === 'opengate' || command === '/opengate') {
      command = '/opengate'
      commandText = command + text.substring(parts[0].length)
    }
    if (command === 'رسالة' || command === 'ارسال_رسالة' || command === 'sendmessage' || command === '/sendmessage' || command === 'msg' || command === '/msg') {
      command = '/sendmessage'
      commandText = command + text.substring(parts[0].length)
    }
    if (command === 'موارد' || command === 'ارسال_موارد' || command === 'sendresources' || command === '/sendresources') {
      command = '/sendresources'
      commandText = command + text.substring(parts[0].length)
    }

    async function reply(msgText, replyMarkup = null) {
      try {
        const bodyObj = {
          chat_id: chatId,
          text: msgText,
          parse_mode: "Markdown"
        }
        if (replyMarkup) {
          bodyObj.reply_markup = replyMarkup
        }
        await undici.request(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyObj)
        })
      } catch (e) {
        console.warn("Failed to reply to Telegram:", e)
      }
    }

    const userRow = userDatabase.prepare('SELECT username, telegramEnabled, telegramAlertSettings, telegramLanguage FROM Users WHERE uuid = ?').get(uuid)
    if (!userRow) return

    const lang = userRow.telegramLanguage || 'ar'

    // Reply keyboard for persistent buttons at the bottom
    let menuReplyMarkup
    if (lang === 'ar') {
      menuReplyMarkup = {
        keyboard: [
          [{ text: "📋 لوحة التحكم" }, { text: "📊 حالة البوت" }],
          [{ text: "❓ المساعدة والاوامر" }]
        ],
        resize_keyboard: true
      }
    } else {
      menuReplyMarkup = {
        keyboard: [
          [{ text: "📋 Control Panel" }, { text: "📊 Status Report" }],
          [{ text: "❓ Help & Commands" }]
        ],
        resize_keyboard: true
      }
    }

    if (command === '/start') {
      if (lang === 'ar') {
        await reply(`👋 *أهلاً بك في بوت التحكم بـ GGE BOT!*`, menuReplyMarkup)
      } else {
        await reply(`👋 *Welcome to GGE BOT Telegram Control!*`, menuReplyMarkup)
      }
      const { text: menuText, reply_markup: inlineMarkup } = getMainMenuContent(uuid)
      await reply(menuText, inlineMarkup)
      return
    }

    if (text.includes('Control Panel') || text.includes('لوحة التحكم') || command === '📋' || command === '/help') {
      const { text: menuText, reply_markup: inlineMarkup } = getMainMenuContent(uuid)
      await reply(menuText, inlineMarkup)
      return
    }

    if (text.includes('Status Report') || text.includes('حالة البوت') || command === '/status' || command === '📊') {
      const subUsers = getUser(uuid)
      if (subUsers.length === 0) {
        if (lang === 'ar') {
          await reply(`👤 *المستخدم:* ${userRow.username}\n⚠️ لم يتم إضافة أي حسابات لعبة بعد.`)
        } else {
          await reply(`👤 *User:* ${userRow.username}\n⚠️ No game accounts added yet.`)
        }
        return
      }

      let report
      if (lang === 'ar') {
        report = `📊 *تقرير حالة البوت GGE*\n` +
          `👤 *المستخدم:* ${userRow.username}\n` +
          `🔔 *تنبيهات تيليجرام:* ${userRow.telegramEnabled ? '🟢 مفعلة' : '🔴 معطلة'}\n\n` +
          `🎮 *حسابات اللعبة:*`
      } else {
        report = `📊 *GGE BOT Status Report*\n` +
          `👤 *User:* ${userRow.username}\n` +
          `🔔 *Telegram Notifications:* ${userRow.telegramEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n\n` +
          `🎮 *Game Accounts:*`
      }

      for (const subUser of subUsers) {
        const isRunning = botMap.get(subUser.id) !== undefined
        const statusData = botStatuses.get(subUser.id)

        if (lang === 'ar') {
          report += `\n\n• *${subUser.name}* (معرف: ${subUser.id})`
          report += `\n  ⚡ الحالة: ${isRunning ? '🟢 يعمل' : '🔴 متوقف'}`
          if (isRunning && statusData) {
            report += `\n  📈 المستوى: ${statusData.level || 'غير معروف'}`
            report += `\n  🪙 النقود: ${statusData.cash !== undefined ? statusData.cash.toLocaleString() : 'N/A'}`
            report += `\n  💎 الياقوت: ${statusData.gold !== undefined ? statusData.gold.toLocaleString() : 'N/A'}`
            report += `\n  🔄 الطلبات: ${statusData.requestCount || 0}`
            report += `\n  ❌ الأخطاء: ${statusData.errorCount || 0}`
          }
        } else {
          report += `\n\n• *${subUser.name}* (ID: ${subUser.id})`
          report += `\n  ⚡ Status: ${isRunning ? '🟢 Running' : '🔴 Stopped'}`
          if (isRunning && statusData) {
            report += `\n  📈 Level: ${statusData.level || 'Unknown'}`
            report += `\n  🪙 Coins: ${statusData.cash !== undefined ? statusData.cash.toLocaleString() : 'N/A'}`
            report += `\n  💎 Rubies: ${statusData.gold !== undefined ? statusData.gold.toLocaleString() : 'N/A'}`
            report += `\n  🔄 Requests: ${statusData.requestCount || 0}`
            report += `\n  ❌ Errors: ${statusData.errorCount || 0}`
          }
        }
      }

      const refreshText = lang === 'ar' ? "🔄 تحديث" : "🔄 Refresh"
      const backText = lang === 'ar' ? "🔙 القائمة" : "🔙 Main Menu"

      const statusMarkup = {
        inline_keyboard: [
          [{ text: refreshText, callback_data: "menu:status" }],
          [{ text: backText, callback_data: "menu:main" }]
        ]
      }
      await reply(report, statusMarkup)
      return
    }

    if (text.includes('Help & Commands') || text.includes('المساعدة والاوامر') || command === '❓') {
      const { text: helpText, reply_markup: helpMarkup } = getHelpMenuContent(uuid)
      await reply(helpText, helpMarkup)
      return
    }

    if (command === '/alerts_on') {
      userDatabase.prepare('UPDATE Users SET telegramEnabled = 1 WHERE uuid = ?').run(uuid)
      propagateTelegramConfigToWorkers(uuid)
      if (lang === 'ar') {
        await reply(`🟢 *تم تفعيل تنبيهات تيليجرام!*`)
      } else {
        await reply(`🟢 *Telegram Notifications Enabled!*`)
      }
      return
    }

    if (command === '/alerts_off') {
      userDatabase.prepare('UPDATE Users SET telegramEnabled = 0 WHERE uuid = ?').run(uuid)
      propagateTelegramConfigToWorkers(uuid)
      if (lang === 'ar') {
        await reply(`🔴 *تم تعطيل تنبيهات تيليجرام!*`)
      } else {
        await reply(`🔴 *Telegram Notifications Disabled!*`)
      }
      return
    }

    if (command === '/settings') {
      const { text: settingsText, reply_markup: settingsMarkup } = getSettingsMenuContent(uuid)
      await reply(settingsText, settingsMarkup)
      return
    }

    // Forward unknown/game commands to the worker thread
    const subUsers = getUser(uuid)
    const runningWorker = subUsers.map(su => botMap.get(su.id)).find(w => w !== undefined)
    if (runningWorker) {
      runningWorker.postMessage(["TelegramCommand", { command: commandText, chatId, token }])
      return
    }

    const gameCommands = [
      'nomads', 'samurai', 'bloodcrows', 'warofrealms', 'honour',
      'berimond', 'storm', 'loot', 'storm_top_players',
      'grandtournament', 'birded', 'renameaccount', 'renamecastle',
      'opengate', 'sendmessage', 'sendresources'
    ]

    if (command.startsWith('/') || gameCommands.includes(command.startsWith('/') ? command.slice(1) : command)) {
      if (lang === 'ar') {
        await reply(`⚠️ *حساب اللعبة متوقف*\n` +
          `لا يمكن تنفيذ الأوامر الخاصة باللعبة بينما الحساب متوقف. يرجى تشغيل الحساب أولاً من لوحة التحكم أو القائمة.`)
      } else {
        await reply(`⚠️ *Game Account Offline*\n` +
          `Game commands cannot be executed while the account is offline. Please start the account first from the control panel or menu.`)
      }
      return
    }

    if (lang === 'ar') {
      await reply(`❓ *أمر غير معروف.* اكتب /help لرؤية جميع الأوامر المتاحة.`)
    } else {
      await reply(`❓ *Unknown Command.* Type /help to see all available commands.`)
    }
  }

  async function handleTelegramCallback(uuid, token, chatId, cb) {
    const data = cb.data
    const messageId = cb.message.message_id
    const lang = getTelegramLanguage(uuid)

    async function editMessage(msgText, replyMarkup = null) {
      try {
        const bodyObj = {
          chat_id: chatId,
          message_id: messageId,
          text: msgText,
          parse_mode: "Markdown"
        }
        if (replyMarkup) {
          bodyObj.reply_markup = replyMarkup
        }
        await undici.request(`https://api.telegram.org/bot${token}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyObj)
        })
      } catch (e) {
        console.warn("Failed to edit Telegram message:", e)
      }
    }

    if (data === "menu:main") {
      const { text, reply_markup } = getMainMenuContent(uuid)
      await editMessage(text, reply_markup)
      return
    }

    if (data === "menu:settings") {
      const { text, reply_markup } = getSettingsMenuContent(uuid)
      await editMessage(text, reply_markup)
      return
    }

    if (data === "menu:accounts") {
      const { text, reply_markup } = getAccountsMenuContent(uuid)
      await editMessage(text, reply_markup)
      return
    }

    if (data === "menu:help") {
      const { text, reply_markup } = getHelpMenuContent(uuid)
      await editMessage(text, reply_markup)
      return
    }

    if (data === "menu:status") {
      const userRow = userDatabase.prepare('SELECT username, telegramEnabled FROM Users WHERE uuid = ?').get(uuid)
      const subUsers = getUser(uuid)
      if (subUsers.length === 0) {
        if (lang === 'ar') {
          await editMessage(`👤 *المستخدم:* ${userRow?.username || 'غير معروف'}\n⚠️ لم يتم إضافة أي حسابات لعبة بعد.`, {
            inline_keyboard: [[{ text: "🔙 العودة", callback_data: "menu:main" }]]
          })
        } else {
          await editMessage(`👤 *User:* ${userRow?.username || 'Unknown'}\n⚠️ No game accounts added yet.`, {
            inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu:main" }]]
          })
        }
        return
      }

      let report
      if (lang === 'ar') {
        report = `📊 *تقرير حالة البوت GGE*\n` +
          `👤 *المستخدم:* ${userRow?.username || 'غير معروف'}\n` +
          `🔔 *تنبيهات تيليجرام:* ${userRow?.telegramEnabled ? '🟢 مفعلة' : '🔴 معطلة'}\n\n` +
          `🎮 *حسابات اللعبة:*`
      } else {
        report = `📊 *GGE BOT Status Report*\n` +
          `👤 *User:* ${userRow?.username || 'Unknown'}\n` +
          `🔔 *Telegram Notifications:* ${userRow?.telegramEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n\n` +
          `🎮 *Game Accounts:*`
      }

      for (const subUser of subUsers) {
        const isRunning = botMap.get(subUser.id) !== undefined
        const statusData = botStatuses.get(subUser.id)

        if (lang === 'ar') {
          report += `\n\n• *${subUser.name}* (معرف: ${subUser.id})`
          report += `\n  ⚡ الحالة: ${isRunning ? '🟢 يعمل' : '🔴 متوقف'}`
          if (isRunning && statusData) {
            report += `\n  📈 المستوى: ${statusData.level || 'غير معروف'}`
            report += `\n  🪙 النقود: ${statusData.cash !== undefined ? statusData.cash.toLocaleString() : 'N/A'}`
            report += `\n  💎 الياقوت: ${statusData.gold !== undefined ? statusData.gold.toLocaleString() : 'N/A'}`
            report += `\n  🔄 الطلبات: ${statusData.requestCount || 0}`
            report += `\n  ❌ الأخطاء: ${statusData.errorCount || 0}`
          }
        } else {
          report += `\n\n• *${subUser.name}* (ID: ${subUser.id})`
          report += `\n  ⚡ Status: ${isRunning ? '🟢 Running' : '🔴 Stopped'}`
          if (isRunning && statusData) {
            report += `\n  📈 Level: ${statusData.level || 'Unknown'}`
            report += `\n  🪙 Coins: ${statusData.cash !== undefined ? statusData.cash.toLocaleString() : 'N/A'}`
            report += `\n  💎 Rubies: ${statusData.gold !== undefined ? statusData.gold.toLocaleString() : 'N/A'}`
            report += `\n  🔄 Requests: ${statusData.requestCount || 0}`
            report += `\n  ❌ Errors: ${statusData.errorCount || 0}`
          }
        }
      }

      const refreshText = lang === 'ar' ? "🔄 تحديث" : "🔄 Refresh"
      const mainText = lang === 'ar' ? "🔙 القائمة الرئيسية" : "🔙 Main Menu"

      await editMessage(report, {
        inline_keyboard: [
          [{ text: refreshText, callback_data: "menu:status" }],
          [{ text: mainText, callback_data: "menu:main" }]
        ]
      })
      return
    }

    if (data === "toggle_lang") {
      const userRow = userDatabase.prepare('SELECT telegramLanguage FROM Users WHERE uuid = ?').get(uuid)
      const currentLang = (userRow && userRow.telegramLanguage) || 'ar'
      const nextLang = currentLang === 'ar' ? 'en' : 'ar'
      userDatabase.prepare('UPDATE Users SET telegramLanguage = ? WHERE uuid = ?').run(nextLang, uuid)

      const { text, reply_markup } = getSettingsMenuContent(uuid)
      await editMessage(text, reply_markup)
      return
    }

    if (data.startsWith("toggle_alert:")) {
      const key = data.split(":")[1]
      if (key === "telegramEnabled") {
        const row = userDatabase.prepare('SELECT telegramEnabled FROM Users WHERE uuid = ?').get(uuid)
        const nextVal = row && row.telegramEnabled ? 0 : 1
        userDatabase.prepare('UPDATE Users SET telegramEnabled = ? WHERE uuid = ?').run(nextVal, uuid)
        propagateTelegramConfigToWorkers(uuid)
      } else {
        const row = userDatabase.prepare('SELECT telegramAlertSettings FROM Users WHERE uuid = ?').get(uuid)
        let settings = {
          incomingMe: true,
          incomingAlliance: true,
          outgoingMe: true,
          outgoingAlliance: true,
          errors: true,
          system: true,
          chat: true,
          fortress: true
        }
        if (row && row.telegramAlertSettings) {
          try {
            settings = { ...settings, ...JSON.parse(row.telegramAlertSettings) }
          } catch (e) { }
        }
        settings[key] = !settings[key]
        userDatabase.prepare('UPDATE Users SET telegramAlertSettings = ? WHERE uuid = ?').run(JSON.stringify(settings), uuid)
        propagateTelegramConfigToWorkers(uuid)
      }

      const { text, reply_markup } = getSettingsMenuContent(uuid)
      await editMessage(text, reply_markup)
      return
    }

    if (data.startsWith("account_info:")) {
      const accountId = Number(data.split(":")[1])
      const { text, reply_markup } = getAccountInfoContent(uuid, accountId)
      await editMessage(text, reply_markup)
      return
    }

    if (data.startsWith("toggle_bot:")) {
      const accountId = Number(data.split(":")[1])
      const subUsers = getUser(uuid)
      const subUser = subUsers.find(su => su.id === accountId)
      if (subUser) {
        const isRunning = botMap.get(subUser.id) !== undefined
        if (isRunning) {
          subUser.state = 0
          changeUser(uuid, subUser)
          try {
            autoReconnectCooldowns.delete(subUser.id)
            if (autoReconnectTimers.has(subUser.id)) {
              clearTimeout(autoReconnectTimers.get(subUser.id))
              autoReconnectTimers.delete(subUser.id)
            }
            removeBot(subUser.id)
          } catch (e) {
            console.warn(e)
          }
        } else {
          if (!isSubscriptionActive(uuid)) {
            if (lang === 'ar') {
              await editMessage(`⚠️ *الاشتراك منتهي أو غير نشط.*`, {
                inline_keyboard: [[{ text: "🔙 العودة", callback_data: `account_info:${accountId}` }]]
              })
            } else {
              await editMessage(`⚠️ *Subscription is expired or inactive.*`, {
                inline_keyboard: [[{ text: "🔙 Back", callback_data: `account_info:${accountId}` }]]
              })
            }
            return
          }
          const limitRow = userDatabase.prepare('SELECT maxGameAccounts FROM Users WHERE uuid = ?').get(uuid)
          const limit = limitRow ? limitRow.maxGameAccounts : 1
          let activeCount = 0
          for (const su of getUser(uuid)) {
            if (su.id !== subUser.id && botMap.get(su.id) !== undefined) {
              activeCount++
            }
          }
          if (activeCount >= limit) {
            if (lang === 'ar') {
              await editMessage(`⚠️ *تم الوصول للحد الأقصى للحسابات المشغلة (${limit}).*`, {
                inline_keyboard: [[{ text: "🔙 العودة", callback_data: `account_info:${accountId}` }]]
              })
            } else {
              await editMessage(`⚠️ *Running accounts limit reached (${limit}).*`, {
                inline_keyboard: [[{ text: "🔙 Back", callback_data: `account_info:${accountId}` }]]
              })
            }
            return
          }

          subUser.state = 1
          changeUser(uuid, subUser)
          botRestartTracker.delete(subUser.id)
          autoReconnectCooldowns.delete(subUser.id)
          if (autoReconnectTimers.has(subUser.id)) {
            clearTimeout(autoReconnectTimers.get(subUser.id))
            autoReconnectTimers.delete(subUser.id)
          }
          let worker = botMap.get(subUser.id)
          if (worker == undefined) {
            await createBot(uuid, subUser)
          }
        }
      }

      const { text, reply_markup } = getAccountInfoContent(uuid, accountId)
      await editMessage(text, reply_markup)
      return
    }

    if (data.startsWith("account_plugins:")) {
      const accountId = Number(data.split(":")[1])
      const { text, reply_markup } = getAccountPluginsContent(uuid, accountId)
      await editMessage(text, reply_markup)
      return
    }

    if (data.startsWith("toggle_plugin:")) {
      const parts = data.split(":")
      const accountId = Number(parts[1])
      const pluginKey = parts[2]

      const subUser = getSpecificUser(uuid, { id: accountId })
      if (subUser) {
        if (!subUser.plugins[pluginKey]) {
          subUser.plugins[pluginKey] = {}
        }
        subUser.plugins[pluginKey].state = !subUser.plugins[pluginKey].state
        changeUser(uuid, subUser)

        let worker = botMap.get(accountId)
        if (worker !== undefined) {
          try {
            const msgBuf = worker.messageBuffer
            const msgBufCount = worker.messageBufferCount
            removeBot(accountId)
            const updatedUser = getSpecificUser(uuid, { id: accountId })
            await createBot(uuid, updatedUser, msgBuf, msgBufCount)
          } catch (e) {
            console.warn("Failed to restart bot on plugin change:", e)
          }
        }
      }

      const { text, reply_markup } = getAccountPluginsContent(uuid, accountId)
      await editMessage(text, reply_markup)
      return
    }

    if (data.startsWith("view_logs:")) {
      const accountId = Number(data.split(":")[1])
      const worker = botMap.get(accountId)
      let logText
      if (!worker) {
        logText = lang === 'ar' ? "⚠️ *البوت غير مشغل حالياً.*" : "⚠️ *Bot is not running currently.*"
      } else {
        const logs = []
        const buf = worker.messageBuffer || []
        const count = worker.messageBufferCount || 0

        function translateLogPart(part, locale) {
          const textVal = String(part ?? "")
          try {
            const translated = i18n.__({ phrase: textVal, locale: locale })
            return translated === undefined || translated === null ? textVal : translated
          } catch (e) {
            return textVal
          }
        }

        for (let i = 0; i < 10; i++) {
          const idx = (count - 1 - i + 25) % 25
          const log = buf[idx]
          if (log) {
            // log is [logLevel, messagePartsArray]
            const logMsg = Array.isArray(log[1]) ? log[1].map(p => translateLogPart(p, lang)).join("") : String(log[1])
            logs.unshift(logMsg) // keep chronological order
          }
        }

        if (logs.length === 0) {
          logText = lang === 'ar' ? "ℹ️ *لا توجد سجلات بعد.*" : "ℹ️ *No logs recorded yet.*"
        } else {
          logText = (lang === 'ar' ? "📝 *آخر 10 سجلات للبوت:*\n\n" : "📝 *Last 10 bot logs:*\n\n") + "```\n" + logs.join("\n") + "\n```"
        }
      }

      const backToAccountText = lang === 'ar' ? "🔙 العودة للحساب" : "🔙 Back to Account"
      await editMessage(logText, {
        inline_keyboard: [
          [{ text: backToAccountText, callback_data: `account_info:${accountId}` }]
        ]
      })
      return
    }

    // --- Interactive Telegram Bot Callbacks ---

    if (data.startsWith("action_rename_account:")) {
      const accountId = Number(data.split(":")[1])
      const subUsers = getUser(uuid)
      const subUser = subUsers.find(su => su.id === accountId)
      const currentName = subUser ? subUser.name : ""

      const promptText = lang === 'ar'
        ? `✏️ *تغيير اسم اللاعب*\n\nالاسم الحالي: \`${currentName}\`\n\nيرجى كتابة اسم حسابك الجديد الذي تريده وإرساله:`
        : `✏️ *Rename Player*\n\nCurrent name: \`${currentName}\`\n\nPlease type the new account name you want and send it:`

      const backToAccountText = lang === 'ar' ? "🔙 إلغاء" : "🔙 Cancel"
      await editMessage(promptText, {
        inline_keyboard: [[{ text: backToAccountText, callback_data: `account_info:${accountId}` }]]
      })

      pendingTelegramInputs.set(chatId, { type: "rename_account", accountId })
      return
    }

    if (data.startsWith("confirm_rename:")) {
      const sessionId = data.split(":")[1]
      const session = telegramRenameSession.get(sessionId)
      if (!session) {
        await editMessage(lang === 'ar' ? "❌ انتهت صلاحية الجلسة أو غير صالحة." : "❌ Session expired or invalid.")
        return
      }
      telegramRenameSession.delete(sessionId)

      const { accountId, newName } = session
      const subUsers = getUser(uuid)
      const runningWorker = subUsers.map(su => botMap.get(su.id)).find(w => w !== undefined)

      if (!runningWorker) {
        await editMessage(lang === 'ar'
          ? "⚠️ *حساب اللعبة متوقف.*\nلا يمكن تنفيذ الأمر بينما الحساب متوقف."
          : "⚠️ *Game Account Offline.*\nCannot execute command while account is offline.")
        return
      }

      runningWorker.postMessage(["TelegramCommand", { command: `/renameaccount ${newName}`, chatId, token }])

      const processingText = lang === 'ar'
        ? `⏳ جاري معالجة طلب تغيير اسم اللاعب إلى \`${newName}\`...`
        : `⏳ Processing request to rename player to \`${newName}\`...`
      await editMessage(processingText)
      return
    }

    if (data.startsWith("cancel_rename:")) {
      const sessionId = data.split(":")[1]
      const session = telegramRenameSession.get(sessionId)
      const accountId = session ? session.accountId : null
      if (session) {
        telegramRenameSession.delete(sessionId)
      }

      if (accountId) {
        const content = getAccountInfoContent(uuid, accountId)
        await editMessage(content.text, content.reply_markup)
        return
      }

      const { text, reply_markup } = getMainMenuContent(uuid)
      await editMessage(text, reply_markup)
      return
    }

    if (data.startsWith("action_select_castle_rename:")) {
      const accountId = Number(data.split(":")[1])
      const subUsers = getUser(uuid)
      const subUser = subUsers.find(su => su.id === accountId)
      if (!subUser) return

      const userCastles = getBotCastles(accountId)
      if (userCastles.length === 0) {
        await editMessage(lang === 'ar' ? "⚠️ لا توجد قلاع مضافة بعد." : "⚠️ No castles found.", {
          inline_keyboard: [[{ text: lang === 'ar' ? "🔙 العودة" : "🔙 Back", callback_data: `account_info:${accountId}` }]]
        })
        return
      }

      const promptText = lang === 'ar'
        ? "🏰 *تغيير اسم القلعة*\n\nاختر القلعة التي تريد تغيير اسمها:"
        : "🏰 *Rename Castle*\n\nSelect the castle you want to rename:"

      const inline_keyboard = userCastles.map(c => [{
        text: `🏰 ${c.name || 'Castle'} (ID: ${c.id})`,
        callback_data: `action_prompt_rename_castle:${accountId}:${c.id}`
      }])
      inline_keyboard.push([{ text: lang === 'ar' ? "🔙 العودة" : "🔙 Back", callback_data: `account_info:${accountId}` }])

      await editMessage(promptText, { inline_keyboard })
      return
    }

    if (data.startsWith("action_prompt_rename_castle:")) {
      const parts = data.split(":")
      const accountId = Number(parts[1])
      const castleId = Number(parts[2])

      const userCastles = getBotCastles(accountId)
      const c = userCastles.find(item => item.id === castleId)
      const currentName = c ? c.name : `Castle ${castleId}`

      const promptText = lang === 'ar'
        ? `✍️ اكتب الاسم الجديد لقلعة *${currentName}* (ID: ${castleId}):`
        : `✍️ Type the new name for castle *${currentName}* (ID: ${castleId}):`

      const backText = lang === 'ar' ? "🔙 إلغاء" : "🔙 Cancel"
      await editMessage(promptText, {
        inline_keyboard: [[{ text: backText, callback_data: `action_select_castle_rename:${accountId}` }]]
      })

      pendingTelegramInputs.set(chatId, { type: "rename_castle", accountId, castleId })
      return
    }

    if (data.startsWith("action_select_castle_gate:")) {
      const accountId = Number(data.split(":")[1])
      const userCastles = getBotCastles(accountId)
      if (userCastles.length === 0) {
        await editMessage(lang === 'ar' ? "⚠️ لا توجد قلاع مضافة بعد." : "⚠️ No castles found.", {
          inline_keyboard: [[{ text: lang === 'ar' ? "🔙 العودة" : "🔙 Back", callback_data: `account_info:${accountId}` }]]
        })
        return
      }

      const promptText = lang === 'ar'
        ? "🚪 *فتح البوابة*\n\nاختر القلعة التي تريد فتح بوابتها:"
        : "🚪 *Open Gate*\n\nSelect the castle to open its gate:"

      const inline_keyboard = userCastles.map(c => [{
        text: `🏰 ${c.name || 'Castle'} (ID: ${c.id})`,
        callback_data: `action_select_gate_hours:${accountId}:${c.id}`
      }])
      inline_keyboard.push([{ text: lang === 'ar' ? "🔙 العودة" : "🔙 Back", callback_data: `account_info:${accountId}` }])

      await editMessage(promptText, { inline_keyboard })
      return
    }

    if (data.startsWith("action_select_gate_hours:")) {
      const parts = data.split(":")
      const accountId = Number(parts[1])
      const castleId = Number(parts[2])

      const userCastles = getBotCastles(accountId)
      const c = userCastles.find(item => item.id === castleId)
      const castleName = c ? c.name : `Castle ${castleId}`

      const promptText = lang === 'ar'
        ? `🚪 *مدة فتح البوابة*\n\nاختر مدة فتح البوابة لقلعة *${castleName}*:`
        : `🚪 *Gate Duration*\n\nSelect the gate open duration for castle *${castleName}*:`

      await editMessage(promptText, {
        inline_keyboard: [
          [
            { text: lang === 'ar' ? "⏱️ 6 ساعات" : "⏱️ 6 Hours", callback_data: `action_open_gate:${accountId}:${castleId}:6` },
            { text: lang === 'ar' ? "⏱️ 12 ساعة" : "⏱️ 12 Hours", callback_data: `action_open_gate:${accountId}:${castleId}:12` }
          ],
          [{ text: lang === 'ar' ? "🔙 العودة" : "🔙 Back", callback_data: `action_select_castle_gate:${accountId}` }]
        ]
      })
      return
    }

    if (data.startsWith("action_open_gate:")) {
      const parts = data.split(":")
      const accountId = Number(parts[1])
      const castleId = Number(parts[2])
      const hours = parts[3]

      const subUsers = getUser(uuid)
      const runningWorker = subUsers.map(su => botMap.get(su.id)).find(w => w !== undefined)
      if (runningWorker) {
        runningWorker.postMessage(["TelegramCommand", { command: `/opengate ${castleId} ${hours}`, chatId, token }])
      } else {
        await editMessage(lang === 'ar' ? "⚠️ *حساب اللعبة متوقف*" : "⚠️ *Game Account Offline*")
      }
      return
    }

    if (data.startsWith("action_send_msg:")) {
      const accountId = Number(data.split(":")[1])
      const promptText = lang === 'ar'
        ? "✉️ *إرسال رسالة لاعب*\n\nيرجى كتابة اسم اللاعب المستلم:"
        : "✉️ *Send Private Message*\n\nPlease type the recipient player name:"

      const backText = lang === 'ar' ? "🔙 إلغاء" : "🔙 Cancel"
      await editMessage(promptText, {
        inline_keyboard: [[{ text: backText, callback_data: `account_info:${accountId}` }]]
      })

      pendingTelegramInputs.set(chatId, { type: "send_msg_recipient", accountId })
      return
    }

    if (data.startsWith("action_select_castle_resources:")) {
      const accountId = Number(data.split(":")[1])
      const userCastles = getBotCastles(accountId)
      if (userCastles.length === 0) {
        await editMessage(lang === 'ar' ? "⚠️ لا توجد قلاع مضافة بعد." : "⚠️ No castles found.", {
          inline_keyboard: [[{ text: lang === 'ar' ? "🔙 العودة" : "🔙 Back", callback_data: `account_info:${accountId}` }]]
        })
        return
      }

      const promptText = lang === 'ar'
        ? "📦 *إرسال موارد*\n\nاختر قلعة المصدر لإرسال الموارد منها:"
        : "📦 *Send Resources*\n\nSelect the source castle to send resources from:"

      const inline_keyboard = userCastles.map(c => [{
        text: `🏰 ${c.name || 'Castle'} (ID: ${c.id})`,
        callback_data: `action_resource_dest_type:${accountId}:${c.id}`
      }])
      inline_keyboard.push([{ text: lang === 'ar' ? "🔙 العودة" : "🔙 Back", callback_data: `account_info:${accountId}` }])

      await editMessage(promptText, { inline_keyboard })
      return
    }

    if (data.startsWith("action_resource_dest_type:")) {
      const parts = data.split(":")
      const accountId = Number(parts[1])
      const sourceCastleId = Number(parts[2])

      const promptText = lang === 'ar'
        ? "📦 *وجهة الإرسال*\n\nهل تريد الإرسال إلى لاعب بالاسم أم إدخال إحداثيات (X, Y) مباشرة؟"
        : "📦 *Shipping Destination*\n\nDo you want to send to a player by name or enter coordinates (X, Y) directly?"

      await editMessage(promptText, {
        inline_keyboard: [
          [
            { text: lang === 'ar' ? "👤 لاعب بالاسم" : "👤 Player by Name", callback_data: `action_resource_prompt_player:${accountId}:${sourceCastleId}` },
            { text: lang === 'ar' ? "📍 إحداثيات مباشرة" : "📍 Direct Coordinates", callback_data: `action_resource_prompt_coords:${accountId}:${sourceCastleId}` }
          ],
          [{ text: lang === 'ar' ? "🔙 العودة" : "🔙 Back", callback_data: `action_select_castle_resources:${accountId}` }]
        ]
      })
      return
    }

    if (data.startsWith("action_resource_prompt_player:")) {
      const parts = data.split(":")
      const accountId = Number(parts[1])
      const sourceCastleId = Number(parts[2])

      const promptText = lang === 'ar'
        ? "👤 اكتب اسم اللاعب المستهدف:"
        : "👤 Type target player name:"

      await editMessage(promptText, {
        inline_keyboard: [[{ text: lang === 'ar' ? "🔙 إلغاء" : "🔙 Cancel", callback_data: `action_resource_dest_type:${accountId}:${sourceCastleId}` }]]
      })

      pendingTelegramInputs.set(chatId, { type: "resource_player", accountId, sourceCastleId })
      return
    }

    if (data.startsWith("action_resource_prompt_coords:")) {
      const parts = data.split(":")
      const accountId = Number(parts[1])
      const sourceCastleId = Number(parts[2])

      const promptText = lang === 'ar'
        ? "📍 اكتب إحداثيات الهدف بالتنسيق X Y (مثال: 654 631):"
        : "📍 Type target coordinates in format X Y (e.g. 654 631):"

      await editMessage(promptText, {
        inline_keyboard: [[{ text: lang === 'ar' ? "🔙 إلغاء" : "🔙 Cancel", callback_data: `action_resource_dest_type:${accountId}:${sourceCastleId}` }]]
      })

      pendingTelegramInputs.set(chatId, { type: "resource_coords", accountId, sourceCastleId })
      return
    }

    if (data.startsWith("send_res:")) {
      const parts = data.split(":")
      const sessionId = parts[1]
      const resType = parts[2]

      const session = telegramResourceSession.get(sessionId)
      if (!session) {
        await editMessage("❌ Session expired or invalid.")
        return
      }

      let targetArg
      if (session.targetPlayerName) {
        targetArg = `player:${session.targetPlayerName}`
      } else {
        targetArg = `${session.targetX} ${session.targetY}`
      }

      let resourceArg
      if (resType === 'w') resourceArg = 'w:max'
      else if (resType === 's') resourceArg = 's:max'
      else if (resType === 'f') resourceArg = 'f:max'
      else if (resType === 'ws') resourceArg = 'w:max s:max'
      else if (resType === 'c') resourceArg = 'c:max'
      else if (resType === 'o') resourceArg = 'o:max'
      else if (resType === 'honey') resourceArg = 'honey:max'
      else if (resType === 'mead') resourceArg = 'mead:max'

      const cmd = `/sendresources ${session.sourceCastleId} ${targetArg} ${resourceArg}`

      const subUsers = getUser(uuid)
      const runningWorker = subUsers.map(su => botMap.get(su.id)).find(w => w !== undefined)
      if (runningWorker) {
        await editMessage(lang === 'ar' ? "⏳ جاري إرسال الطلب..." : "⏳ Sending request...")
        runningWorker.postMessage(["TelegramCommand", { command: cmd, chatId, token }])
      } else {
        await editMessage(lang === 'ar' ? "⚠️ *حساب اللعبة متوقف*" : "⚠️ *Game Account Offline*")
      }
      telegramResourceSession.delete(sessionId)
      return
    }
  }

  function syncTelegramPollers() {
    try {
      const rows = userDatabase.prepare('SELECT uuid, telegramToken, telegramChatId, telegramEnabled FROM Users').all()
      const activeUuids = new Set()

      for (const row of rows) {
        if (row.telegramEnabled && row.telegramToken && row.telegramChatId) {
          // Verify user has an active subscription or is an admin
          if (isSubscriptionActive(row.uuid)) {
            activeUuids.add(row.uuid)
            startTelegramPolling(row.uuid, row.telegramToken, row.telegramChatId)
          }
        }
      }

      for (const [uuid, poller] of activeTelegramPollers.entries()) {
        if (!activeUuids.has(uuid)) {
          poller.stop()
        }
      }
    } catch (e) {
      console.error("Error syncing Telegram pollers:", e)
    }
  }

  // Initial Sync of Telegram Pollers
  syncTelegramPollers()

  // Periodic subscription expiry check (every 60 seconds)
  setInterval(() => {
    try {
      // Sync Telegram pollers to apply any subscription/admin state changes
      syncTelegramPollers()

      if (botMap.size === 0) return

      // Select all subusers that are running (state=1) but their owner's subscription has expired
      const expiredSubUsers = userDatabase.prepare(`
        SELECT SubUsers.id, SubUsers.name, SubUsers.uuid 
        FROM SubUsers 
        JOIN Users ON SubUsers.uuid = Users.uuid 
        WHERE SubUsers.state = 1 
          AND Users.privilege != 1 
          AND (Users.subscriptionExpiry IS NULL OR date(Users.subscriptionExpiry) < date('now'))
      `).all()

      for (const subUser of expiredSubUsers) {
        console.warn(`[Subscription System] Force stopping bot ${subUser.id} (${subUser.name}) due to subscription expiry.`)
        userDatabase.prepare('UPDATE SubUsers SET state = 0 WHERE id = ?').run(subUser.id)
        try {
          removeBot(subUser.id)
        } catch (e) {
          // already stopped
        }

        // Notify user if online to update UI and show expired message
        if (loggedInUsers[subUser.uuid]) {
          const filteredPlugins = getVisiblePluginsForUser(subUser.uuid)
          loggedInUsers[subUser.uuid].forEach(({ ws }) => {
            ws.send(JSON.stringify([ErrorType.Generic, ActionType.SetUser, { error: 'subscriptionExpiredForceStop' }]))
            ws.send(JSON.stringify([ErrorType.Success, ActionType.GetUsers, [getUser(subUser.uuid), filteredPlugins]]))
          })
        }
      }
    } catch (e) {
      console.error("Error in subscription check interval:", e)
    }
  }, 60000).unref()

  // Notification Cleanup
  deleteOldNotifications()
  setInterval(deleteOldNotifications, 60 * 60 * 1000).unref()

  console.info(i18n.__("started"))
}

start()

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception in main process:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection in main process at:', promise, 'reason:', reason);
});

module.exports = {
  loggedInUsers,
  botMap,
  userDatabase,
  changeUser,
  getUser,
  removeUser,
  events
}
