import ReconnectingWebSocket from "reconnecting-websocket"
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { CircularProgress, Snackbar, Alert, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material'
import { useCookies } from 'react-cookie'
import * as React from 'react'
import './App.css'
import { ErrorType, GetErrorTypeName, ActionType, User } from "./types.js"
import DashboardOverview from './modules/DashboardOverview'
import LiveLog from './modules/LiveLog'
import ProxiesOverview from './modules/ProxiesOverview'
import SubscriptionInfo from './modules/SubscriptionInfo'
import SettingsTabs from './modules/SettingsTabs'
import AdminPanel from './modules/AdminPanel'
import HelpGuide from './modules/HelpGuide'
import UpdatesPage from './modules/UpdatesPage'
import DownloadPWA from './modules/DownloadPWA'
import Chatbot from './modules/Chatbot'
import settings from './settings.json'
import Avatar from '@mui/material/Avatar'
import {
  Bell,
  LayoutDashboard,
  Terminal,
  ShieldCheck,
  Star,
  Settings,
  Layers,
  LogOut,
  Moon,
  Sun,
  BookOpen,
  Sparkles,
  Download
} from 'lucide-react'

async function getGGELanguageFile(lang) {
  const languages = 
    (await(await fetch('/ggeProxyEmpire5/config/languages/version.json')).json()).languages

  try {
    var langFile = await (await fetch(`/ggeProxyEmpire5/config/languages/${languages[lang]}/${lang}.json`)).json()
  }
  catch (e) {
    console.warn(e)
    if(lang === "en")
      return

    langFile = await (await fetch(`/ggeProxyEmpire5/config/languages/${languages.en}/en.json`)).json()
  }
  return langFile
}

async function getSiteLanguageFile(lang) {
  let langFile = {}
  try {
    langFile = await (await fetch(`/locales/en.json`)).json()
  }
  catch(e) {
    console.error(e)
  }
  try {
    Object.assign(langFile, await (await fetch(`/locales/${lang}.json`)).json())
  }
  catch (e) {
    console.warn(e)
  }

  return langFile
}

function GrabAssets() {
  const [cookies, setCookie] = useCookies(['lang'])
  const [lang, setLang] = React.useState(null)
  const [error, setError] = React.useState(null)

  const currentLang = cookies.lang || "en"

  React.useEffect(() => {
    let active = true
    const loadLang = async () => {
      try {
        const langFiles = await Promise.all([
          getGGELanguageFile(currentLang),
          getSiteLanguageFile(currentLang)
        ])
        const merged = {}
        for (let i = 0; i < langFiles.length; i++) {
          if (langFiles[i]) {
            Object.assign(merged, langFiles[i])
          }
        }
        if (active) {
          setLang(merged)
        }
      } catch (e) {
        console.error("Failed to load language:", e)
        if (active) {
          setError(e.message || String(e))
          // Fallback to empty language object to keep the app working
          setLang({})
        }
      }
    }

    loadLang()
    return () => {
      active = false
    }
  }, [currentLang])

  const changeLanguage = (newLang) => {
    setCookie("lang", newLang, { path: '/', maxAge: 31536000 })
    setLang(null) // Show loader while loading new language
  }

  if (error && !lang) {
    return (
      <div style={{ color: '#ef4444', padding: 20, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Error Loading Application</h2>
        <pre>{error}</pre>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: '#00bda6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
      </div>
    )
  }

  if (!lang) {
    return (
      <CircularProgress style={{
        margin: "0",
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        color: "#00bda6"
      }} />
    )
  }

  const __ = key => {
    return lang[key] || key
  }

  return <App setLanguage={changeLanguage} languageCode={currentLang} __={__} />
}

// Dynamic MUI Theme Configuration is now created inside the App component to support RTL/LTR dynamically.

function App({setLanguage, languageCode, __}) {
  const [users, setUsers] = React.useState([])
  const [usersStatus, setUsersStatus] = React.useState({})
  const [plugins, setPlugins] = React.useState([])
  const [channelInfo, setChannelInfo] = React.useState([])
  const [profile, setProfile] = React.useState(null)
  const [activeTab, setActiveTab] = React.useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [snackbar, setSnackbar] = React.useState({ open: false, message: '', severity: 'error' })
  const [isConnected, setIsConnected] = React.useState(false)
  const [supportOpen, setSupportOpen] = React.useState(false)
  const [themeMode, setThemeMode] = React.useState(localStorage.getItem('themeMode') || 'light')
  const [notifications, setNotifications] = React.useState([])
  const [notificationCenterOpen, setNotificationCenterOpen] = React.useState(false)
  const [installPrompt, setInstallPrompt] = React.useState(null)

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const theme = React.useMemo(() => {
    const dir = languageCode === 'ar' ? 'rtl' : 'ltr';
    return createTheme({
      direction: dir,
      palette: {
        mode: themeMode,
        primary: {
          main: '#00bda6',
        },
        secondary: {
          main: '#5ab4dc',
        },
        background: {
          default: themeMode === 'light' ? '#f3f4f6' : '#0a0c16',
          paper: themeMode === 'light' ? '#ffffff' : '#121522',
        },
        text: {
          primary: themeMode === 'light' ? '#111827' : '#ffffff',
          secondary: themeMode === 'light' ? '#4b5563' : '#a8bdd8',
        }
      },
      typography: {
        fontFamily: "'Cairo', 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 14,
      },
      shape: {
        borderRadius: 12,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 600,
              letterSpacing: '0.02em',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
            },
          },
        },
      },
    });
  }, [themeMode, languageCode]);

  const supportMethods = [
    { label: "Telegram Support (تيليجرام)", value: "https://t.me/your_telegram" },
    { label: "Discord Support (ديسكورد)", value: "your_discord" },
    { label: "Vodafone Cash - Financial Only (فودافون كاش - تحويلات فقط، يمنع الواتساب نهائياً!)", value: "01000000000" },
    { label: "USDT (BEP20 network)", value: "your_usdt_wallet_address_here" },
    { label: "Bitcoin (Bitcoin network)", value: "your_bitcoin_wallet_address_here" },
    { label: "ETH (Ethereum network)", value: "your_ethereum_wallet_address_here" },
    { label: "Solana (SOL network)", value: "your_solana_wallet_address_here" },
    { label: "Tron (TRX network)", value: "your_tron_wallet_address_here" },
    { label: "BNB Coin (BNB network)", value: "your_bnb_wallet_address_here" }
  ]

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setSnackbar({ open: true, message: __('copied') || 'Copied', severity: 'success' })
    } catch (e) {
      setSnackbar({ open: true, message: __('copyFailed') || 'Copy failed', severity: 'error' })
    }
  }
  
  React.useEffect(() => {
    const isRtl = languageCode === 'ar';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.body.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = languageCode;
  }, [languageCode])

  React.useEffect(() => {
    document.body.className = `${themeMode}-theme`
  }, [themeMode])

  let ws = React.useMemo(() => {
    const usersStatus = {}
    const ws = new ReconnectingWebSocket(`${window.location.protocol === 'https:' ? "wss" : "ws"}://${window.location.hostname}:${settings.port ?? window.location.port}`, [], { WebSocket: WebSocket, minReconnectionDelay: 3000 })

    ws.addEventListener("message", (msg) => {
      let [err, action, obj] = JSON.parse(msg.data.toString())
      if (err) {
        console.error(GetErrorTypeName(err))
        if (err !== ErrorType.Success && obj && obj.error) {
          setSnackbar({ open: true, message: obj.error, severity: 'error' })
        }
      }

      switch (Number(action)) {
        case ActionType.GetUUID:
          if(err === ErrorType.Unauthenticated)
          return window.location.href = "signin.html"
          break
        case ActionType.GetChannels:
          setChannelInfo(obj ?? [])
          break
        case ActionType.GetUsers:
          if (err !== ErrorType.Success)
            return

          setUsers(obj[0].map(e => new User(e)))
          setPlugins(obj[1])
          break
        case ActionType.StatusUser:
          usersStatus[obj.id] = obj
          setUsersStatus(structuredClone(usersStatus))
          break
        case ActionType.GetProfile:
          setProfile(obj)
          break
        case ActionType.GetNotifications:
          setNotifications(obj)
          break
        default:
          return
      }
    })
    return ws
  }, [])

  React.useEffect(() => {
    const onOpen = () => {
      setIsConnected(true)
      ws.send(JSON.stringify([ErrorType.Success, ActionType.GetNotifications, {}]))
    }
    const onClose = () => setIsConnected(false)
    ws.addEventListener('open', onOpen)
    ws.addEventListener('close', onClose)
    if (ws.readyState === 1) {
      setIsConnected(true)
      ws.send(JSON.stringify([ErrorType.Success, ActionType.GetNotifications, {}]))
    }
    return () => {
      ws.removeEventListener('open', onOpen)
      ws.removeEventListener('close', onClose)
    }
  }, [ws])

  const handleSignOut = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
    } catch(e) { /* ignore network error */ }
    window.location.href = "signin.html"
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardOverview
            username={profile?.username || 'test'}
            users={users}
            plugins={plugins}
            usersStatus={usersStatus}
            ws={ws}
            profile={profile}
            channels={channelInfo[1]}
            channelInfo={channelInfo}
            __={__}
            setActiveTab={setActiveTab}
            onOpenSupport={() => setSupportOpen(true)}
          />
        )
      case 'liveLog':
        return <LiveLog ws={ws} users={users} __={__} />
      case 'proxies':
        return <ProxiesOverview users={users} __={__} />
      case 'subscription':
        return (
          <SubscriptionInfo
            username={profile?.username || 'test'}
            maxAccounts={profile?.privilege === 1 ? '∞' : (profile?.maxGameAccounts || 1)}
            profile={profile}
            ws={ws}
            __={__}
          />
        )
      case 'settings':
        return <SettingsTabs ws={ws} __={__} profile={profile} users={users} />
      case 'guide':
        return <HelpGuide languageCode={languageCode} __={__} />
      case 'updates':
        return <UpdatesPage __={__} languageCode={languageCode} />
      case 'downloadApp':
        return <DownloadPWA installPrompt={installPrompt} __={__} languageCode={languageCode} />
      case 'adminPanel':
        return profile && profile.privilege === 1 ? (
          <AdminPanel ws={ws} __={__} profile={profile} plugins={plugins} />
        ) : null
      default:
        return null
    }
  }

  const getHeaderInfo = () => {
    const now = new Date()
    const days = [
      __('sunday') || 'Sunday',
      __('monday') || 'Monday',
      __('tuesday') || 'Tuesday',
      __('wednesday') || 'Wednesday',
      __('thursday') || 'Thursday',
      __('friday') || 'Friday',
      __('saturday') || 'Saturday'
    ]
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const currentDateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`

    switch (activeTab) {
      case 'dashboard':
        return {
          title: __('dashboard') || 'Dashboard',
          subtitle: currentDateStr
        }
      case 'gameAccounts':
        return {
          title: __('gameAccounts') || 'Game Accounts',
          subtitle: __('manageInstances') || 'Manage your game bot instances.'
        }
      case 'liveLog':
        return {
          title: __('liveLog') || 'Live Log',
          subtitle: __('liveLogSubtitle') || 'Monitor live activity logs for all bots.'
        }
      case 'proxies':
        return {
          title: __('proxies') || 'Proxies',
          subtitle: __('proxiesSubtitle') || 'Monitor proxy health and assignment status.'
        }
      case 'subscription':
        return {
          title: __('subscription') || 'Subscription',
          subtitle: __('subscriptionSubtitle') || 'Manage your plan and upgrade options.'
        }
      case 'settings':
        return {
          title: __('settings') || 'Settings',
          subtitle: __('settingsSubtitle') || 'Configure notifications and account security.'
        }
      case 'guide':
        return {
          title: __('helpGuide') || 'User Guide & Documentation',
          subtitle: __('helpGuideSubtitle') || 'Configure your GGE BOT and optimize your automation.'
        }
      case 'updates':
        return {
          title: __('updatesAndRoadmap') || 'Updates & Roadmap',
          subtitle: languageCode === 'ar' ? 'التحديثات الأخيرة والميزات القادمة' : 'Recent completed features and future plans.'
        }
      case 'downloadApp':
        return {
          title: languageCode === 'ar' ? 'تحميل التطبيق' : 'Download Application',
          subtitle: languageCode === 'ar' ? 'تثبيت تطبيق EGY BOT على أجهزتك المختلفة للوصول السريع' : 'Install EGY BOT application on your devices for fast access.'
        }
      case 'adminPanel':
        return {
          title: __('adminDashboard') || 'Admin Dashboard',
          subtitle: __('adminDashboardSubtitle') || 'Monitor performance and manage users.'
        }
      default:
        return { title: '', subtitle: '' }
    }
  }

  const { title, subtitle } = getHeaderInfo()

  return (
    <ThemeProvider theme={theme}>
      <div className={`App ${themeMode}-theme`}>
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── AI Chatbot floating button (visible on all pages) ── */}
        <Chatbot ws={ws} />

        <div className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', padding: '24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Avatar src="/user-icon.png" sx={{ bgcolor: '#7c8dff', width: 40, height: 40, fontSize: '14px', fontWeight: 800 }}>
                {profile ? profile.username.substring(0, 2).toUpperCase() : 'US'}
              </Avatar>
              <div>
                <Typography sx={{ fontWeight: 800, fontSize: '15px', color: '#fff', lineHeight: 1.2 }}>
                  {profile ? profile.username : 'test'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mt: 0.3 }}>
                  <Typography sx={{ fontSize: '12px', color: '#ffd700', fontWeight: 800 }}>
                    {languageCode === 'ar' ? 'الرصيد: ' : 'Credits: '}{profile?.credits || 0} EGP
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => { setActiveTab('subscription'); setSidebarOpen(false); }}
                    className="btn-gold-glow"
                    sx={{
                      height: '18px',
                      minWidth: '24px',
                      width: '24px',
                      p: 0,
                      borderRadius: '50% !important',
                      background: 'linear-gradient(135deg, #ffd700 0%, #cca100 100%) !important',
                      color: '#0c0e16',
                      fontWeight: 900,
                      fontSize: '11px !important',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #ffe57f 0%, #cca100 100%) !important',
                      }
                    }}
                  >
                    +
                  </Button>
                </Box>
              </div>
            </div>
          </div>
          <div className="sidebar-nav" style={{ padding: '20px 12px' }}>
            <div
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
              style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
            >
              <LayoutDashboard size={18} />
              {__("dashboard") || "Dashboard"}
            </div>

            <div
              className={`nav-item ${activeTab === 'liveLog' ? 'active' : ''}`}
              onClick={() => { setActiveTab('liveLog'); setSidebarOpen(false); }}
              style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
            >
              <Terminal size={18} />
              {__("liveLog") || "Live Log"}
            </div>

            <div
              className={`nav-item ${activeTab === 'proxies' ? 'active' : ''}`}
              onClick={() => { setActiveTab('proxies'); setSidebarOpen(false); }}
              style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
            >
              <ShieldCheck size={18} />
              {__("proxies") || "Proxies"}
            </div>

            <div
              className={`nav-item ${activeTab === 'subscription' ? 'active' : ''}`}
              onClick={() => { setActiveTab('subscription'); setSidebarOpen(false); }}
              style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
            >
              <Star size={18} />
              {__("subscription") || "Subscription"}
            </div>

            <div
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
              style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
            >
              <Settings size={18} />
              {__("settings") || "Settings"}
            </div>

            <div
              className={`nav-item ${activeTab === 'updates' ? 'active' : ''}`}
              onClick={() => { setActiveTab('updates'); setSidebarOpen(false); }}
              style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
            >
              <Sparkles size={18} />
              {__("updatesAndRoadmap") || "Updates & Roadmap"}
            </div>

            <div
              className={`nav-item ${activeTab === 'guide' ? 'active' : ''}`}
              onClick={() => { setActiveTab('guide'); setSidebarOpen(false); }}
              style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
            >
              <BookOpen size={18} />
              {__("helpGuide") || "Help Guide"}
            </div>

            <div
              className={`nav-item ${activeTab === 'downloadApp' ? 'active' : ''}`}
              onClick={() => { setActiveTab('downloadApp'); setSidebarOpen(false); }}
              style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
            >
              <Download size={18} />
              {languageCode === 'ar' ? "تحميل التطبيق" : "Download App"}
            </div>

            {profile && profile.privilege === 1 && (
              <div
                className={`nav-item ${activeTab === 'adminPanel' ? 'active' : ''}`}
                onClick={() => { setActiveTab('adminPanel'); setSidebarOpen(false); }}
                style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
              >
                <Layers size={18} className="text-amber-500" />
                {__("adminPanel") || "Admin Panel"}
              </div>
            )}
          </div>

          <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', padding: '20px' }}>
            {/* Connection Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span className={isConnected ? "pulse-online" : ""} style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444', boxShadow: isConnected ? '0 0 10px #10b981' : '0 0 10px #ef4444' }}></span>
              <Typography sx={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>
                {isConnected ? (__('connectedToServer') || 'Connected to server') : (__('disconnectedFromServer') || 'Disconnected')}
              </Typography>
            </div>

            {/* Profile Sign Out block */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>
                {profile?.privilege === 1 ? (__('systemManager') || 'System Manager') : (__('userSession') || 'User Session')}
              </Typography>
              <div
                onClick={handleSignOut}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', cursor: 'pointer', transition: 'all 0.2s', padding: '6px', borderRadius: '8px', background: 'rgba(255, 107, 107, 0.05)' }}
                title={__('signOut')}
              >
                <LogOut size={16} />
              </div>
            </div>
          </div>
        </div>

        <div className="main-content">
          <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="menu-toggle-wrapper">
                <button 
                  className={`menu-toggle-btn ${sidebarOpen ? 'open' : ''}`}
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-label="Toggle Sidebar"
                >
                  <span className="bar"></span>
                  <span className="bar"></span>
                  <span className="bar"></span>
                </button>
              </div>
              <div className="content-header-title">
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
            </div>

            {/* Right Side Header Items */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => {
                  const newLang = languageCode === 'en' ? 'ar' : 'en'
                  setLanguage(newLang)
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: '18px',
                  padding: '0 12px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: languageCode === 'ar' ? 'Cairo' : 'Outfit',
                }}
              >
                {languageCode === 'en' ? 'العربية' : 'English'}
              </button>

              <button
                onClick={() => {
                  const newMode = themeMode === 'light' ? 'dark' : 'light'
                  setThemeMode(newMode)
                  localStorage.setItem('themeMode', newMode)
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                {themeMode === 'light' ? '🌙' : '☀️'}
              </button>
              
              {/* Notification Bell */}
              <button
                onClick={() => setNotificationCenterOpen(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  color: 'var(--text-primary)'
                }}
              >
                <Bell size={18} />
                {notifications.some(n => !n.isRead) && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '8px',
                      height: '8px',
                      background: '#ef4444',
                      borderRadius: '50%',
                      boxShadow: '0 0 8px #ef4444'
                    }}
                  />
                )}
              </button>

              <div className="header-user-badge" style={{ display: 'flex', flexDirection: 'column', alignItems: languageCode === 'ar' ? 'flex-start' : 'flex-end', fontSize: '12px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{profile?.username}</span>
                <span style={{ color: 'var(--text-muted)' }}>{profile?.privilege === 1 ? (__('admin') || 'Admin') : (__('credits') || 'Credits: ') + (profile?.credits || 0)}</span>
              </div>
            </div>
          </div>
          
          {renderContent()}
          
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
              {__(snackbar.message) || snackbar.message}
            </Alert>
          </Snackbar>

          <Dialog open={supportOpen} onClose={() => setSupportOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{__("supportUsTitle") || "Support Us"}</DialogTitle>
            <DialogContent dividers>
              <Typography sx={{ mb: 2, color: '#b8c8dd', fontSize: '13px' }}>
                {__("supportUsSubtitle") || "If you want to support us, use any method below."}
              </Typography>
              <div style={{ display: 'grid', gap: '10px' }}>
                {supportMethods.map((m, i) => (
                  <div key={i} style={{ border: '1px solid rgba(161,190,225,0.25)', borderRadius: '10px', padding: '10px 12px', background: 'rgba(7,11,18,0.92)' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '13px', mb: 0.6 }}>{m.label}</Typography>
                    {m.value.startsWith('http') ? (
                      <a href={m.value} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#00bda6', fontWeight: 700, fontSize: '13px', display: 'inline-block', marginBottom: '8px', wordBreak: 'break-all' }}>
                        {m.value}
                      </a>
                    ) : (
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all', color: '#dbe9ff' }}>{m.value}</Typography>
                    )}
                    <Button size="small" variant="outlined" sx={{ mt: 1, display: m.value.startsWith('http') ? 'none' : 'inline-flex' }} onClick={() => copyToClipboard(m.value)}>
                      {__("copy") || "Copy"}
                    </Button>
                  </div>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSupportOpen(false)}>{__("close") || "Close"}</Button>
            </DialogActions>
          </Dialog>

          {/* User Notification Center Dialog */}
          <Dialog
            open={notificationCenterOpen}
            onClose={() => setNotificationCenterOpen(false)}
            maxWidth="xs"
            fullWidth
            PaperProps={{ className: 'premium-glass-card border-glow-blue' }}
          >
            <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#00bda6' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} />
                {__('notifications') || 'Notifications'}
              </span>
              {notifications.some(n => !n.isRead) && (
                <Button
                  size="small"
                  onClick={() => {
                    // Mark all as read
                    notifications.filter(n => !n.isRead).forEach(n => {
                      ws.send(JSON.stringify([
                        ErrorType.Success,
                        ActionType.ReadNotification,
                        { notificationId: n.id }
                      ]))
                    })
                  }}
                  sx={{ fontSize: '11px', fontWeight: 700, color: '#00bda6' }}
                >
                  {__('markAllRead') || 'Mark All Read'}
                </Button>
              )}
            </DialogTitle>
            <DialogContent dividers sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '350px', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <Typography sx={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', py: 3 }}>
                  {__('noNotifications') || 'No notifications yet.'}
                </Typography>
              ) : (
                notifications.map((n) => (
                  <Box
                    key={n.id}
                    sx={{
                      p: 1.5,
                      borderRadius: '8px',
                      background: n.isRead ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 189, 166, 0.06)',
                      border: n.isRead ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 189, 166, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                      transition: 'all 0.2s'
                    }}
                  >
                    <Typography sx={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: n.isRead ? 400 : 700 }}>
                      {n.message}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography sx={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {new Date(n.createdAt).toLocaleString(languageCode === 'ar' ? 'ar-EG' : 'en-US')}
                      </Typography>
                      {!n.isRead && (
                        <Button
                          size="small"
                          onClick={() => {
                            ws.send(JSON.stringify([
                              ErrorType.Success,
                              ActionType.ReadNotification,
                              { notificationId: n.id }
                            ]))
                          }}
                          sx={{ py: 0.2, minWidth: 'auto', fontSize: '10px', fontWeight: 700 }}
                        >
                          {__('markAsRead') || 'Mark as Read'}
                        </Button>
                      )}
                    </Box>
                  </Box>
                ))
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setNotificationCenterOpen(false)}>
                {__('close') || 'Close'}
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      </div>
    </ThemeProvider>
  )
}

export default GrabAssets


