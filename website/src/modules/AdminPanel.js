import * as React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Box,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Paper,
  Tabs,
  Tab
} from '@mui/material'
import { ActionType, ErrorType } from '../types.js'
import { Settings, Bell, Star, Power, Trash, Plus, Users, Cpu, Activity, Server, UserPlus, Edit, Ban } from 'lucide-react'

export default function AdminPanel({ ws, __, profile, plugins }) {
  const [stats, setStats] = React.useState(null)
  const [totalBots, setTotalBots] = React.useState(0)
  const [activeBots, setActiveBots] = React.useState(0)
  const [users, setUsers] = React.useState([])

  // User creation form state
  const [newUsername, setNewUsername] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [formStatus, setFormStatus] = React.useState({ type: '', message: '' })

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [userToDelete, setUserToDelete] = React.useState(null)

  // Plugins management dialog state
  const [pluginsDialogOpen, setPluginsDialogOpen] = React.useState(false)
  const [selectedUserForPlugins, setSelectedUserForPlugins] = React.useState(null)
  const [selectedAllowedPlugins, setSelectedAllowedPlugins] = React.useState([])

  // Alerts management dialog state
  const [alertsDialogOpen, setAlertsDialogOpen] = React.useState(false)
  const [selectedUserForAlerts, setSelectedUserForAlerts] = React.useState(null)
  const [selectedAllowedAlerts, setSelectedAllowedAlerts] = React.useState([])

  // Kill all active bots confirmation state
  const [killAllConfirmOpen, setKillAllConfirmOpen] = React.useState(false)

  // Kill user active bots confirmation state
  const [killUserConfirmOpen, setKillUserConfirmOpen] = React.useState(false)
  const [userToKillBots, setUserToKillBots] = React.useState(null)

  // Subscription management dialog state
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = React.useState(false)
  const [selectedUserForSubscription, setSelectedUserForSubscription] = React.useState(null)
  const [subPlan, setSubPlan] = React.useState('trial')
  const [subExpiry, setSubExpiry] = React.useState('')
  const [subAlliance, setSubAlliance] = React.useState('')
  const [subLimit, setSubLimit] = React.useState(1)
  const [subCredits, setSubCredits] = React.useState(0)
  const [creditsMode, setCreditsMode] = React.useState('set')
  const [creditsAmount, setCreditsAmount] = React.useState(0)

  // Edit profile dialog state
  const [editProfileDialogOpen, setEditProfileDialogOpen] = React.useState(false)
  const [selectedUserForEdit, setSelectedUserForEdit] = React.useState(null)
  const [editUsername, setEditUsername] = React.useState('')
  const [editPassword, setEditPassword] = React.useState('')
  const [editEmail, setEditEmail] = React.useState('')
  const [editProfileStatus, setEditProfileStatus] = React.useState({ type: '', message: '' })

  // Admin notifications state
  const [notificationDialogOpen, setNotificationDialogOpen] = React.useState(false)
  const [notificationTarget, setNotificationTarget] = React.useState('')
  const [notificationMessage, setNotificationMessage] = React.useState('')
  const [notificationStatus, setNotificationStatus] = React.useState({ type: '', message: '' })

  // Admin notifications history state
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false)
  const [sentNotifications, setSentNotifications] = React.useState([])
  const [deleteConfirmOpenNotification, setDeleteConfirmOpenNotification] = React.useState(false)
  const [notificationToDelete, setNotificationToDelete] = React.useState(null)

  // Unified Management & Create User dialog states
  const [manageTab, setManageTab] = React.useState(0)
  const [createUserDialogOpen, setCreateUserDialogOpen] = React.useState(false)

  // Credit requests & promo codes state
  const [adminSectionTab, setAdminSectionTab] = React.useState(0)
  const [creditRequests, setCreditRequests] = React.useState([])
  const [promoCodes, setPromoCodes] = React.useState([])
  const [viewScreenshotUrl, setViewScreenshotUrl] = React.useState(null)
  const [screenshotDialogOpen, setScreenshotDialogOpen] = React.useState(false)
  const [promoCodeInput, setPromoCodeInput] = React.useState('')
  const [promoCreditsInput, setPromoCreditsInput] = React.useState(300)
  const [promoPriceInput, setPromoPriceInput] = React.useState(100)
  const [promoMaxUsesInput, setPromoMaxUsesInput] = React.useState('')
  const [promoExpiryInput, setPromoExpiryInput] = React.useState('')

  // Admin Notification Settings states
  const [adminTelegramEnabled, setAdminTelegramEnabled] = React.useState(false)
  const [adminTelegramToken, setAdminTelegramToken] = React.useState('')
  const [adminTelegramChatId, setAdminTelegramChatId] = React.useState('')
  const [adminSettingsStatus, setAdminSettingsStatus] = React.useState({ type: '', message: '' })

  // Banned Emails state
  const [bannedEmails, setBannedEmails] = React.useState([])
  const [newBannedEmail, setNewBannedEmail] = React.useState('')

  // Banned & Blocked IPs state
  const [bannedIPs, setBannedIPs] = React.useState([])
  const [blockedIPs, setBlockedIPs] = React.useState([])
  const [newBannedIP, setNewBannedIP] = React.useState('')

  const handleBanIP = (e) => {
    e.preventDefault()
    if (!newBannedIP.trim()) return
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AdminBanIP,
      { ip: newBannedIP.trim() }
    ]))
    setNewBannedIP('')
  }

  const handleUnbanIP = (ip) => {
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AdminUnbanIP,
      { ip }
    ]))
  }

  const handleClearBlockedIP = (ip, type) => {
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AdminClearBlockedIP,
      { ip, type }
    ]))
  }

  React.useEffect(() => {
    // Request initial data
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify([ErrorType.Success, ActionType.GetAdminData, {}]))
      ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminListUsers, {}]))
      ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetCreditRequests, {}]))
      ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminManagePromoCodes, { action: 'list' }]))
      ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetSystemSettings, {}]))
      ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBannedEmails, {}]))
      ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBannedIPs, {}]))
      ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBlockedIPs, {}]))
    }

    const handleMessage = (event) => {
      try {
        const [err, action, obj] = JSON.parse(event.data.toString())
        if (Number(err) !== ErrorType.Success && Number(err) !== ErrorType.Authentication) {
          return
        }

        switch (Number(action)) {
          case ActionType.GetAdminData:
            if (obj) {
              setStats(obj.stats)
              setTotalBots(obj.totalGameAccounts)
              setActiveBots(obj.activeGameAccounts)
            }
            break
          case ActionType.AdminGetSystemSettings:
            if (obj) {
              setAdminTelegramEnabled(!!obj.adminTelegramEnabled)
              setAdminTelegramToken(obj.adminTelegramToken || '')
              setAdminTelegramChatId(obj.adminTelegramChatId || '')
            }
            break
          case ActionType.AdminSaveSystemSettings:
            if (obj.success) {
              const msg = obj.isTest
                ? (__('telegramTestSent') || '✅ تم إرسال رسالة تجريبية على التيليجرام!')
                : (__('settingsSavedSuccessfully') || 'تم الحفظ بنجاح!')
              setAdminSettingsStatus({ type: 'success', message: msg })
              setTimeout(() => setAdminSettingsStatus({ type: '', message: '' }), 4000)
            } else {
              setAdminSettingsStatus({ type: 'error', message: obj.error || 'Failed to save settings.' })
            }
            break

          case ActionType.AdminListUsers:
            if (Array.isArray(obj)) {
              setUsers(obj)
            }
            break
          case ActionType.AdminCreateUser:
            if (obj.success) {
              setFormStatus({ type: 'success', message: __('userCreatedSuccessfully') || 'User created successfully!' })
              setNewUsername('')
              setNewPassword('')
              setCreateUserDialogOpen(false)
              alert(__('userCreatedSuccessfully') || 'User created successfully!')
            } else {
              setFormStatus({ type: 'error', message: obj.error || __('failedToCreateUser') || 'Failed to create user.' })
            }
            break
          case ActionType.AdminDeleteUser:
            if (obj.success) {
              // Success handled by AdminListUsers refresh sent by backend
            } else {
              alert(obj.error || 'Failed to delete user.')
            }
            break
          case ActionType.AdminUpdateUserLimit:
            if (obj.success) {
              // Success handled by AdminListUsers refresh sent by backend
            }
            break
          case 31: // ActionType.AdminUpdateAllowedAlerts
            if (obj.success) {
              // Success handled by AdminListUsers refresh sent by backend
            }
            break
          case 32: // ActionType.AdminKillUserBots
            if (obj.success) {
              alert(__('killUserBotsSuccess') || 'Active bots for this user have been stopped.')
            }
            break
          case 33: // ActionType.AdminKillAllBots
            if (obj.success) {
              alert(__('killAllBotsSuccess') || 'All active bots have been stopped.')
            }
            break
          case 34: // ActionType.AdminUpdateSubscription
            if (obj.success) {
              // Success alert is handled by dynamic list refresh or shown directly
            } else {
              alert(obj.error || __('failedToUpdateSubscription') || 'Failed to update subscription.')
            }
            break
          case 36: // ActionType.AdminUpdateUserProfile
            if (obj.success) {
              setEditProfileDialogOpen(false)
            } else {
              setEditProfileStatus({ type: 'error', message: obj.error || 'Failed to update user profile.' })
            }
            break
          case ActionType.AdminSendNotification:
            if (obj.success) {
              setNotificationStatus({ type: 'success', message: __('notificationSentSuccessfully') || 'Notification sent successfully!' })
              setNotificationMessage('')
              setTimeout(() => {
                setNotificationDialogOpen(false)
                setNotificationStatus({ type: '', message: '' })
              }, 1500)
            } else {
              setNotificationStatus({ type: 'error', message: obj.error || 'Failed to send notification.' })
            }
            break
          case ActionType.AdminDeleteNotification:
            if (obj.success) {
              setDeleteConfirmOpenNotification(false)
              setNotificationToDelete(null)
            } else {
              alert(obj.error || 'Failed to delete notification.')
            }
            break
          case ActionType.AdminGetSentNotifications:
            if (Array.isArray(obj)) {
              setSentNotifications(obj)
            }
            break
          case ActionType.AdminGetCreditRequests:
            if (Array.isArray(obj)) {
              setCreditRequests(obj)
            }
            break
          case ActionType.AdminHandleCreditRequest:
            if (obj.success) {
              alert(__('creditRequestProcessedSuccess') || 'Credit request processed successfully!')
            } else {
              alert(obj.error || 'Failed to process credit request.')
            }
            break
          case ActionType.AdminManagePromoCodes:
            if (Array.isArray(obj)) {
              setPromoCodes(obj)
            }
            break
          case ActionType.AdminGetBannedEmails:
            if (Array.isArray(obj)) {
              setBannedEmails(obj)
            }
            break
          case ActionType.AdminGetBannedIPs:
            if (Array.isArray(obj)) {
              setBannedIPs(obj)
            }
            break
          case ActionType.AdminGetBlockedIPs:
            if (Array.isArray(obj)) {
              setBlockedIPs(obj)
            }
            break
          default:
            break
        }
      } catch (e) {
        console.error(e)
      }
    }

    ws.addEventListener('message', handleMessage)

    // Set up polling for system metrics every 5 seconds
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify([ErrorType.Success, ActionType.GetAdminData, {}]))
        ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetBlockedIPs, {}]))
      }
    }, 5000)

    return () => {
      ws.removeEventListener('message', handleMessage)
      clearInterval(interval)
    }
  }, [ws, __])

  const handleCreateUser = (e) => {
    e.preventDefault()
    setFormStatus({ type: '', message: '' })

    if (!newUsername || !newPassword) {
      setFormStatus({ type: 'error', message: __('fillAllFields') || 'Please fill in all fields.' })
      return
    }

    if (newPassword.length < 6) {
      setFormStatus({ type: 'error', message: __('passwordTooShort') || 'Password must be at least 6 characters long.' })
      return
    }

    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AdminCreateUser,
      { username: newUsername, password: newPassword }
    ]))
  }

  const openDeleteConfirm = (user) => {
    setUserToDelete(user)
    setDeleteConfirmOpen(true)
  }

  const closeDeleteConfirm = () => {
    setUserToDelete(null)
    setDeleteConfirmOpen(false)
  }

  const handleDeleteUser = () => {
    if (userToDelete) {
      ws.send(JSON.stringify([
        ErrorType.Success,
        ActionType.AdminDeleteUser,
        userToDelete.uuid
      ]))
    }
    closeDeleteConfirm()
  }

  const openPluginsDialog = (user) => {
    setSelectedUserForPlugins(user)
    let allowed = []
    if (user.allowedPlugins) {
      try {
        allowed = JSON.parse(user.allowedPlugins)
      } catch (e) {
        allowed = []
      }
    } else {
      allowed = (plugins || []).map(p => p.key)
    }
    setSelectedAllowedPlugins(allowed)
    setPluginsDialogOpen(true)
  }

  const handleTogglePlugin = (key) => {
    setSelectedAllowedPlugins(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key)
      } else {
        return [...prev, key]
      }
    })
  }

  const handleSavePlugins = () => {
    if (selectedUserForPlugins) {
      ws.send(JSON.stringify([
        ErrorType.Success,
        30, // ActionType.AdminUpdateAllowedPlugins
        { targetUuid: selectedUserForPlugins.uuid, allowedAllowedPlugins: selectedAllowedPlugins }
      ]))
    }
    setEditProfileDialogOpen(false)
  }

  const openAlertsDialog = (user) => {
    setSelectedUserForAlerts(user)
    let allowed = []
    if (user.allowedAlerts) {
      try {
        allowed = JSON.parse(user.allowedAlerts)
      } catch (e) {
        allowed = []
      }
    } else {
      allowed = ['incomingMe', 'incomingAlliance', 'outgoingMe', 'outgoingAlliance', 'chat', 'fortress', 'errors', 'system']
    }
    setSelectedAllowedAlerts(allowed)
    setAlertsDialogOpen(true)
  }

  const handleToggleAlert = (key) => {
    setSelectedAllowedAlerts(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key)
      } else {
        return [...prev, key]
      }
    })
  }

  const handleSaveAlerts = () => {
    if (selectedUserForAlerts) {
      ws.send(JSON.stringify([
        ErrorType.Success,
        31, // ActionType.AdminUpdateAllowedAlerts
        { targetUuid: selectedUserForAlerts.uuid, allowedAlerts: selectedAllowedAlerts }
      ]))
    }
    setEditProfileDialogOpen(false)
  }

  const handleKillUserBots = () => {
    if (userToKillBots) {
      ws.send(JSON.stringify([
        ErrorType.Success,
        32, // ActionType.AdminKillUserBots
        { targetUuid: userToKillBots.uuid }
      ]))
    }
    setKillUserConfirmOpen(false)
    setUserToKillBots(null)
  }

  const handleKillAllBots = () => {
    ws.send(JSON.stringify([
      ErrorType.Success,
      33, // ActionType.AdminKillAllBots
      {}
    ]))
    setKillAllConfirmOpen(false)
  }

  const openSubscriptionDialog = (user) => {
    setSelectedUserForSubscription(user)
    setSubPlan(user.subscriptionPlan || 'none')
    setSubExpiry(user.subscriptionExpiry || '')
    setSubAlliance(user.subscriptionAlliance || '')
    setSubLimit(user.maxGameAccounts || 1)
    setSubCredits(user.credits || 0)
    setCreditsMode('set')
    setCreditsAmount(0)
    setSubscriptionDialogOpen(true)
  }

  const handleSaveSubscription = () => {
    if (selectedUserForSubscription) {
      let finalCredits = selectedUserForSubscription.credits || 0
      const amount = Number(creditsAmount || 0)
      if (creditsMode === 'add') {
        finalCredits += amount
      } else if (creditsMode === 'deduct') {
        finalCredits = Math.max(0, finalCredits - amount)
      } else {
        finalCredits = Math.max(0, amount)
      }

      ws.send(JSON.stringify([
        ErrorType.Success,
        34, // ActionType.AdminUpdateSubscription
        {
          targetUuid: selectedUserForSubscription.uuid,
          subscriptionPlan: subPlan,
          subscriptionExpiry: subExpiry || null,
          subscriptionAlliance: subAlliance || null,
          maxGameAccounts: Number(subLimit || 1),
          credits: Number(finalCredits)
        }
      ]))
    }
    setEditProfileDialogOpen(false)
  }

  const openEditProfileDialog = (user) => {
    setSelectedUserForEdit(user)
    
    // Tab 0 (Profile)
    setEditUsername(user.username || '')
    setEditPassword('')
    setEditEmail(user.gameEmails || '')
    setEditProfileStatus({ type: '', message: '' })

    // Tab 1 (Subscription)
    setSelectedUserForSubscription(user)
    setSubPlan(user.subscriptionPlan || 'none')
    setSubExpiry(user.subscriptionExpiry || '')
    setSubAlliance(user.subscriptionAlliance || '')
    setSubLimit(user.maxGameAccounts || 1)
    setSubCredits(user.credits || 0)
    setCreditsMode('set')
    setCreditsAmount(0)

    // Tab 2 (Plugins)
    setSelectedUserForPlugins(user)
    let allowedPlugs = []
    if (user.allowedPlugins) {
      try {
        allowedPlugs = JSON.parse(user.allowedPlugins)
      } catch (e) {
        allowedPlugs = []
      }
    } else {
      allowedPlugs = (plugins || []).map(p => p.key)
    }
    setSelectedAllowedPlugins(allowedPlugs)

    // Tab 3 (Alerts)
    setSelectedUserForAlerts(user)
    let allowedAl = []
    if (user.allowedAlerts) {
      try {
        allowedAl = JSON.parse(user.allowedAlerts)
      } catch (e) {
        allowedAl = []
      }
    } else {
      allowedAl = ['incomingMe', 'incomingAlliance', 'outgoingMe', 'outgoingAlliance', 'chat', 'fortress', 'errors', 'system']
    }
    setSelectedAllowedAlerts(allowedAl)

    // Reset active tab to 0
    setManageTab(0)
    
    // Open Dialog
    setEditProfileDialogOpen(true)
  }

  const handleSaveProfile = () => {
    setEditProfileStatus({ type: '', message: '' })

    if (!editUsername) {
      setEditProfileStatus({ type: 'error', message: __('fillAllFields') || 'Username is required.' })
      return
    }

    if (editPassword && editPassword.length < 6) {
      setEditProfileStatus({ type: 'error', message: __('passwordTooShort') || 'Password must be at least 6 characters long.' })
      return
    }

    ws.send(JSON.stringify([
      ErrorType.Success,
      36, // ActionType.AdminUpdateUserProfile
      {
        targetUuid: selectedUserForEdit.uuid,
        username: editUsername,
        password: editPassword || null,
        email: editEmail || null
      }
    ]))
  }

  const handleLimitChange = (targetUuid, value) => {
    const limit = parseInt(value, 10)
    if (!isNaN(limit)) {
      ws.send(JSON.stringify([
        ErrorType.Success,
        ActionType.AdminUpdateUserLimit,
        { targetUuid, limit: Math.max(1, limit) }
      ]))
    }
  }

  const formatUptime = (seconds) => {
    if (!seconds) return '0s'
    const d = Math.floor(seconds / (3600 * 24))
    const h = Math.floor((seconds % (3600 * 24)) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)

    const dDisplay = d > 0 ? `${d}d ` : ""
    const hDisplay = h > 0 ? `${h}h ` : ""
    const mDisplay = m > 0 ? `${m}m ` : ""
    const sDisplay = s > 0 ? `${s}s` : ""
    return dDisplay + hDisplay + mDisplay + sDisplay
  }

  const handleCreditRequestAction = (requestId, status) => {
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AdminHandleCreditRequest,
      { requestId, status }
    ]))
  }

  const handleCreatePromoCode = (e) => {
    e.preventDefault()
    if (!promoCodeInput.trim() || !promoCreditsInput || !promoPriceInput) return
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AdminManagePromoCodes,
      {
        action: 'create',
        code: promoCodeInput.trim(),
        creditAmount: Number(promoCreditsInput),
        price: Number(promoPriceInput),
        maxUses: promoMaxUsesInput ? Number(promoMaxUsesInput) : null,
        expiryDate: promoExpiryInput ? promoExpiryInput : null
      }
    ]))
    setPromoCodeInput('')
    setPromoMaxUsesInput('')
    setPromoExpiryInput('')
  }

  const handleDeletePromoCode = (code) => {
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AdminManagePromoCodes,
      { action: 'delete', code }
    ]))
  }

  const handleSaveAdminSettings = (isTest = false) => {
    setAdminSettingsStatus({ type: '', message: '' })
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AdminSaveSystemSettings,
      {
        adminTelegramEnabled,
        adminTelegramToken,
        adminTelegramChatId,
        isTest
      }
    ]))
  }

  const handleBanEmail = (e) => {
    e.preventDefault()
    if (!newBannedEmail.trim()) return
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AdminBanEmail,
      { email: newBannedEmail.trim() }
    ]))
    setNewBannedEmail('')
  }

  const handleUnbanEmail = (email) => {
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AdminUnbanEmail,
      { email }
    ]))
  }

    return (
    <Box sx={{ width: '100%' }}>
      <Box className="premium-glass-card border-glow-blue" sx={{ p: 2.5, mb: 3 }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={7}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {__('adminPanel')}
            </Typography>
            <Typography sx={{ color: 'var(--text-2)', fontSize: 13, mt: 0.5 }}>
              {__('adminDashboardSubtitle') || 'Monitor performance and manage users.'}
            </Typography>
          </Grid>
          <Grid item xs={12} md={5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="medium"
              onClick={() => {
                ws.send(JSON.stringify([ErrorType.Success, ActionType.AdminGetSentNotifications, {}]))
                setHistoryDialogOpen(true)
              }}
              startIcon={<Bell size={16} />}
              sx={{ fontWeight: 700, borderColor: '#00bda6', color: '#00bda6', '&:hover': { borderColor: '#009d87', background: 'rgba(0, 189, 166, 0.08)' } }}
            >
              {__('sentHistory') || 'Sent History'}
            </Button>
            <Button
              variant="contained"
              color="info"
              size="medium"
              onClick={() => {
                setNotificationTarget('all')
                setNotificationMessage('')
                setNotificationStatus({ type: '', message: '' })
                setNotificationDialogOpen(true)
              }}
              startIcon={<Bell size={16} />}
              sx={{ fontWeight: 700, background: '#2563eb', '&:hover': { background: '#1d4ed8' } }}
            >
              {__('broadcastNotification') || 'Broadcast Notification'}
            </Button>
            <Button
              variant="contained"
              color="error"
              size="medium"
              onClick={() => setKillAllConfirmOpen(true)}
              sx={{ fontWeight: 700, background: '#cc3b54', '&:hover': { background: '#b73148' } }}
            >
              {__('killAllActiveBots')}
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Metrics Section */}
      <div className="metrics-grid">
        {/* CPU Usage */}
        <div className="metric-card premium-glass-card border-glow-gold" style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center', minHeight: '96px', padding: '12px 16px' }}>
          <div style={{ p: 1.5, borderRadius: '10px', background: 'rgba(255, 215, 0, 0.08)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px' }}>
            <Cpu size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="title" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>{__('cpuUsage') || 'CPU Usage'}</div>
            <div className="value" style={{ fontSize: '22px', fontWeight: 800, margin: '2px 0' }}>{stats ? `${stats.cpuUsagePercent}%` : '...'}</div>
            <div className="metric-progress" style={{ marginTop: '4px' }}><span style={{ width: `${Math.max(0, Math.min(100, stats?.cpuUsagePercent ?? 0))}%` }} /></div>
            <div className="subtext" style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={stats ? `${stats.cpuModel} (${stats.cpuCores} Cores)` : ''}>{stats ? `${stats.cpuModel}` : 'Loading...'}</div>
          </div>
        </div>

        {/* RAM Usage */}
        <div className="metric-card premium-glass-card border-glow-blue" style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center', minHeight: '96px', padding: '12px 16px' }}>
          <div style={{ p: 1.5, borderRadius: '10px', background: 'rgba(90, 180, 220, 0.08)', color: 'var(--brand-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px' }}>
            <Activity size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="title" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>{__('ramUsage') || 'RAM Usage'}</div>
            <div className="value" style={{ fontSize: '22px', fontWeight: 800, margin: '2px 0' }}>{stats ? `${stats.ramUsagePercent}%` : '...'}</div>
            <div className="metric-progress" style={{ marginTop: '4px' }}><span style={{ width: `${Math.max(0, Math.min(100, stats?.ramUsagePercent ?? 0))}%` }} /></div>
            <div className="subtext" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stats ? `${stats.ramUsed} GB / ${stats.ramTotal} GB` : 'Loading...'}</div>
          </div>
        </div>

        {/* VPS Uptime */}
        <div className="metric-card premium-glass-card border-glow-rose" style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center', minHeight: '96px', padding: '12px 16px' }}>
          <div style={{ p: 1.5, borderRadius: '10px', background: 'rgba(244, 63, 94, 0.08)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px' }}>
            <Server size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="title" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>{__('vpsUptime') || 'VPS Uptime'}</div>
            <div className="value" style={{ fontSize: '22px', fontWeight: 800, margin: '2px 0' }}>{stats ? formatUptime(stats.uptime) : '...'}</div>
            <div className="metric-progress" style={{ marginTop: '4px' }}><span style={{ width: `${stats ? Math.min(100, Math.max(8, (stats.uptime / 86400) * 10)) : 8}%` }} /></div>
            <div className="subtext" style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={stats ? stats.os : ''}>{stats ? stats.os : 'Loading...'}</div>
          </div>
        </div>

        {/* Bot Accounts */}
        <div className="metric-card premium-glass-card border-glow-green" style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center', minHeight: '96px', padding: '12px 16px' }}>
          <div style={{ p: 1.5, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px' }}>
            <Users size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="title" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>{__('botInstances') || 'Bot Accounts'}</div>
            <div className="value" style={{ fontSize: '22px', fontWeight: 800, margin: '2px 0' }}>{`${activeBots} / ${totalBots}`}</div>
            <div className="metric-progress" style={{ marginTop: '4px' }}><span style={{ width: `${totalBots > 0 ? Math.max(0, Math.min(100, (activeBots / totalBots) * 100)) : 0}%` }} /></div>
            <div className="subtext" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{__('runningTotalBots') || 'Active / Total Game Sessions'}</div>
          </div>
        </div>
      </div>

      {/* Admin Panel Sections Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)', mb: 3.5, mt: 1 }}>
        <Tabs 
          value={adminSectionTab} 
          onChange={(e, newVal) => setAdminSectionTab(newVal)} 
          textColor="inherit"
          indicatorColor="primary"
          sx={{
            '& .MuiTabs-indicator': { bgcolor: '#00bda6' },
            '& .MuiTab-root': { fontWeight: 800, fontSize: '13.5px', textTransform: 'none', minWidth: 120 },
            '& .Mui-selected': { color: '#00bda6 !important' }
          }}
        >
          <Tab label={__('userManagement') || 'Dashboard Users'} />
          <Tab label={__('creditRequests') || 'Credit Requests'} />
          <Tab label={__('promoCodes') || 'Promo Codes'} />
          <Tab label={__('adminSettings') || 'Admin Settings'} />
          <Tab label={__('bannedEmails') || 'Banned Emails'} />
          <Tab label={__('ipManagement') || 'IP Management'} />
        </Tabs>
      </Box>

      {adminSectionTab === 0 && (
        <Grid container spacing={2.2}>
          {/* User Management Table */}
          <Grid item xs={12}>
            <Paper className="premium-glass-card border-glow-blue" sx={{ p: 3, height: '100%' }} elevation={0}>
              <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Users size={20} style={{ color: '#00bda6' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {__('userManagement') || 'Dashboard Users'}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => {
                    setFormStatus({ type: '', message: '' })
                    setNewUsername('')
                    setNewPassword('')
                    setCreateUserDialogOpen(true)
                  }}
                  startIcon={<Plus size={16} />}
                  sx={{
                    background: 'linear-gradient(135deg, #00bda6 0%, #009d87 100%) !important',
                    fontWeight: 700,
                    fontSize: '12px'
                  }}
                >
                  {__('addNewUser') || 'Add New User'}
                </Button>
              </Box>
              <TableContainer sx={{ border: 'none', background: 'transparent' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell align="left">{__('username') || 'Username'}</TableCell>
                      <TableCell align="left">{__('gameEmail') || 'Game Email'}</TableCell>
                      <TableCell align="left">{__('role') || 'Role'}</TableCell>
                      <TableCell align="left">{__('credits') || 'Credits'}</TableCell>
                      <TableCell align="left">{__('subscriptionExpiry') || 'Expiry'}</TableCell>
                      <TableCell align="left">{__('gameAccountsLimit') || 'Accounts Limit'}</TableCell>
                      <TableCell align="right">{__('actions') || 'Actions'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((u) => {
                      const isSelf = profile && u.username === profile.username
                      const isBanned = bannedEmails.some(b => b.email.toLowerCase() === u.username.toLowerCase()) || 
                                       (u.gameEmails && u.gameEmails.split(', ').some(email => bannedEmails.some(b => b.email.toLowerCase() === email.toLowerCase())))
                      return (
                        <TableRow key={u.uuid} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell align="left" sx={{ fontWeight: 600 }}>
                            {u.username}
                            {isBanned && (
                              <span style={{
                                marginLeft: '8px',
                                marginRight: '8px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 800,
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#ff6b6b',
                                border: '1px solid rgba(239, 68, 68, 0.25)'
                              }}>
                                {__('banned') || 'BANNED'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell align="left" sx={{ fontSize: '12px', color: 'var(--text-2, #9ca3af)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.gameEmails}>
                            {u.gameEmails || 'None'}
                          </TableCell>
                          <TableCell align="left">
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: u.privilege === 1 ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              color: u.privilege === 1 ? '#a78bfa' : '#9ca3af',
                              border: u.privilege === 1 ? '1px solid rgba(139, 92, 246, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                              {u.privilege === 1 ? (__('administrator') || 'Admin') : (__('standardUser') || 'User')}
                            </span>
                          </TableCell>
                          <TableCell align="left" sx={{ fontWeight: 800, color: '#ffd700' }}>
                            {u.credits || 0}
                          </TableCell>
                          <TableCell align="left" sx={{ fontSize: '12.5px', color: '#e5e7eb' }}>
                            {u.subscriptionExpiry || 'No Expiry'}
                          </TableCell>
                          <TableCell align="left" sx={{ fontWeight: 600 }}>
                            {u.gameAccountsCount || 0} / {u.maxGameAccounts !== undefined ? u.maxGameAccounts : 1}
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', gap: 0.6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {u.privilege !== 1 && (
                                <>
                                  <Tooltip title={__('killUserBots') || 'Kill User Bots'} arrow>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      onClick={() => {
                                        setUserToKillBots(u)
                                        setKillUserConfirmOpen(true)
                                      }}
                                      sx={{ p: '6px', minWidth: 'auto', borderRadius: '6px', borderColor: 'rgba(248, 113, 113, 0.3)', color: '#f87171', '&:hover': { borderColor: '#f87171', background: 'rgba(248, 113, 113, 0.08)' } }}
                                    >
                                      <Power size={14} />
                                    </Button>
                                  </Tooltip>
                                  {isBanned ? (
                                    <Tooltip title={__('unbanUser') || 'Unban User'} arrow>
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => {
                                          const confirmMsg = document.documentElement.dir === 'rtl'
                                            ? `هل أنت متأكد من رغبتك في إلغاء حظر المستخدم ${u.username} وجميع حساباته؟`
                                            : `Are you sure you want to unban user ${u.username} and all associated game accounts?`;
                                          if (window.confirm(confirmMsg)) {
                                            ws.send(JSON.stringify([
                                              ErrorType.Success,
                                              ActionType.AdminUnbanEmail,
                                              { email: u.username }
                                            ]));
                                            if (u.gameEmails) {
                                              u.gameEmails.split(', ').forEach(email => {
                                                ws.send(JSON.stringify([
                                                  ErrorType.Success,
                                                  ActionType.AdminUnbanEmail,
                                                  { email }
                                                ]));
                                              });
                                            }
                                          }
                                        }}
                                        sx={{ p: '6px', minWidth: 'auto', borderRadius: '6px', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981', '&:hover': { borderColor: '#10b981', background: 'rgba(16, 185, 129, 0.08)' } }}
                                      >
                                        <Ban size={14} />
                                      </Button>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip title={__('banUser') || 'Ban User'} arrow>
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => {
                                          const confirmMsg = document.documentElement.dir === 'rtl'
                                            ? `هل أنت متأكد من رغبتك في حظر المستخدم ${u.username} وجميع حساباته؟`
                                            : `Are you sure you want to ban user ${u.username} and all associated game accounts?`;
                                          if (window.confirm(confirmMsg)) {
                                            ws.send(JSON.stringify([
                                              ErrorType.Success,
                                              ActionType.AdminBanEmail,
                                              { email: u.username }
                                            ]));
                                            if (u.gameEmails) {
                                              u.gameEmails.split(', ').forEach(email => {
                                                ws.send(JSON.stringify([
                                                  ErrorType.Success,
                                                  ActionType.AdminBanEmail,
                                                  { email }
                                                ]));
                                              });
                                            }
                                          }
                                        }}
                                        sx={{ p: '6px', minWidth: 'auto', borderRadius: '6px', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ff6b6b', '&:hover': { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' } }}
                                      >
                                        <Ban size={14} />
                                      </Button>
                                    </Tooltip>
                                  )}
                                </>
                              )}
                              <Tooltip title={__('editUserProfile') || 'Edit Profile'} arrow>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => openEditProfileDialog(u)}
                                  sx={{ p: '6px', minWidth: 'auto', borderRadius: '6px', borderColor: 'rgba(0, 189, 166, 0.3)', color: '#00bda6', '&:hover': { borderColor: '#00bda6', background: 'rgba(0, 189, 166, 0.08)' } }}
                                >
                                  <Edit size={14} />
                                </Button>
                              </Tooltip>
                              <Tooltip title={__('sendNotification') || 'Send Notification'} arrow>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => {
                                    setNotificationTarget(u.uuid)
                                    setNotificationMessage('')
                                    setNotificationStatus({ type: '', message: '' })
                                    setNotificationDialogOpen(true)
                                  }}
                                  sx={{ p: '6px', minWidth: 'auto', borderRadius: '6px', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#3b82f6', '&:hover': { borderColor: '#3b82f6', background: 'rgba(59, 130, 246, 0.08)' } }}
                                >
                                  <Bell size={14} />
                                </Button>
                              </Tooltip>
                              <Tooltip title={__('deleteUser') || 'Delete User'} arrow>
                                <span>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    color="error"
                                    disabled={isSelf}
                                    onClick={() => openDeleteConfirm(u)}
                                    sx={{ p: '6px', minWidth: 'auto', borderRadius: '6px', borderColor: isSelf ? 'rgba(255, 255, 255, 0.1)' : 'rgba(239, 68, 68, 0.3)', color: isSelf ? 'rgba(255, 255, 255, 0.2)' : '#ff6b6b', '&:hover': { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' } }}
                                  >
                                    <Trash size={14} />
                                  </Button>
                                </span>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {adminSectionTab === 1 && (
        <Grid container spacing={2.2}>
          {/* Credit Requests Table */}
          <Grid item xs={12}>
            <Paper className="premium-glass-card border-glow-blue" sx={{ p: 3, height: '100%' }} elevation={0}>
              <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Activity size={20} style={{ color: '#ffd700' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {__('creditRequests') || 'Credit Purchase Requests'}
                </Typography>
              </Box>
              <TableContainer sx={{ border: 'none', background: 'transparent' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell align="left">ID</TableCell>
                      <TableCell align="left">{__('username') || 'Username'}</TableCell>
                      <TableCell align="left">{__('credits') || 'Credits'}</TableCell>
                      <TableCell align="left">{__('price') || 'Price (EGP)'}</TableCell>
                      <TableCell align="left">{__('senderNumber') || 'Sender Number'}</TableCell>
                      <TableCell align="left">{__('promoCode') || 'Promo Code'}</TableCell>
                      <TableCell align="left">{__('screenshot') || 'Receipt'}</TableCell>
                      <TableCell align="left">{__('status') || 'Status'}</TableCell>
                      <TableCell align="left">{__('createdAt') || 'Date'}</TableCell>
                      <TableCell align="right">{__('actions') || 'Actions'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {creditRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} align="center" sx={{ py: 3, color: 'var(--text-secondary)' }}>
                          {__('noCreditRequests') || 'No credit requests found.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      creditRequests.map((req) => (
                        <TableRow key={req.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell align="left">{req.id}</TableCell>
                          <TableCell align="left" sx={{ fontWeight: 600 }}>{req.username || 'Unknown'}</TableCell>
                          <TableCell align="left" sx={{ fontWeight: 800, color: '#ffd700' }}>{req.amount}</TableCell>
                          <TableCell align="left">{req.pricePaid} EGP</TableCell>
                          <TableCell align="left">{req.senderNumber}</TableCell>
                          <TableCell align="left">{req.promoCode || '-'}</TableCell>
                          <TableCell align="left">
                            <Button 
                              size="small" 
                              variant="outlined" 
                              onClick={() => {
                                setViewScreenshotUrl(req.screenshotPath)
                                setScreenshotDialogOpen(true)
                              }}
                              sx={{ borderColor: '#00bda6', color: '#00bda6', fontSize: '11px', py: 0.5 }}
                            >
                              {__('viewReceipt') || 'View'}
                            </Button>
                          </TableCell>
                          <TableCell align="left">
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: req.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : (req.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                              color: req.status === 'approved' ? '#10b981' : (req.status === 'rejected' ? '#f87171' : '#f59e0b'),
                              border: req.status === 'approved' ? '1px solid rgba(16, 185, 129, 0.25)' : (req.status === 'rejected' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)')
                            }}>
                              {req.status.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell align="left" sx={{ fontSize: '12px' }}>
                            {new Date(req.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell align="right">
                            {req.status === 'pending' ? (
                              <Box sx={{ display: 'flex', gap: 0.6, justifyContent: 'flex-end' }}>
                                <Button 
                                  size="small" 
                                  variant="contained" 
                                  color="success"
                                  onClick={() => handleCreditRequestAction(req.id, 'approved')}
                                  sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#10b981 !important' }}
                                >
                                  {__('approve') || 'Approve'}
                                </Button>
                                <Button 
                                  size="small" 
                                  variant="outlined" 
                                  color="error"
                                  onClick={() => handleCreditRequestAction(req.id, 'rejected')}
                                  sx={{ fontWeight: 700, fontSize: '11px' }}
                                >
                                  {__('reject') || 'Reject'}
                                </Button>
                              </Box>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {adminSectionTab === 2 && (
        <Grid container spacing={3}>
          {/* Create Promo Code form */}
          <Grid item xs={12} md={4}>
            <Paper className="premium-glass-card border-glow-blue" sx={{ p: 3 }} elevation={0}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                {__('createPromoCode') || 'New Promo Code'}
              </Typography>
              <form onSubmit={handleCreatePromoCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TextField
                  label={__('promoCode') || 'Promo Code'}
                  variant="outlined"
                  size="small"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label={__('creditsAmount') || 'Credit Amount'}
                  type="number"
                  variant="outlined"
                  size="small"
                  value={promoCreditsInput}
                  onChange={(e) => setPromoCreditsInput(Math.max(1, parseInt(e.target.value) || 0))}
                  required
                  fullWidth
                />
                <TextField
                  label={__('priceEgp') || 'Price (EGP)'}
                  type="number"
                  variant="outlined"
                  size="small"
                  value={promoPriceInput}
                  onChange={(e) => setPromoPriceInput(Math.max(0, parseInt(e.target.value) || 0))}
                  required
                  fullWidth
                />
                <TextField
                  label={__('maxUses') || 'Max Uses Limit'}
                  type="number"
                  variant="outlined"
                  size="small"
                  value={promoMaxUsesInput}
                  onChange={(e) => setPromoMaxUsesInput(e.target.value)}
                  fullWidth
                  placeholder={__('unlimited') || 'Unlimited'}
                  helperText={document.documentElement.dir === 'rtl' ? 'اتركه فارغاً للاستخدام غير المحدود' : 'Leave empty for unlimited'}
                />
                <TextField
                  label={__('expiryDate') || 'Expiry Date'}
                  type="date"
                  variant="outlined"
                  size="small"
                  value={promoExpiryInput}
                  onChange={(e) => setPromoExpiryInput(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    background: 'linear-gradient(135deg, #00bda6 0%, #009d87 100%) !important',
                    fontWeight: 700,
                    mt: 1
                  }}
                  fullWidth
                >
                  {__('createCode') || 'Create Promo Code'}
                </Button>
              </form>
            </Paper>
          </Grid>

          {/* Promo Codes list */}
          <Grid item xs={12} md={8}>
            <Paper className="premium-glass-card border-glow-blue" sx={{ p: 3, height: '100%' }} elevation={0}>
              <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Star size={20} style={{ color: '#00bda6' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {__('promoCodes') || 'Promo Codes'}
                </Typography>
              </Box>
              <TableContainer sx={{ border: 'none', background: 'transparent' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell align="left">{__('promoCode') || 'Code'}</TableCell>
                      <TableCell align="left">{__('creditsAmount') || 'Credit Amount'}</TableCell>
                      <TableCell align="left">{__('price') || 'Price (EGP)'}</TableCell>
                      <TableCell align="left">{__('usages') || 'Usages'}</TableCell>
                      <TableCell align="left">{__('expiryDate') || 'Expiry Date'}</TableCell>
                      <TableCell align="left">{__('status') || 'Status'}</TableCell>
                      <TableCell align="right">{__('actions') || 'Actions'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {promoCodes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'var(--text-secondary)' }}>
                          {__('noPromoCodes') || 'No promo codes found.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      promoCodes.map((code) => {
                        const isExpired = code.expiryDate && new Date(code.expiryDate).getTime() + 86400000 < Date.now()
                        const limitReached = code.maxUses !== null && code.maxUses !== undefined && code.maxUses > 0 && (code.usedCount || 0) >= code.maxUses
                        const isInactive = !code.active || isExpired || limitReached
                        
                        return (
                          <TableRow key={code.code} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                            <TableCell align="left" sx={{ fontWeight: 850, letterSpacing: 0.5, color: '#00bda6' }}>
                              {code.code}
                            </TableCell>
                            <TableCell align="left" sx={{ fontWeight: 800, color: '#ffd700' }}>
                              {code.creditAmount} Credits
                            </TableCell>
                            <TableCell align="left">{code.price} EGP</TableCell>
                            <TableCell align="left">
                              {code.usedCount || 0} / {code.maxUses !== null && code.maxUses !== undefined && code.maxUses > 0 ? code.maxUses : '∞'}
                            </TableCell>
                            <TableCell align="left" sx={{ fontSize: '12px' }}>
                              {code.expiryDate || (document.documentElement.dir === 'rtl' ? 'غير محدد' : 'No Expiry')}
                            </TableCell>
                            <TableCell align="left">
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: !isInactive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: !isInactive ? '#10b981' : '#f87171',
                                border: !isInactive ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
                              }}>
                                {!isInactive ? 'ACTIVE' : (isExpired ? 'EXPIRED' : (limitReached ? 'LIMIT REACHED' : 'INACTIVE'))}
                              </span>
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title={__('deleteCode') || 'Delete Code'} arrow>
                                <Button 
                                  size="small" 
                                  variant="outlined" 
                                  color="error"
                                  onClick={() => handleDeletePromoCode(code.code)}
                                  sx={{ p: '6px', minWidth: 'auto', borderRadius: '6px' }}
                                >
                                  <Trash size={14} />
                                </Button>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {adminSectionTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper className="premium-glass-card border-glow-blue" sx={{ p: 3 }} elevation={0}>
              <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Bell size={20} style={{ color: '#00bda6' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {__('adminTelegramNotifications') || 'Admin Telegram Notifications'}
                </Typography>
              </Box>

              {adminSettingsStatus.message && (
                <Box 
                  className={`form-alert ${adminSettingsStatus.type === 'success' ? 'success' : 'error'}`} 
                  sx={{ 
                    mb: 3, 
                    p: 1.5, 
                    borderRadius: '8px', 
                    fontSize: '13px',
                    fontWeight: 600,
                    backgroundColor: adminSettingsStatus.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: adminSettingsStatus.type === 'success' ? '#10b981' : '#f87171',
                    border: adminSettingsStatus.type === 'success' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
                  }}
                >
                  {adminSettingsStatus.message}
                </Box>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={adminTelegramEnabled}
                      onChange={(e) => setAdminTelegramEnabled(e.target.checked)}
                      sx={{
                        color: '#00bda6',
                        '&.Mui-checked': {
                          color: '#00bda6',
                        },
                      }}
                    />
                  }
                  label={__('adminTelegramEnabled') || 'Enable Telegram Notifications'}
                  sx={{
                    '& .MuiFormControlLabel-label': {
                      fontWeight: 700,
                      fontSize: '14px'
                    }
                  }}
                />

                <TextField
                  label={__('adminTelegramToken') || 'Telegram Bot Token'}
                  type="password"
                  variant="outlined"
                  size="small"
                  value={adminTelegramToken}
                  onChange={(e) => setAdminTelegramToken(e.target.value)}
                  fullWidth
                  disabled={!adminTelegramEnabled}
                />

                <TextField
                  label={__('adminTelegramChatId') || 'Telegram Chat ID'}
                  variant="outlined"
                  size="small"
                  value={adminTelegramChatId}
                  onChange={(e) => setAdminTelegramChatId(e.target.value)}
                  fullWidth
                  disabled={!adminTelegramEnabled}
                />

                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Button
                    variant="contained"
                    onClick={() => handleSaveAdminSettings(false)}
                    sx={{
                      background: 'linear-gradient(135deg, #00bda6 0%, #009d87 100%) !important',
                      fontWeight: 700,
                      flex: 1
                    }}
                  >
                    {__('saveAdminSettings') || 'Save Settings'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    disabled={!adminTelegramEnabled || !adminTelegramToken || !adminTelegramChatId}
                    onClick={() => handleSaveAdminSettings(true)}
                    sx={{
                      borderColor: '#00bda6',
                      color: '#00bda6',
                      fontWeight: 700,
                      flex: 1,
                      '&:hover': {
                        borderColor: '#009d87',
                        background: 'rgba(0, 189, 166, 0.05)'
                      }
                    }}
                  >
                    {__('sendTestMessage') || 'Send Test Message'}
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {adminSectionTab === 4 && (
        <Grid container spacing={3}>
          {/* Ban new email form */}
          <Grid item xs={12} md={4}>
            <Paper className="premium-glass-card border-glow-blue" sx={{ p: 3 }} elevation={0}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                {__('banNewEmail') || 'Ban New Email'}
              </Typography>
              <form onSubmit={handleBanEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TextField
                  label={__('emailOrUsername') || 'Email or Username'}
                  variant="outlined"
                  size="small"
                  value={newBannedEmail}
                  onChange={(e) => setNewBannedEmail(e.target.value)}
                  required
                  fullWidth
                  placeholder="example@gmail.com"
                />
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    background: 'linear-gradient(135deg, #cc3b54 0%, #b73148 100%) !important',
                    fontWeight: 700,
                    mt: 1
                  }}
                  fullWidth
                >
                  {__('banEmail') || 'Ban Email'}
                </Button>
              </form>
            </Paper>
          </Grid>

          {/* Banned Emails list */}
          <Grid item xs={12} md={8}>
            <Paper className="premium-glass-card border-glow-blue" sx={{ p: 3, height: '100%' }} elevation={0}>
              <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Ban size={20} style={{ color: '#f87171' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {__('bannedEmails') || 'Banned Emails'}
                </Typography>
              </Box>
              <TableContainer sx={{ border: 'none', background: 'transparent' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell align="left">{__('email') || 'Email/Username'}</TableCell>
                      <TableCell align="left">{__('bannedAt') || 'Banned At'}</TableCell>
                      <TableCell align="right">{__('actions') || 'Actions'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bannedEmails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'var(--text-secondary)' }}>
                          {__('noBannedEmails') || 'No banned emails found.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      bannedEmails.map((item) => (
                        <TableRow key={item.email} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell align="left" sx={{ fontWeight: 700, color: '#f87171' }}>
                            {item.email}
                          </TableCell>
                          <TableCell align="left" sx={{ fontSize: '12.5px' }}>
                            {new Date(item.bannedAt).toLocaleString(window.getLang && window.getLang() === 'ar' ? 'ar-EG' : 'en-US')}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title={__('unban') || 'Unban'} arrow>
                              <Button 
                                size="small" 
                                variant="outlined" 
                                color="success"
                                onClick={() => handleUnbanEmail(item.email)}
                                sx={{ p: '6px', minWidth: 'auto', borderRadius: '6px', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981', '&:hover': { borderColor: '#10b981', background: 'rgba(16, 185, 129, 0.08)' } }}
                              >
                                {__('unban') || 'Unban'}
                              </Button>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {adminSectionTab === 5 && (
        <Grid container spacing={3}>
          {/* Permanent IP Ban Form */}
          <Grid item xs={12} md={4}>
            <Paper className="premium-glass-card border-glow-rose" sx={{ p: 3, mb: 3 }} elevation={0}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Ban size={18} style={{ color: '#f87171' }} />
                {__('banNewIp') || 'Ban New IP Address'}
              </Typography>
              <form onSubmit={handleBanIP} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TextField
                  label={__('ipAddress') || 'IP Address'}
                  variant="outlined"
                  size="small"
                  value={newBannedIP}
                  onChange={(e) => setNewBannedIP(e.target.value)}
                  placeholder="e.g. 192.168.1.10"
                  required
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    background: 'linear-gradient(135deg, #cc3b54 0%, #b73148 100%) !important',
                    fontWeight: 700,
                    mt: 1
                  }}
                  fullWidth
                >
                  {__('banIp') || 'Ban IP'}
                </Button>
              </form>
            </Paper>

            {/* Helper Context/Instructions */}
            <Paper className="premium-glass-card border-glow-blue" sx={{ p: 3 }} elevation={0}>
              <Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 1, color: '#60a5fa' }}>
                💡 {__('ipManagementInstructions') || 'IP Protection Guide'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-muted)', fontSize: '12.5px', lineHeight: 1.6 }}>
                {__('ipProtectionExplanation') || 
                  'Here you can manage IP bans. Permanent bans block all REST APIs, authentication endpoints, and WebSocket connections immediately. Temporary blocks are auto-triggered by the security system on brute-force attempts or spam accounts, and reset after 1 hour unless cleared by you.'}
              </Typography>
            </Paper>
          </Grid>

          {/* Banned & Blocked lists */}
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              {/* Temporary rate-limited/blocked IPs list */}
              <Paper className="premium-glass-card border-glow-gold" sx={{ p: 3 }} elevation={0}>
                <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Activity size={20} style={{ color: '#fbbf24' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {__('temporarilyBlockedIps') || 'Temporarily Blocked IPs (Security Alerts)'}
                  </Typography>
                </Box>
                <TableContainer sx={{ border: 'none', background: 'transparent' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell align="left">{__('ipAddress') || 'IP Address'}</TableCell>
                        <TableCell align="left">{__('actionType') || 'Trigger Type'}</TableCell>
                        <TableCell align="left">{__('triggerCount') || 'Count / Limit'}</TableCell>
                        <TableCell align="left">{__('resetsIn') || 'Resets In'}</TableCell>
                        <TableCell align="right">{__('actions') || 'Actions'}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {blockedIPs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'var(--text-secondary)' }}>
                            {__('noTemporarilyBlockedIps') || 'No active rate limits or temporary blocks found.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        blockedIPs.map((item) => {
                          const remainingMs = item.resetAt - Date.now()
                          const remainingMins = Math.max(1, Math.ceil(remainingMs / 60000))
                          return (
                            <TableRow key={`${item.ip}-${item.type}`} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                              <TableCell align="left" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                {item.ip}
                              </TableCell>
                              <TableCell align="left">
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: item.type === 'login' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                  color: item.type === 'login' ? '#f87171' : '#34d399'
                                }}>
                                  {item.type.toUpperCase()}
                                </span>
                              </TableCell>
                              <TableCell align="left" sx={{ fontWeight: 600 }}>
                                <span style={{ color: item.blocked ? '#f87171' : 'var(--text-primary)' }}>
                                  {item.count} / {item.max}
                                </span>
                                {item.blocked && (
                                  <span style={{ fontSize: '10px', color: '#f87171', fontWeight: 800, marginLeft: '6px' }}>
                                    (BLOCKED)
                                  </span>
                                )}
                              </TableCell>
                              <TableCell align="left" sx={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                                {remainingMins} min{remainingMins > 1 ? 's' : ''}
                              </TableCell>
                              <TableCell align="right">
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                  <Button 
                                    size="small" 
                                    variant="outlined" 
                                    color="success"
                                    onClick={() => handleClearBlockedIP(item.ip, item.type)}
                                    sx={{ fontSize: '11px', py: 0.5 }}
                                  >
                                    {__('clearBlock') || 'Clear Block'}
                                  </Button>
                                  <Button 
                                    size="small" 
                                    variant="contained" 
                                    color="error"
                                    onClick={() => {
                                      ws.send(JSON.stringify([
                                        ErrorType.Success,
                                        ActionType.AdminBanIP,
                                        { ip: item.ip }
                                      ]))
                                    }}
                                    sx={{ fontSize: '11px', py: 0.5, bgcolor: '#ef4444 !important' }}
                                  >
                                    {__('permanentlyBan') || 'Ban IP'}
                                  </Button>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* Banned IPs list */}
              <Paper className="premium-glass-card border-glow-rose" sx={{ p: 3 }} elevation={0}>
                <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Ban size={20} style={{ color: '#f87171' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {__('permanentlyBannedIps') || 'Permanently Banned IPs'}
                  </Typography>
                </Box>
                <TableContainer sx={{ border: 'none', background: 'transparent' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell align="left">{__('ipAddress') || 'IP Address'}</TableCell>
                        <TableCell align="left">{__('bannedAt') || 'Banned At'}</TableCell>
                        <TableCell align="right">{__('actions') || 'Actions'}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bannedIPs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'var(--text-secondary)' }}>
                            {__('noBannedIps') || 'No permanently banned IPs found.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        bannedIPs.map((item) => (
                          <TableRow key={item.ip} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                            <TableCell align="left" sx={{ fontWeight: 700, color: '#f87171', fontFamily: 'monospace' }}>
                              {item.ip}
                            </TableCell>
                            <TableCell align="left" sx={{ fontSize: '12.5px' }}>
                              {new Date(item.bannedAt).toLocaleString(window.getLang && window.getLang() === 'ar' ? 'ar-EG' : 'en-US')}
                            </TableCell>
                            <TableCell align="right">
                              <Button 
                                size="small" 
                                variant="outlined" 
                                color="success"
                                onClick={() => handleUnbanIP(item.ip)}
                                sx={{ fontSize: '11px', py: 0.5 }}
                              >
                                {__('unban') || 'Unban'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

            </Box>
          </Grid>
        </Grid>
      )}

      {/* Create New User Dialog */}
      <Dialog
        open={createUserDialogOpen}
        onClose={() => setCreateUserDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: 'premium-glass-card border-glow-green' }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5, color: '#10b981' }}>
          <UserPlus size={18} />
          {__('addNewUser') || 'Add New User'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          {formStatus.message && (
            <Box className={`form-alert ${formStatus.type}`} sx={{ mb: 1 }}>
              {formStatus.message}
            </Box>
          )}
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TextField
              fullWidth
              label={__('username') || 'Username'}
              variant="outlined"
              size="small"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
            <TextField
              fullWidth
              type="password"
              label={__('password') || 'Password'}
              variant="outlined"
              size="small"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <DialogActions sx={{ px: 0, pb: 0, pt: 1.5 }}>
              <Button onClick={() => setCreateUserDialogOpen(false)} variant="outlined">
                {__('cancel') || 'Cancel'}
              </Button>
              <Button type="submit" variant="contained" sx={{ fontWeight: 700 }}>
                {__('createUser') || 'Create Account'}
              </Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Profile Dialog (Unified Multi-Tab Dialog) */}
      <Dialog
        open={editProfileDialogOpen}
        onClose={() => setEditProfileDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ className: 'premium-glass-card border-glow-blue' }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5, color: '#00bda6', borderBottom: '1px solid var(--line)' }}>
          <Edit size={18} />
          {__('manageUser')?.replace('%s', selectedUserForEdit?.username || '') || `Manage User: ${selectedUserForEdit?.username || ''}`}
        </DialogTitle>
        <Tabs
          value={manageTab}
          onChange={(e, newValue) => setManageTab(newValue)}
          variant="fullWidth"
          sx={{
            borderBottom: '1px solid var(--line)',
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: '12.5px',
              color: 'var(--text-2)',
              fontFamily: 'Cairo, Outfit, sans-serif !important',
              '&.Mui-selected': {
                color: '#00bda6'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#00bda6'
            }
          }}
        >
          <Tab label={__('profileTab') || 'Profile'} />
          <Tab label={__('subscriptionTab') || 'Subscription'} />
          <Tab label={__('pluginsTab') || 'Plugins'} />
          <Tab label={__('alertsTab') || 'Alerts'} />
        </Tabs>
        <DialogContent sx={{ p: 2.5, minHeight: '320px' }}>
          {manageTab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
              {editProfileStatus.message && (
                <Box className={`form-alert ${editProfileStatus.type}`} sx={{ mb: 1 }}>
                  {editProfileStatus.message}
                </Box>
              )}
              <TextField
                fullWidth
                size="small"
                label={__('username') || 'Username'}
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
              />
              <TextField
                fullWidth
                size="small"
                type="password"
                label={__('resetPassword') || 'New Password (Reset)'}
                placeholder={__('leaveEmptyToKeep') || 'Leave empty to keep current'}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                helperText={__('passwordHelperText') || 'Must be at least 6 characters if specified'}
              />
              <TextField
                fullWidth
                size="small"
                label={__('gameEmail') || 'Game Email'}
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </Box>
          )}

          {manageTab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
              {/* Plan Type Selector */}
              <FormControl fullWidth size="small">
                <InputLabel id="sub-plan-label">{__('subscriptionPlan')}</InputLabel>
                <Select
                  labelId="sub-plan-label"
                  id="sub-plan-select"
                  value={subPlan}
                  label={__('subscriptionPlan')}
                  onChange={(e) => {
                    const plan = e.target.value
                    setSubPlan(plan)
                    if (plan === 'none') {
                      setSubLimit(1)
                      setSubExpiry('')
                      setSubAlliance('')
                    } else if (plan === 'trial') {
                      setSubLimit(1)
                      if (!subExpiry) {
                        const d = new Date()
                        d.setDate(d.getDate() + 30)
                        setSubExpiry(d.toISOString().split('T')[0])
                      }
                    } else if (plan === 'pro') {
                      setSubLimit(1)
                      if (!subExpiry) {
                        const d = new Date()
                        d.setDate(d.getDate() + 30)
                        setSubExpiry(d.toISOString().split('T')[0])
                      }
                    }
                  }}
                >
                  <MenuItem value="none">{__('noSubscription') || 'None (Inactive)'}</MenuItem>
                  <MenuItem value="trial">{__('trialPlan') || 'Trial'}</MenuItem>
                  <MenuItem value="pro">{__('proPlanName') || 'Pro'}</MenuItem>
                  <MenuItem value="enterprise">{__('enterprisePlanName') || 'Enterprise'}</MenuItem>
                </Select>
              </FormControl>

              {/* Max Accounts limit */}
              <TextField
                fullWidth
                size="small"
                type="number"
                label={__('gameAccountsLimit')}
                value={subLimit}
                onChange={(e) => setSubLimit(e.target.value)}
                inputProps={{ min: 1 }}
              />

              {/* Expiry Date input */}
              <TextField
                fullWidth
                size="small"
                type="date"
                label={__('subscriptionExpiry')}
                value={subExpiry}
                onChange={(e) => setSubExpiry(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />

              {/* Credits Management Section */}
              <Box sx={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', p: 1.8, background: 'rgba(255, 255, 255, 0.02)' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'var(--text-secondary)' }}>
                  💰 {__('creditsManagement') || 'Manage Credits'}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1.5, fontSize: '12.5px' }}>
                  {__('currentCredits') || 'Current Balance'}: <strong style={{ color: '#ffd700', fontSize: '14px' }}>{selectedUserForSubscription?.credits || 0}</strong>
                </Typography>
                
                <Grid container spacing={1.5}>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="credits-mode-label">{__('adjustmentMode') || 'Action'}</InputLabel>
                      <Select
                        labelId="credits-mode-label"
                        value={creditsMode}
                        label={__('adjustmentMode') || 'Action'}
                        onChange={(e) => setCreditsMode(e.target.value)}
                      >
                        <MenuItem value="set">{__('creditsSet') || 'Set To'}</MenuItem>
                        <MenuItem value="add">{__('creditsAdd') || 'Add (+)'}</MenuItem>
                        <MenuItem value="deduct">{__('creditsDeduct') || 'Deduct (-)'}</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label={__('amount') || 'Amount'}
                      value={creditsAmount}
                      onChange={(e) => setCreditsAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Alliance Name - only visible if enterprise */}
              {subPlan === 'enterprise' && (
                <TextField
                  fullWidth
                  size="small"
                  type="text"
                  label={__('subscriptionAlliance')}
                  value={subAlliance}
                  placeholder={__('alliancePlaceholder') || 'Example: Alliance name'}
                  onChange={(e) => setSubAlliance(e.target.value)}
                />
              )}
            </Box>
          )}

          {manageTab === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1, maxHeight: '320px', overflowY: 'auto' }}>
              {(plugins || []).map(p => (
                <FormControlLabel
                  key={p.key}
                  control={
                    <Checkbox
                      checked={selectedAllowedPlugins.includes(p.key)}
                      onChange={() => handleTogglePlugin(p.key)}
                    />
                  }
                  label={__(p.key) || p.key}
                />
              ))}
            </Box>
          )}

          {manageTab === 3 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1 }}>
              {[
                { key: 'incomingMe', label: __('alertIncomingMe') },
                { key: 'incomingAlliance', label: __('alertIncomingAlliance') },
                { key: 'outgoingMe', label: __('alertOutgoingMe') },
                { key: 'outgoingAlliance', label: __('alertOutgoingAlliance') },
                { key: 'chat', label: __('alertChat') },
                { key: 'fortress', label: __('alertFortress') },
                { key: 'errors', label: __('alertErrors') },
                { key: 'system', label: __('alertSystem') }
              ].map(a => (
                <FormControlLabel
                  key={a.key}
                  control={
                    <Checkbox
                      checked={selectedAllowedAlerts.includes(a.key)}
                      onChange={() => handleToggleAlert(a.key)}
                    />
                  }
                  label={a.label}
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid var(--line)', px: 3, py: 2 }}>
          <Button onClick={() => setEditProfileDialogOpen(false)} variant="outlined">
            {__('cancel') || 'Cancel'}
          </Button>
          <Button
            onClick={() => {
              if (manageTab === 0) handleSaveProfile();
              else if (manageTab === 1) handleSaveSubscription();
              else if (manageTab === 2) handleSavePlugins();
              else if (manageTab === 3) handleSaveAlerts();
            }}
            variant="contained"
            sx={{ fontWeight: 700 }}
          >
            {__('save') || 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        PaperProps={{ className: 'premium-glass-card' }}
      >
        <DialogTitle id="delete-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#ef4444', fontWeight: 800 }}>
          <Trash size={18} />
          {__('confirmDeleteTitle') || 'Delete Dashboard Account?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description" sx={{ color: 'var(--text-secondary)' }}>
            {__('confirmDeleteDescription') || `Are you sure you want to delete the user "${userToDelete?.username}"? This will permanently stop and delete all their active bot instances.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteConfirm} variant="outlined">
            {__('cancel') || 'Cancel'}
          </Button>
          <Button onClick={handleDeleteUser} variant="contained" color="error" autoFocus>
            {__('deleteUser') || 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Kill All Active Bots Dialog */}
      <Dialog
        open={killAllConfirmOpen}
        onClose={() => setKillAllConfirmOpen(false)}
        aria-labelledby="kill-all-dialog-title"
        aria-describedby="kill-all-dialog-description"
        PaperProps={{ className: 'premium-glass-card' }}
      >
        <DialogTitle id="kill-all-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#ef4444', fontWeight: 800 }}>
          <Power size={18} />
          {__('confirmKillAllTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="kill-all-dialog-description" sx={{ color: 'var(--text-secondary)' }}>
            {__('confirmKillAllDescription')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKillAllConfirmOpen(false)} variant="outlined">
            {__('cancel') || 'Cancel'}
          </Button>
          <Button onClick={handleKillAllBots} variant="contained" color="error" autoFocus>
            {__('killAllActiveBots')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Kill User Bots Dialog */}
      <Dialog
        open={killUserConfirmOpen}
        onClose={() => setKillUserConfirmOpen(false)}
        aria-labelledby="kill-user-dialog-title"
        aria-describedby="kill-user-dialog-description"
        PaperProps={{ className: 'premium-glass-card' }}
      >
        <DialogTitle id="kill-user-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#ef4444', fontWeight: 800 }}>
          <Power size={18} />
          {__('confirmKillUserTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="kill-user-dialog-description" sx={{ color: 'var(--text-secondary)' }}>
            {__('confirmKillUserDescription')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKillUserConfirmOpen(false)} variant="outlined">
            {__('cancel') || 'Cancel'}
          </Button>
          <Button onClick={handleKillUserBots} variant="contained" color="error" autoFocus>
            {__('killUserBots')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send Notification Dialog */}
      <Dialog
        open={notificationDialogOpen}
        onClose={() => setNotificationDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: 'premium-glass-card border-glow-blue' }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5, color: '#3b82f6' }}>
          <Bell size={18} />
          {notificationTarget === 'all' 
            ? (__('broadcastNotification') || 'Broadcast Notification') 
            : `${__('sendNotificationTo') || 'Send Notification To'}: ${users.find(usr => usr.uuid === notificationTarget)?.username || ''}`}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {notificationStatus.message && (
            <Box className={`form-alert ${notificationStatus.type}`} sx={{ mb: 1 }}>
              {notificationStatus.message}
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            rows={4}
            label={__('notificationMessage') || 'Notification Message'}
            variant="outlined"
            size="small"
            value={notificationMessage}
            onChange={(e) => setNotificationMessage(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotificationDialogOpen(false)} variant="outlined">
            {__('cancel') || 'Cancel'}
          </Button>
          <Button
            onClick={() => {
              if (!notificationMessage.trim()) {
                setNotificationStatus({ type: 'error', message: __('fillAllFields') || 'Please fill in all fields.' })
                return
              }
              ws.send(JSON.stringify([
                ErrorType.Success,
                ActionType.AdminSendNotification,
                { targetUuid: notificationTarget, message: notificationMessage }
              ]))
            }}
            variant="contained"
            sx={{ fontWeight: 700 }}
          >
            {__('sendNotification') || 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sent Notifications History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ className: 'premium-glass-card border-glow-blue' }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5, color: '#00bda6' }}>
          <Bell size={18} />
          {__('sentNotificationsHistory') || 'Sent Notifications History'}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2, maxHeight: '450px', overflowY: 'auto' }}>
          {sentNotifications.length === 0 ? (
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', py: 5 }}>
              {__('noSentNotifications') || 'No sent notifications yet.'}
            </Typography>
          ) : (
            <TableContainer sx={{ border: 'none', background: 'transparent' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="left">{__('recipient') || 'Recipient'}</TableCell>
                    <TableCell align="left">{__('message') || 'Message'}</TableCell>
                    <TableCell align="left">{__('date') || 'Date'}</TableCell>
                    <TableCell align="right">{__('action') || 'Action'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sentNotifications.map((n) => (
                    <TableRow key={n.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell align="left" sx={{ fontWeight: 600 }}>
                        {n.recipientCount > 1 ? (
                          <span style={{ color: '#5ab4dc', fontWeight: 700 }}>
                            {__('broadcast') || 'Broadcast (All)'}
                          </span>
                        ) : (
                          n.username || 'Unknown User'
                        )}
                      </TableCell>
                      <TableCell 
                        align="left" 
                        sx={{ 
                          fontSize: '13px', 
                          color: '#e5e7eb', 
                          maxWidth: '280px', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }}
                        title={n.message}
                      >
                        {n.message}
                      </TableCell>
                      <TableCell align="left" sx={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(n.createdAt).toLocaleString(window.getLang && window.getLang() === 'ar' ? 'ar-EG' : 'en-US')}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          onClick={() => {
                            setNotificationToDelete(n)
                            setDeleteConfirmOpenNotification(true)
                          }}
                          sx={{ p: '4px', minWidth: 'auto', borderRadius: '6px', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ff6b6b', '&:hover': { borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.08)' } }}
                        >
                          <Trash size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)} variant="outlined">
            {__('close') || 'Close'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Notification Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpenNotification}
        onClose={() => {
          setDeleteConfirmOpenNotification(false)
          setNotificationToDelete(null)
        }}
        PaperProps={{ className: 'premium-glass-card' }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#ef4444', fontWeight: 800 }}>
          <Trash size={18} />
          {__('deleteConfirmNotification') || 'Delete Sent Notification?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'var(--text-secondary)' }}>
            {__('deleteConfirmNotificationDesc') || 'Are you sure you want to delete this notification? It will be removed from all recipient user notifications dashboards immediately.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setDeleteConfirmOpenNotification(false)
              setNotificationToDelete(null)
            }} 
            variant="outlined"
          >
            {__('cancel') || 'Cancel'}
          </Button>
          <Button 
            onClick={() => {
              if (notificationToDelete) {
                ws.send(JSON.stringify([
                  ErrorType.Success,
                  ActionType.AdminDeleteNotification,
                  { message: notificationToDelete.message, createdAt: notificationToDelete.createdAt }
                ]))
              }
            }} 
            variant="contained" 
            color="error" 
            autoFocus
          >
            {__('remove') || 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* View Screenshot Dialog */}
      <Dialog 
        open={screenshotDialogOpen} 
        onClose={() => setScreenshotDialogOpen(false)} 
        maxWidth="md"
        PaperProps={{ className: 'premium-glass-card' }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {document.documentElement.dir === 'rtl' ? '🖼️ إيصال التحويل' : '🖼️ Transfer Screenshot'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', justifyContent: 'center', bgcolor: '#12141c', p: 2 }}>
          {viewScreenshotUrl ? (
            <img 
              src={`/${viewScreenshotUrl}`} 
              alt="Payment Receipt" 
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }} 
            />
          ) : (
            <Typography>{__('noScreenshot') || 'No screenshot'}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScreenshotDialogOpen(false)}>
            {document.documentElement.dir === 'rtl' ? 'إغلاق' : 'Close'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
