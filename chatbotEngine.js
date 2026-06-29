/**
 * chatbotEngine.js
 * ─────────────────────────────────────────────────────────────────
 * Local chatbot logic — no external AI, pure pattern matching.
 * Security: all input is validated & sanitized before processing.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict'

// ── Constants ────────────────────────────────────────────────────
const MAX_MSG_LENGTH   = 300          // reject anything longer
const MAX_VALUE_LENGTH = 50           // plugin option value cap
const CHATBOT_RATE_MS  = 1500         // min ms between messages per user
const lastMessageTime  = new Map()    // uuid → timestamp

// ── Plugin registry ───────────────────────────────────────────────
// Maps every recognized user-facing name (Arabic / English) → plugin key
const PLUGIN_ALIASES = {
    // Storm Islands
    storm:              'resourceSendStorm',
    'ستورم':            'resourceSendStorm',
    'ستورم ايلاند':     'resourceSendStorm',
    resourcesendstorm:  'resourceSendStorm',

    // Feast
    feast:              'feast',
    'فيست':             'feast',
    'مأدبة':            'feast',

    // Help Requests
    helprequests:       'helpRequests',
    'مساعدة طلبات':     'helpRequests',
    'طلبات المساعدة':   'helpRequests',
    'مساعده':           'helpRequests',

    // Shutoff Timer
    shutofftimer:       'shutoffTimer',
    'تايمر ايقاف':      'shutoffTimer',
    'موقف':             'shutoffTimer',
    'ايقاف تلقائي':     'shutoffTimer',

    // Skips
    skips:              'skips',
    'سكيبات':           'skips',
    'تخطيات':           'skips',

    // Sell Stored Equipment
    sellequipment:      'sellStoredEquipment',
    'بيع معدات':        'sellStoredEquipment',
    'معدات':            'sellStoredEquipment',
}

// ── Plugin option aliases ────────────────────────────────────────
// Maps Arabic / shorthand phrases → real option key
const OPTION_ALIASES = {
    // Storm — fort levels
    'لفل 40 ايزي':   'allowLvl40Easy',
    'لفل 50 ايزي':   'allowLvl50Easy',
    'لفل 60 ايزي':   'allowLvl60Easy',
    'لفل 70 هارد':   'allowLvl70Hard',
    'لفل 80 هارد':   'allowLvl80Hard',

    // Storm — resources
    'ارسال موارد':   'sendResources',
    'بناء كارجو':    'autoBuildCargo',
    'ترقية كارجو':   'autoUpgradeCargo',
    'ارسال ميد':     'sendMead',
    'ارسال أكل':     'sendFood',
    'مستوى كارجو':   'cargoTargetLevel',
    'حد الميد':      'meadThreshold',
    'حد الأكل':      'foodThreshold',

    // Storm — purchases
    'شراء عملات':    'buyCoins',
    'شراء ديكور':    'buyDecoration',
    'شراء xp':       'buyXP',

    // Feast
    'كمية أكل الفيست': 'feastFoodReduction',
    'حد الأكل فيست':   'minimumFood',

    // Shutoff timer
    'ساعات الايقاف': 'hours',
    'ساعات':         'hours',

    // Help requests
    'مساعدة سريعة':  'fastHelp',
    'fast help':     'fastHelp',

    // Skips
    '1 دقيقة':   '1Minute',
    '5 دقائق':   '5Minute',
    '10 دقائق':  '10Minute',
    '30 دقيقة':  '30Minute',
    '1 ساعة':    '1Hour',
    '5 ساعات':   '5Hour',
    '24 ساعة':   '24Hour',
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Sanitize: strip HTML/script tags, trim whitespace.
 * @param {string} text
 * @returns {string}
 */
