import * as React from 'react'
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Backdrop
} from '@mui/material'
import { Power, Layers, Gem, Target, Plus, MessageSquare } from 'lucide-react'
import SubscriptionBotsCard from './SubscriptionBotsCard'
import BotConfigurator from './BotConfigurator'
import Resources from './Resources'
import ArmyAndTools from './ArmyAndTools'
import ProductionOverview from './ProductionOverview'
import { ErrorType, ActionType } from '../types.js'
import settings from '../settings.json'

// Parse servers list from 1.xml asynchronously without top-level await
let servers = []
fetch(`${window.location.protocol === 'https:' ? "https" : "http"}://${window.location.hostname}:${settings.port ?? window.location.port}/1.xml`)
  .then(res => res.text())
  .then(xmlText => {
    let xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml")
    let _instances = xmlDoc.getElementsByTagName("instance")
    for (let key in _instances) {
      let obj = _instances[key]
      if (obj && typeof obj === 'object') {
        let server, zone, instanceLocaId, instanceName
        for (let key2 in obj.childNodes) {
          let obj2 = obj.childNodes[key2]
          switch(obj2.nodeName) {
            case "server": server = obj2.childNodes[0]?.nodeValue; break
            case "zone": zone = obj2.childNodes[0]?.nodeValue; break
            case "instanceLocaId": instanceLocaId = obj2.childNodes[0]?.nodeValue; break
            case "instanceName": instanceName = obj2.childNodes[0]?.nodeValue; break
          }
        }
        if (instanceLocaId) {
          servers.push({ id: obj.getAttribute("value"), server, zone, instanceLocaId, instanceName })
        }
      }
    }
  })
  .catch(e => console.error("Failed to parse servers xml in DashboardOverview:", e))

function parseProxyString(str) {
  str = (str || '').trim()
  if (!str) return { host: '', port: null, user: '', pass: '' }
  if (str.includes('@')) {
    const parts = str.split('@')
    const authParts = parts[0].split(':')
    const hostParts = parts[1].split(':')
    return {
      host: hostParts[0] || '',
      port: hostParts[1] ? parseInt(hostParts[1], 10) : null,
      user: authParts[0] || '',
      pass: authParts[1] || ''
    }
  }
  const parts = str.split(':')
  if (parts.length >= 4) {
    return {
      host: parts[0] || '',
      port: parts[1] ? parseInt(parts[1], 10) : null,
      user: parts[2] || '',
      pass: parts.slice(3).join(':') || ''
    }
  } else {
    return {
      host: parts[0] || '',
      port: parts[1] ? parseInt(parts[1], 10) : null,
      user: '',
      pass: ''
    }
  }
}