function sanitize(text) {
    return String(text)
        .replace(/<[^>]*>/g, '')   // strip HTML tags
        .replace(/[<>'"`;]/g, '')  // strip dangerous chars
        .trim()
        .slice(0, MAX_MSG_LENGTH)
}

/**
 * Resolve a user-typed plugin name → canonical plugin key.
 * @param {string} text
 * @returns {string|null}
 */
function resolvePlugin(text) {
    const normalized = text.toLowerCase().trim()
    return PLUGIN_ALIASES[normalized] ?? null
}

/**
 * Resolve a user-typed option name → canonical option key.
 * @param {string} text
 * @returns {string|null}
 */
function resolveOption(text) {
    const normalized = text.toLowerCase().trim()
    return OPTION_ALIASES[normalized] ?? normalized
}

/**
 * Validate a plugin option value:
 * - Numbers must be positive and ≤ 10,000,000
 * - Booleans: only true/false
 * - Strings: max MAX_VALUE_LENGTH chars, alphanumeric + dash
 * @param {*} value
 * @returns {{ ok: boolean, clean: *, reason?: string }}
 */
function validateValue(value) {
    const str = String(value).trim()

    if (str.length > MAX_VALUE_LENGTH)
        return { ok: false, reason: 'القيمة طويلة جداً' }

    // Boolean
    if (str === 'true' || str === 'false')
        return { ok: true, clean: str === 'true' }

    // Numeric
    if (/^\d+$/.test(str)) {
        const n = Number(str)
        if (n < 0)       return { ok: false, reason: 'القيمة لازم تكون موجبة' }
        if (n > 10000000) return { ok: false, reason: 'القيمة كبيرة جداً (الحد 10,000,000)' }
        return { ok: true, clean: str }
    }

    // Whitelist pattern (1-99, 1-5, etc.)
    if (/^[\d,\-\s]+$/.test(str))
        return { ok: true, clean: str }

    return { ok: false, reason: 'قيمة غير مسموح بها — استخدم أرقام فقط' }
}

// ── Intent patterns ───────────────────────────────────────────────
// Order matters: more specific patterns first

const INTENTS = [
    // ── تفعيل إضافة ──────────────────────────────────────────────
    {
        id: 'enable_plugin',
        patterns: [/فع[لّ]\s+(.+)/u, /شغ[لّ]\s+(.+)/u, /enable\s+(.+)/i, /تشغيل\s+(.+)/u],
        handler: (match, _ctx) => ({
            action: 'SET_PLUGIN_STATE',
            plugin: resolvePlugin(match[1].trim()),
            value: true,
        })
    },
    // ── تعطيل إضافة ──────────────────────────────────────────────
    {
        id: 'disable_plugin',
        patterns: [/وق[فّ]\s+(.+)/u, /أوق[فّ]\s+(.+)/u, /إيقاف\s+(.+)/u, /disable\s+(.+)/i, /ايقاف\s+(.+)/u],
        handler: (match, _ctx) => ({
            action: 'SET_PLUGIN_STATE',
            plugin: resolvePlugin(match[1].trim()),
            value: false,
        })
    },
    // ── تغيير إعداد ───────────────────────────────────────────────
    {
        id: 'set_option',
        patterns: [
            /غي[رّ]\s+(.+?)\s+(?:لـ|ل|إلى|الى|to)\s+(.+)/ui,
            /set\s+(.+?)\s+to\s+(.+)/i,
            /(.+?)\s*=\s*(.+)/,
        ],
        handler: (match, _ctx) => ({
            action: 'SET_PLUGIN_OPTION',
            option: resolveOption(match[1].trim()),
            value: match[2].trim(),
        })
    },
    // ── قائمة الإضافات ────────────────────────────────────────────
    {
        id: 'list_plugins',
        patterns: [
            /الإضافات/u, /الاضافات/u,
            /إيه الإضافات/u, /ايه الاضافات/u,
            /list plugins/i, /show plugins/i,
            /list addons/i, /show addons/i,
        ],
        handler: () => ({ action: 'LIST_PLUGINS' })
    },
    // ── حالة البوت ────────────────────────────────────────────────
    {
        id: 'status',
        patterns: [
            /حالة البوت/u, /حالة الحساب/u,
            /status/i, /إيه الحال/u, /ايه الحال/u,
        ],
        handler: () => ({ action: 'STATUS' })
    },
    // ── مساعدة ────────────────────────────────────────────────────
    {
        id: 'help',
        patterns: [/^مساعد[ةه]$/u, /^help$/i, /الأوامر/u, /الاوامر/u],
        handler: () => ({ action: 'HELP' })
    },
]

// ── Response builder ─────────────────────────────────────────────

function buildResponse(intent, users, userPlugins) {
    if (!intent) {
        return {
            ok: false,
            text: '🤷 مش فاهم قصدك!\nاكتب **مساعدة** لشوف الأوامر المتاحة.',
        }
    }

    switch (intent.action) {
        case 'HELP':
            return {
                ok: true,
                text:
`📖 **دليل الأوامر الكامل**

━━━━━━━━━━━━━━━━━━━━━
🔧 **أوامر التحكم الأساسية**
━━━━━━━━━━━━━━━━━━━━━
• **فعّل [إضافة]** — تشغيل إضافة
• **وقف [إضافة]** — إيقاف إضافة
• **غيّر [إعداد] لـ [قيمة]** — تغيير قيمة إعداد
• **الإضافات** — عرض الإضافات مع حالتها
• **حالة البوت** — معلومات الحساب
• **مساعدة** — عرض هذا الدليل

━━━━━━━━━━━━━━━━━━━━━
🌩️ **إضافة Storm Islands**
━━━━━━━━━━━━━━━━━━━━━
**الاسم:** storm أو ستورم

🏰 مستويات القلاع:
• فعّل/وقف **لفل 40 ايزي**
• فعّل/وقف **لفل 50 ايزي**
• فعّل/وقف **لفل 60 ايزي**
• فعّل/وقف **لفل 70 هارد**
• فعّل/وقف **لفل 80 هارد**

📦 الموارد:
• فعّل/وقف **ارسال موارد**
• فعّل/وقف **بناء كارجو**
• فعّل/وقف **ترقية كارجو**
• فعّل/وقف **ارسال ميد**
• فعّل/وقف **ارسال أكل**
• **غيّر مستوى كارجو لـ 15**
• **غيّر حد الميد لـ 80000**
• **غيّر حد الأكل لـ 50000**

🛒 المشتريات:
• فعّل/وقف **شراء عملات**
• فعّل/وقف **شراء ديكور**
• فعّل/وقف **شراء xp**

━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━
⏱️ **إضافة Shutoff Timer**
━━━━━━━━━━━━━━━━━━━━━
**الاسم:** shutoffTimer أو موقف
• **غيّر ساعات الايقاف لـ 3**

━━━━━━━━━━━━━━━━━━━━━
⏩ **إضافة Skips**
━━━━━━━━━━━━━━━━━━━━━
**الاسم:** skips أو سكيبات
• فعّل/وقف **1 دقيقة**
• فعّل/وقف **5 دقائق**
• فعّل/وقف **10 دقائق**
• فعّل/وقف **30 دقيقة**
• فعّل/وقف **1 ساعة**
• فعّل/وقف **5 ساعات**
• فعّل/وقف **24 ساعة**

━━━━━━━━━━━━━━━━━━━━━
⚔️ **إضافة Sell Equipment**
━━━━━━━━━━━━━━━━━━━━━
**الاسم:** sellEquipment أو معدات
• فعّل/وقف **معدات**`,
            }

        case 'LIST_PLUGINS': {
            if (!userPlugins || userPlugins.length === 0)
                return { ok: true, text: '📋 مفيش إضافات متاحة لحسابك.' }

            const INTERNAL = new Set([
                'skipsOptions','skipTypeOptions','timeSkipsPluginOptions',
                'troopTypeFilter','troopTypeOptions','commander',
                'attack','slashCommands'
            ])

            const FRIENDLY = {
                resourceSendStorm:      '🌩️ Storm Islands',
                feast:                  '🍖 Feast (مأدبة)',
                helpRequests:           '🤝 Help Requests (طلبات مساعدة)',
                shutoffTimer:           '⏱️ Shutoff Timer (إيقاف تلقائي)',
                skips:                  '⏩ Skips (سكيبات زمنية)',
                sellStoredEquipment:    '⚔️ Sell Equipment (بيع معدات)',
                attackFortresses:       '🏰 Attack Fortresses',
                attackBarons:           '🗡️ Attack Barons',
                attackNomads:           '🏹 Attack Nomads',
                attackSamurai:          '⛩️ Attack Samurai',
                attackKhan:             '🐎 Attack Khan',
                attackBerimondInvasion: '🛡️ Berimond Invasion',
                attackBerimondKingdom:  '👑 Berimond Kingdom',
                attackBloodcrows:       '🧤 Bloodcrows',
                attackDaimyo:           '🎌 Daimyo',
                attackForeign:          '⚔️ Attack Foreign',
                grandTornament:         '🏆 Grand Tournament',
                aquaIsland:             '🌊 Aqua Island',
                aquaTower:              '🗻 Aqua Tower',
                barracks:               '🪖 Barracks',
                blacksmith:             '🔨 Blacksmith',
                hospital:               '🏥 Hospital',
                buyTools:               '🛠️ Buy Tools',
                buySpeedGlobalEffect:   '⚡ Buy Speed Effects',
                nomadShop:              '🏕️ Nomad Shop',
                samuraiShop:            '🎋 Samurai Shop',
                spendAffluence:         '💎 Spend Affluence',
                toolsmith:              '⚒️ Toolsmith',
                khanDefence:            '🛡️ Khan Defence',
                stationOnHit:           '📍 Station On Hit',
                telegram:               '📱 Telegram',
                chat:                   '💬 Chat',
                incomingAttacks:        '🔔 Incoming Attacks',
                outgoingAttacks:        '📤 Outgoing Attacks',
                fortress:               '🏰 Fortress',
            }

            const visible = userPlugins.filter(p => !p.hidden && !INTERNAL.has(p.key))
            const enabled  = []
            const disabled = []

            visible.forEach(p => {
                const isOn = users?.some(u => u.plugins?.[p.key]?.state)
                const label = FRIENDLY[p.key] || p.key
                if (isOn) enabled.push(`✅ ${label}`)
                else      disabled.push(`❌ ${label}`)
            })

            const onCount = enabled.length
            const total   = visible.length
            const lines   = [...enabled, ...disabled]

            return {
                ok: true,
                text: `📋 **الإضافات (${onCount}/${total} شغّالة):**\n\n${lines.join('\n')}`
            }
        }

        case 'STATUS':
            return {
                ok: true,
                text: '📊 لمشاهدة حالة البوت، افتح صفحة **Dashboard** من القائمة الجانبية.',
                action: null,
            }

        case 'SET_PLUGIN_STATE': {
            if (!intent.plugin)
                return {
                    ok: false,
                    text: '❓ مش عارف الإضافة دي. اكتب **الإضافات** لشوف الأسماء الصح.',
                }
            const verb = intent.value ? 'تفعيل' : 'تعطيل'
            return {
                ok: true,
                text: `✅ جاري ${verb} إضافة **${intent.plugin}**...`,
                execute: { type: 'SET_PLUGIN_STATE', plugin: intent.plugin, value: intent.value },
            }
        }

        case 'SET_PLUGIN_OPTION': {
            const validation = validateValue(intent.value)
            if (!validation.ok)
                return { ok: false, text: `⚠️ خطأ في القيمة: ${validation.reason}` }

            return {
                ok: true,
                text: `✅ تم تغيير **${intent.option}** إلى **${validation.clean}**`,
                execute: { type: 'SET_PLUGIN_OPTION', option: intent.option, value: validation.clean },
            }
        }

        default:
            return { ok: false, text: '🤷 مش فاهم قصدك! اكتب **مساعدة** لشوف الأوامر.' }
    }
}

// ── Main exported function ────────────────────────────────────────

/**
 * Process a chatbot message from the user.
 *
 * @param {string} uuid         - User UUID (for rate limiting)
 * @param {string} rawMessage   - Raw text from the user
 * @param {object[]} users      - User's game accounts array
 * @param {object[]} userPlugins - Plugins visible to this user
 * @returns {{ ok: boolean, text: string, execute?: object }}
 */
function processMessage(uuid, rawMessage, users, userPlugins) {
    // ── Rate limiting ────────────────────────────────────────────
    const now = Date.now()
    const last = lastMessageTime.get(uuid) ?? 0
    if (now - last < CHATBOT_RATE_MS) {
        return { ok: false, text: '⏳ اصبر شوية قبل ما تبعت رسالة تانية!' }
    }
    lastMessageTime.set(uuid, now)

    // ── Sanitize ─────────────────────────────────────────────────
    const msg = sanitize(rawMessage)
    if (!msg || msg.length < 2)
        return { ok: false, text: '⚠️ الرسالة قصيرة جداً.' }

    // ── Match intent ──────────────────────────────────────────────
    let matchedIntent = null
    for (const intent of INTENTS) {
        for (const pattern of intent.patterns) {
            const match = msg.match(pattern)
            if (match) {
                matchedIntent = intent.handler(match, { uuid, users, userPlugins })
                break
            }
        }
        if (matchedIntent) break
    }

    return buildResponse(matchedIntent, users, userPlugins)
}

module.exports = { processMessage }