export default function DashboardOverview({
  username,
  users = [],
  plugins = [],
  usersStatus = {},
  ws,
  profile,
  channels,
  channelInfo = [],
  __,
  setActiveTab
}) {
  const [selectedPlugin, setSelectedPlugin] = React.useState(null)
  const [selectedUser, setSelectedUser] = React.useState(null)
  
  // Dialog States
  const [addAccountOpen, setAddAccountOpen] = React.useState(false)
  const [openResources, setOpenResources] = React.useState(false)
  const [openMilitary, setOpenMilitary] = React.useState(false)
  const handleResourcesClose = () => setOpenResources(false)
  const handleResourcesOpen = (resources) => setOpenResources(resources)
  const handleMilitaryClose = () => setOpenMilitary(false)
  const handleMilitaryOpen = (military) => setOpenMilitary(military)
  const [openProduction, setOpenProduction] = React.useState(false)
  const handleProductionClose = () => setOpenProduction(false)
  const handleProductionOpen = (production) => setOpenProduction(production)
  
  // New account form states
  const [newAccName, setNewAccName] = React.useState('')
  const [newAccPass, setNewAccPass] = React.useState('')
  const [newAccServer, setNewAccServer] = React.useState(servers[0]?.id || '')
  const [newAccExternal, setNewAccExternal] = React.useState(false)
  
  // Proxy form states
  const [proxyEnabled, setProxyEnabled] = React.useState(false)
  const [proxyType, setProxyType] = React.useState("SOCKS5")
  const [proxyInput, setProxyInput] = React.useState("")
  const [testStatus, setTestStatus] = React.useState("")
  const [testErrorMessage, setTestErrorMessage] = React.useState("")

  // Calculate statistics
  const isAdmin = profile?.privilege === 1
  const maxAccountsNum = isAdmin ? Infinity : (profile?.maxGameAccounts || 1)
  const maxAccountsDisplay = isAdmin ? '\u221e' : (profile?.maxGameAccounts || 1)
  const hasReachedLimit = !isAdmin && users.length >= maxAccountsNum
  const runningBotsCount = users.filter(u => u.state === 1).length
  const totalAttacksCount = Object.values(usersStatus).reduce((sum, s) => sum + (s.attackDailyCount || 0), 0)

  const handleOpenSettings = (plugin, user) => {
    setSelectedPlugin(plugin)
    setSelectedUser(user)
  }

  const handleTestProxy = () => {
    const parsed = parseProxyString(proxyInput)
    if (!parsed.host || !parsed.port) {
      setTestStatus("error")
      setTestErrorMessage(__("proxyInvalidFormat") || "Invalid proxy format (ip:port)")
      return
    }

    setTestStatus("testing")
    setTestErrorMessage("")

    const onMessage = (msg) => {
      try {
        const [errVal, action, obj] = JSON.parse(msg.data.toString())
        if (action === ActionType.TestProxy) {
          ws.removeEventListener("message", onMessage)
          if (errVal === ErrorType.Success) {
            setTestStatus("success")
          } else {
            setTestStatus("error")
            setTestErrorMessage(obj.error || "Unknown error")
          }
        }
      } catch (e) {
        console.error(e)
      }
    }

    ws.addEventListener("message", onMessage)
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.TestProxy,
      {
        proxyHost: parsed.host,
        proxyPort: parsed.port,
        proxyUser: parsed.user,
        proxyPass: parsed.pass,
        proxyType: proxyType
      }
    ]))

    setTimeout(() => ws.removeEventListener("message", onMessage), 10000)
  }

  const handleAddAccount = () => {
    if (!newAccName || !newAccPass) {
      alert("Please fill in game email and password.")
      return
    }
    const parsedProxy = parseProxyString(proxyInput)
    const newSubUser = {
      name: newAccName,
      pass: newAccPass,
      server: newAccServer || (servers[0]?.id || 1),
      plugins: {},
      externalEvent: newAccExternal,
      state: 0,
      proxyHost: parsedProxy.host,
      proxyPort: parsedProxy.port,
      proxyUser: parsedProxy.user,
      proxyPass: parsedProxy.pass,
      proxyType: proxyType,
      proxyEnabled: proxyEnabled
    }

    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.AddUser,
      newSubUser
    ]))

    // Reset Form
    setNewAccName('')
    setNewAccPass('')
    setNewAccServer(servers[0]?.id || '')
    setNewAccExternal(false)
    setProxyEnabled(false)
    setProxyInput('')
    setTestStatus('')
    setAddAccountOpen(false)
  }

  // If in plugin configuration mode, render BotConfigurator
  if (selectedPlugin && selectedUser) {
    return (
      <BotConfigurator
        plugin={selectedPlugin}
        user={selectedUser}
        usersStatus={usersStatus}
        plugins={plugins}
        channels={channels}
        ws={ws}
        __={__}
        onClose={() => {
          setSelectedPlugin(null)
          setSelectedUser(null)
        }}
      />
    )
  }

  return (
    <Box sx={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
      
      {/* 4 Summary Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        
        {/* Bots Running */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper className="premium-glass-card border-glow-green" sx={{ p: 2.2, display: 'flex', gap: 2, alignItems: 'center' }} elevation={0}>
            <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center' }}>
              <Power size={20} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{runningBotsCount} / {maxAccountsDisplay}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>BOTS RUNNING</Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Active Subscriptions */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper 
            className="premium-glass-card border-glow-blue" 
            sx={{ 
              p: 2.2, 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center', 
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                background: 'rgba(90, 180, 220, 0.08) !important',
                borderColor: 'rgba(90, 180, 220, 0.4)'
              }
            }} 
            elevation={0}
            onClick={() => setActiveTab('subscription')}
          >
            <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(90, 180, 220, 0.08)', color: '#5ab4dc', display: 'flex', alignItems: 'center' }}>
              <Layers size={20} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{users.length}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>SUBSCRIPTION</Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Credits */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper 
            className="premium-glass-card border-glow-gold" 
            sx={{ 
              p: 2.2, 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                background: 'rgba(255, 215, 0, 0.08) !important',
                borderColor: 'rgba(255, 215, 0, 0.4)'
              }
            }} 
            elevation={0}
            onClick={() => setActiveTab('subscription')}
          >
            <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(255, 215, 0, 0.08)', color: '#ffd700', display: 'flex', alignItems: 'center' }}>
              <Gem size={20} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>{profile?.credits || 0}</Typography>
                <Button 
                  size="small" 
                  variant="text" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('subscription');
                  }}
                  sx={{ color: '#ffd700', minWidth: 'auto', p: 0, fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textDecoration: 'underline' }}
                >
                  {document.documentElement.dir === 'rtl' ? 'شحن' : 'Buy'}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {document.documentElement.dir === 'rtl' ? 'الرصيد' : 'CREDITS'}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Daily Attacks */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper className="premium-glass-card border-glow-rose" sx={{ p: 2.2, display: 'flex', gap: 2, alignItems: 'center' }} elevation={0}>
            <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(244, 63, 94, 0.08)', color: '#f43f5e', display: 'flex', alignItems: 'center' }}>
              <Target size={20} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{totalAttacksCount.toLocaleString()}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>DAILY ATTACKS</Typography>
            </Box>
          </Paper>
        </Grid>

      </Grid>

      {/* Main Section Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          🎮 {__('yourBots') || 'Your bots'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {channelInfo[0] && (
            <Button
              variant="outlined"
              startIcon={<MessageSquare size={16} />}
              onClick={() =>
                window.open(
                  `https://discord.com/oauth2/authorize?client_id=${channelInfo[0]}&permissions=8&response_type=code&redirect_uri=${window.location.protocol === 'https:' ? 'https' : 'http'}%3A%2F%2F${window.location.hostname}%3A${(settings.port ?? window.location.port) !== '' ? (settings.port ?? window.location.port) : window.location.protocol === 'https:' ? '443' : '80'}%2FdiscordAuth&integration_type=0&scope=identify+guilds.join+bot`,
                  '_blank'
                )
              }
              sx={{
                borderColor: '#5865f2',
                color: '#5865f2',
                '&:hover': { background: 'rgba(88,101,242,0.08)', borderColor: '#5865f2' }
              }}
            >
              {__('linkDiscord') || 'Link Discord'}
            </Button>
          )}
          {hasReachedLimit ? (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 2, py: 1,
              borderRadius: '8px',
              bgcolor: 'rgba(255,107,107,0.07)',
              border: '1px solid rgba(255,107,107,0.2)',
              color: '#ff6b6b',
              fontSize: '13px',
              fontWeight: 700
            }}>
              🔒 {__('accountLimitReached') || `وصلت للحد الأقصى (${maxAccountsDisplay} حساب)`}
            </Box>
          ) : (
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => setAddAccountOpen(true)}
              sx={{
                background: 'linear-gradient(135deg, #00bda6 0%, #009d87 100%) !important',
                boxShadow: '0 4px 12px rgba(0, 189, 166, 0.2)'
              }}
            >
              {__('addGameAccount') || 'Add Game Account'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Group and render bot cards */}
      <Box>
        {users.map(user => (
          <SubscriptionBotsCard
            key={user.id}
            user={user}
            plugins={plugins}
            usersStatus={usersStatus}
            ws={ws}
            __={__}
            onOpenSettings={handleOpenSettings}
            onOpenResources={(resources) => handleResourcesOpen(resources)}
            onOpenMilitary={(military) => handleMilitaryOpen(military)}
            onOpenProduction={(production) => handleProductionOpen(production)}
          />
        ))}

        {users.length === 0 && (
          <Paper sx={{ p: 5, textAlign: 'center', border: '1px dashed var(--border-light)', borderRadius: '12px', background: 'transparent' }} elevation={0}>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2, fontWeight: 700 }}>
              {__('noBotsAvailable') || 'No active bot instances yet.'}
            </Typography>
            <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setAddAccountOpen(true)}>
              {__('addFirstAccount') || 'Add your first account'}
            </Button>
          </Paper>
        )}
      </Box>

      {/* Add Game Account Dialog */}
      <Dialog open={addAccountOpen} onClose={() => setAddAccountOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{__('addGameAccount') || 'Add Game Account'}</DialogTitle>
        <DialogContent dividers>
          <FormGroup sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              required
              fullWidth
              label={__('gameEmail') || "Game Email / Account Name"}
              value={newAccName}
              onChange={e => setNewAccName(e.target.value)}
            />
            <TextField
              required
              fullWidth
              label={__('password') || "Password"}
              type="password"
              value={newAccPass}
              onChange={e => setNewAccPass(e.target.value)}
            />
            
            <FormControl fullWidth>
              <InputLabel required>{__("server") || "Server"}</InputLabel>
              <Select
                value={newAccServer}
                label={__("server") || "Server"}
                onChange={(e) => setNewAccServer(e.target.value)}
              >
                {servers.map((srv, i) => (
                  <MenuItem value={srv.id} key={i}>
                    {__(srv.instanceLocaId) + ' ' + srv.instanceName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControlLabel
              control={<Checkbox checked={newAccExternal} onChange={e => setNewAccExternal(e.target.checked)} />}
              label={<Typography variant="body2">OR/BTH Event Server</Typography>}
            />

            {/* Proxy Setup */}
            <Box sx={{ mt: 2, borderTop: '1px solid rgba(255,255,255,0.06)', pt: 2 }}>
              <FormControlLabel
                control={<Checkbox checked={proxyEnabled} onChange={e => setProxyEnabled(e.target.checked)} />}
                label={<Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>Enable Proxy for Safety</Typography>}
              />

              {proxyEnabled && (
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select value={proxyType} label="Type" onChange={e => setProxyType(e.target.value)}>
                      <MenuItem value="HTTP">HTTP</MenuItem>
                      <MenuItem value="HTTPS">HTTPS</MenuItem>
                      <MenuItem value="SOCKS4">SOCKS4</MenuItem>
                      <MenuItem value="SOCKS5">SOCKS5</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    size="small"
                    fullWidth
                    label="Proxy Address (ip:port:user:pass)"
                    placeholder="12.34.56.78:8080:user:pass"
                    value={proxyInput}
                    onChange={e => setProxyInput(e.target.value)}
                  />

                  <Button variant="outlined" size="small" onClick={handleTestProxy} disabled={testStatus === "testing"}>
                    {testStatus === "testing" ? "Testing..." : "Test Proxy Connection"}
                  </Button>

                  {testStatus === "success" && (
                    <Box sx={{ p: 1, bgcolor: 'rgba(62,207,142,0.1)', color: '#3ecf8e', border: '1px solid rgba(62,207,142,0.2)', borderRadius: '4px', fontSize: '12px' }}>
                      Proxy connected successfully!
                    </Box>
                  )}
                  {testStatus === "error" && (
                    <Box sx={{ p: 1, bgcolor: 'rgba(255,107,107,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.2)', borderRadius: '4px', fontSize: '12px' }}>
                      Proxy test failed: {testErrorMessage}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddAccountOpen(false)}>{__('cancel') || 'Cancel'}</Button>
          <Button onClick={handleAddAccount} variant="contained" color="success">
            {__('add') || 'Add Bot'}
          </Button>
        </DialogActions>
      </Dialog>

      <Backdrop
        sx={theme => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
        open={openResources !== false}
        onClick={handleResourcesClose}
        style={{ maxHeight: '100%', overflow: 'auto' }}
      >
        <Resources __={__} openResources={openResources} languageCode={profile?.language || 'en'} />
      </Backdrop>

      <Backdrop
        sx={theme => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
        open={openMilitary !== false}
        onClick={handleMilitaryClose}
        style={{ maxHeight: '100%', overflow: 'auto' }}
      >
        <ArmyAndTools __={__} openMilitary={openMilitary} languageCode={profile?.language || 'en'} />
      </Backdrop>

      <Backdrop
        sx={theme => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
        open={openProduction !== false}
        onClick={handleProductionClose}
        style={{ maxHeight: '100%', overflow: 'auto' }}
      >
        <ProductionOverview __={__} openProduction={openProduction} languageCode={profile?.language || 'en'} />
      </Backdrop>

    </Box>
  )
}
