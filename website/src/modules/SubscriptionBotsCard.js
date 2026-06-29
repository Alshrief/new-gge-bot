import * as React from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  TextField,
  Button,
  Chip,
  InputAdornment,
  IconButton,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel
} from '@mui/material'
import { Settings, Coins, Gem, Zap, Eye, EyeOff, Package, Swords, TrendingUp } from 'lucide-react'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import StorefrontIcon from '@mui/icons-material/Storefront'
import SecurityIcon from '@mui/icons-material/Security'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import ExtensionIcon from '@mui/icons-material/Extension'
import { ErrorType, ActionType } from '../types.js'

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

function formatProxy(host, port, user, pass) {
  if (!host) return ''
  let str = `${host}`
  if (port) str += `:${port}`
  if (user && pass) {
    str += `:${user}:${pass}`
  }
  return str
}

const CATEGORY_MAP = {
  // Attacks & Events
  attackBarons: 'attacks',
  attackFortresses: 'attacks',
  attackSamurai: 'attacks',
  attackNomads: 'attacks',
  attackKhan: 'attacks',
  attackBerimondInvasion: 'attacks',
  attackBerimondKingdom: 'attacks',
  attackForeign: 'attacks',
  attackBloodcrows: 'attacks',
  attackDaimyo: 'attacks',
  resourceSendStorm: 'attacks',

  // Economy & Support
  nomadShop: 'economy',
  samuraiShop: 'economy',
  spendAffluence: 'economy',
  feast: 'economy',
  barracks: 'economy',
  hospital: 'economy',
  buildings: 'economy',
  toolsmith: 'economy',
  blacksmith: 'economy',
  blacksmithOR: 'economy',
  sellStoredEquipment: 'economy',
  resourceSend: 'economy',
  produceTools: 'economy',

  // Defense & Utils
  khanDefence: 'defense',
  stationOnHit: 'defense',
  helpRequests: 'defense',
  buyTools: 'defense',
  buySpeedGlobalEffect: 'defense',
  externalEventHelper: 'defense',
  shutoffTimer: 'defense',

  // Alerts & Discord
  aquaIsland: 'discord',
  aquaTower: 'discord',
  fortress: 'discord',
  chat: 'discord',
  outgoingAttacks: 'discord',
  incomingAttacks: 'discord',
  grandTornament: 'discord'
}

export default function SubscriptionBotsCard({ user, plugins, usersStatus, ws, __, onOpenSettings, onOpenResources, onOpenMilitary, onOpenProduction }) {
  const [pluginsState, setPluginsState] = React.useState(user.plugins || {})
  const [gamePassInput, setGamePassInput] = React.useState(user.pass || "")
  const [showPassword, setShowPassword] = React.useState(false)
  const [tab, setTab] = React.useState('attacks')
  const status = usersStatus[user.id] || {}

  const [proxyDialogOpen, setProxyDialogOpen] = React.useState(false)
  const [proxyEnabledLocal, setProxyEnabledLocal] = React.useState(user.proxyEnabled ?? false)
  const [proxyTypeLocal, setProxyTypeLocal] = React.useState(user.proxyType || "SOCKS5")
  const [proxyInputLocal, setProxyInputLocal] = React.useState(
    formatProxy(user.proxyHost, user.proxyPort, user.proxyUser, user.proxyPass)
  )
  const [testStatusLocal, setTestStatusLocal] = React.useState("")
  const [testErrorMessageLocal, setTestErrorMessageLocal] = React.useState("")

  // Keep track of internal changes to avoid lag
  React.useEffect(() => {
    setPluginsState(user.plugins || {})
  }, [user.plugins])

  React.useEffect(() => {
    setGamePassInput(user.pass || "")
  }, [user.pass])

  React.useEffect(() => {
    setProxyEnabledLocal(user.proxyEnabled ?? false)
    setProxyTypeLocal(user.proxyType || "SOCKS5")
    setProxyInputLocal(formatProxy(user.proxyHost, user.proxyPort, user.proxyUser, user.proxyPass))
  }, [user.proxyEnabled, user.proxyType, user.proxyHost, user.proxyPort, user.proxyUser, user.proxyPass])

  const handleTestProxy = () => {
    const parsed = parseProxyString(proxyInputLocal)
    if (!parsed.host || !parsed.port) {
      setTestStatusLocal("error")
      setTestErrorMessageLocal(__("proxyInvalidFormat") || "Invalid proxy format (ip:port)")
      return
    }

    setTestStatusLocal("testing")
    setTestErrorMessageLocal("")

    const onMessage = (msg) => {
      try {
        const [errVal, action, obj] = JSON.parse(msg.data.toString())
        if (action === ActionType.TestProxy) {
          ws.removeEventListener("message", onMessage)
          if (errVal === ErrorType.Success) {
            setTestStatusLocal("success")
          } else {
            setTestStatusLocal("error")
            setTestErrorMessageLocal(obj.error || "Unknown error")
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
        proxyType: proxyTypeLocal
      }
    ]))

    setTimeout(() => ws.removeEventListener("message", onMessage), 10000)
  }

  const handleSaveProxy = () => {
    const parsed = parseProxyString(proxyInputLocal)
    const updatedUser = {
      ...user,
      proxyHost: parsed.host,
      proxyPort: parsed.port,
      proxyUser: parsed.user,
      proxyPass: parsed.pass,
      proxyType: proxyTypeLocal,
      proxyEnabled: proxyEnabledLocal
    }
    ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, updatedUser]))
    setProxyDialogOpen(false)
  }

  const handleSavePassword = () => {
    if (gamePassInput && gamePassInput !== user.pass) {
      const updatedUser = { ...user, pass: gamePassInput }
      ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, updatedUser]))
    }
  }

  const handleTogglePlugin = (pluginKey, checked) => {
    const updatedUser = { ...user }
    updatedUser.plugins = { ...user.plugins }
    updatedUser.plugins[pluginKey] = { ...user.plugins[pluginKey], state: checked }
    
    // Send update over WS
    ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, updatedUser]))
  }

  const handleCommanderChange = (pluginKey, value) => {
    const updatedUser = { ...user }
    updatedUser.plugins = { ...user.plugins }
    updatedUser.plugins[pluginKey] = { ...user.plugins[pluginKey], commanderWhiteList: value }
    
    // Send update over WS
    ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, updatedUser]))
  }

  const activeCount = Object.values(pluginsState).filter(p => p && p.state).length

  const filteredPlugins = React.useMemo(() => {
    return plugins.filter(plugin => {
      const cat = CATEGORY_MAP[plugin.key] || 'other'
      return cat === tab
    })
  }, [plugins, tab])

  return (
    <Paper className="premium-glass-card" sx={{ mb: 4, overflow: 'hidden' }} elevation={0}>
      {/* Subscription Card Header */}
      <Box sx={{
        p: 2.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.01)',
        borderBottom: '1px solid var(--border-light)',
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {user.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              Server #{user.server} {activeCount > 0 ? `· ${activeCount} plugin${activeCount > 1 ? 's' : ''} active` : ''}
            </Typography>
          </Box>
          {status.level && (
            <Chip size="small" label={`LVL ${status.level}`} color="secondary" variant="outlined" sx={{ fontWeight: 700 }} />
          )}
        </Box>
        
        {/* Badges: Gold, Rubies, Daily Attacks */}
        <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', alignItems: 'center' }}>
          {status.gold !== undefined && (
            <Chip
              size="medium"
              icon={<Coins size={16} style={{ color: '#ffd700' }} />}
              label={`${__( 'gold' ) || 'Gold'}: ${status.gold.toLocaleString()}`}
              sx={{ bgcolor: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.2)', color: '#ffd700', fontWeight: 600 }}
            />
          )}
          {status.cash !== undefined && (
            <Chip
              size="medium"
              icon={<Gem size={16} style={{ color: '#e45f7a' }} />}
              label={`${__('rubies') || 'Rubies'}: ${status.cash.toLocaleString()}`}
              sx={{ bgcolor: 'rgba(228, 95, 122, 0.08)', border: '1px solid rgba(228, 95, 122, 0.2)', color: '#e45f7a', fontWeight: 600 }}
            />
          )}
          {status.attackDailyCount !== undefined && (
            <Chip
              size="medium"
              icon={<Zap size={16} style={{ color: '#5ab4dc' }} />}
              label={`${__('dailyAttacks') || 'Daily attacks'}: ${status.attackDailyCount}`}
              sx={{ bgcolor: 'rgba(90, 180, 220, 0.08)', border: '1px solid rgba(90, 180, 220, 0.2)', color: '#5ab4dc', fontWeight: 600 }}
            />
          )}
          
          <TextField
            size="small"
            type={showPassword ? 'text' : 'password'}
            label={__("gamePassword") || "كلمة مرور اللعبة"}
            value={gamePassInput}
            placeholder="Game Password"
            onChange={(e) => setGamePassInput(e.target.value)}
            onBlur={handleSavePassword}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSavePassword()
                e.target.blur()
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    size="small"
                    sx={{ p: 0.5 }}
                  >
                    {showPassword ? <EyeOff size={14} style={{ color: 'var(--text-muted)' }} /> : <Eye size={14} style={{ color: 'var(--text-muted)' }} />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              width: '150px',
              mx: 1,
              '& .MuiInputBase-root': {
                height: '32px',
                fontSize: '12px',
                pr: 0.5,
                background: 'rgba(255, 255, 255, 0.02)'
              },
              '& .MuiInputLabel-root': {
                fontSize: '11px',
                transform: 'translate(14px, 7px) scale(1)',
                '&.Mui-focused, &.MuiFormLabel-filled': {
                  transform: 'translate(14px, -9px) scale(0.75)'
                }
              }
            }}
          />

          <FormControlLabel
            control={
              <Checkbox 
                size="small" 
                checked={user.externalEvent ?? false} 
                onChange={(e) => {
                  const updatedUser = { ...user, externalEvent: e.target.checked }
                  ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, updatedUser]))
                }} 
              />
            }
            label={<Typography variant="body2">OR/BTH</Typography>}
            sx={{ m: 0, mr: 1 }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mr: 1 }}>
            <FormControlLabel
              control={
                <Checkbox 
                  size="small" 
                  checked={user.proxyEnabled ?? false} 
                  onChange={(e) => {
                    const updatedUser = { ...user, proxyEnabled: e.target.checked }
                    ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, updatedUser]))
                  }} 
                />
              }
              label={<Typography variant="body2">{__("proxy") || "Proxy"}</Typography>}
              sx={{ m: 0 }}
            />
            <IconButton 
              size="small" 
              onClick={() => setProxyDialogOpen(true)}
              sx={{ p: 0.5, color: 'primary.main' }}
            >
              <Settings size={14} />
            </IconButton>
          </Box>

          <Button
            size="small"
            variant="outlined"
            startIcon={<Package size={14} />}
            onClick={() => onOpenResources && onOpenResources(status.resources)}
            disabled={!status.resources}
            sx={{
              height: '32px',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'none',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              color: 'var(--text-primary)',
              '&:hover': {
                borderColor: 'var(--brand)',
                background: 'rgba(255, 255, 255, 0.05)',
              },
              '&.Mui-disabled': {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                color: 'rgba(255, 255, 255, 0.3)'
              }
            }}
          >
            {__("resources") || "Resources"}
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<Swords size={14} />}
            onClick={() => onOpenMilitary && onOpenMilitary(status.military)}
            disabled={!status.military}
            sx={{
              height: '32px',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'none',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              color: 'var(--text-primary)',
              '&:hover': {
                borderColor: 'var(--brand)',
                background: 'rgba(255, 255, 255, 0.05)',
              },
              '&.Mui-disabled': {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                color: 'rgba(255, 255, 255, 0.3)'
              }
            }}
          >
            {__("armyAndTools") || "Army & Tools"}
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<TrendingUp size={14} />}
            onClick={() => onOpenProduction && onOpenProduction(status.production)}
            disabled={!status.production}
            sx={{
              height: '32px',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'none',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              color: 'var(--text-primary)',
              '&:hover': {
                borderColor: 'var(--brand)',
                background: 'rgba(255, 255, 255, 0.05)',
              },
              '&.Mui-disabled': {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                color: 'rgba(255, 255, 255, 0.3)'
              }
            }}
          >
            {__("production") || "Production"}
          </Button>

          <Chip
            size="small"
            label={user.state ? 'Online' : 'Offline'}
            color={user.state ? 'success' : 'default'}
            sx={{ fontWeight: 700 }}
          />
          
           <Switch
            checked={Boolean(user.state)}
            color="success"
            onChange={(e) => {
              if (e.target.checked && (!gamePassInput || gamePassInput.trim() === "")) {
                alert(__("pleaseEnterGamePassword") || "Please enter your game password next to the switch before starting the bot.\nيرجى إدخال كلمة مرور اللعبة بجانب زر التشغيل قبل تفعيل البوت.")
                return
              }
              const updatedUser = { ...user, state: e.target.checked ? 1 : 0 }
              ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, updatedUser]))
            }}
          />
        </Box>
      </Box>

      {/* Category Tabs */}
      <Box sx={{ px: 2.5, pt: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <Tabs
          value={tab}
          onChange={(e, val) => setTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTabs-indicator': {
              backgroundColor: 'var(--brand)',
              height: '3px',
              borderRadius: '3px 3px 0 0'
            },
            '& .MuiTab-root': {
              color: 'var(--text-secondary)',
              minHeight: '44px',
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'none',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '6px',
              px: 2,
              '&.Mui-selected': {
                color: 'var(--brand)'
              },
              '&:hover': {
                color: '#fff',
                background: 'rgba(255,255,255,0.02)'
              }
            }
          }}
        >
          <Tab 
            value="attacks" 
            icon={<FlashOnIcon sx={{ fontSize: '1.1rem' }} />} 
            label={__("attacksEvents")} 
          />
          <Tab 
            value="economy" 
            icon={<StorefrontIcon sx={{ fontSize: '1.1rem' }} />} 
            label={__("economySupport")} 
          />
          <Tab 
            value="defense" 
            icon={<SecurityIcon sx={{ fontSize: '1.1rem' }} />} 
            label={__("defenseUtils")} 
          />
          <Tab 
            value="discord" 
            icon={<NotificationsActiveIcon sx={{ fontSize: '1.1rem' }} />} 
            label={__("alertsDiscord")} 
          />
          {plugins.some(p => !CATEGORY_MAP[p.key]) && (
            <Tab 
              value="other" 
              icon={<ExtensionIcon sx={{ fontSize: '1.1rem' }} />} 
              label={__("otherPlugins")} 
            />
          )}
        </Tabs>
      </Box>

      {/* Plugins/Bots Table */}
      <TableContainer>
        <Table size="small" aria-label="bots table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, pl: 3 }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{__('name') || 'Name'}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{__('gameEmail') || 'Game Email'}</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">{__('onOff') || 'OnOff'}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{__('commanders') || 'Commanders'}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, pr: 3 }}>{__('actions') || 'Actions'}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPlugins.length > 0 ? (
              filteredPlugins.map((plugin) => {
                const pluginConfig = pluginsState[plugin.key] || {}
                const isEnabled = Boolean(pluginConfig.state)
                const hasCommanderOption = plugin.pluginOptions?.some(opt => opt.key === 'commanderWhiteList')
                
                const originalIndex = plugins.findIndex(p => p.key === plugin.key)
                const displayId = `[#${77200 + originalIndex + user.id * 3}]`

                return (
                  <TableRow key={plugin.key} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    {/* ID */}
                    <TableCell sx={{ pl: 3, color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '13px' }}>
                      {displayId}
                    </TableCell>
                    
                    {/* Name */}
                    <TableCell sx={{ fontWeight: 600 }}>
                      {__(plugin.key) || plugin.key}
                    </TableCell>
                    
                    {/* Game Email */}
                    <TableCell sx={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                      {user.name}
                    </TableCell>
                    
                    {/* OnOff Toggle */}
                    <TableCell align="center">
                      <Switch
                        size="small"
                        checked={isEnabled}
                        disabled={plugin.force}
                        color="success"
                        onChange={(e) => handleTogglePlugin(plugin.key, e.target.checked)}
                      />
                    </TableCell>
                    
                    {/* Commanders Textfield shortcut */}
                    <TableCell>
                      {hasCommanderOption ? (
                        <input
                          type="text"
                          className="flat-input w-28 text-xs font-mono"
                          placeholder="e.g. 35"
                          value={pluginConfig.commanderWhiteList || ''}
                          onChange={(e) => handleCommanderChange(plugin.key, e.target.value)}
                          style={{ padding: '4px 8px', maxWidth: '120px' }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px', fontStyle: 'italic', pl: 1 }}>
                          -
                        </Typography>
                      )}
                    </TableCell>
                    
                    {/* Actions */}
                    <TableCell align="right" sx={{ pr: 3 }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="secondary"
                        startIcon={<Settings size={14} />}
                        onClick={() => onOpenSettings(plugin, user)}
                        sx={{
                          fontSize: '11px',
                          py: 0.5,
                          px: 1.5,
                          background: 'linear-gradient(135deg, #00bda6 0%, #009d87 100%) !important',
                          '&:hover': { background: '#009d87 !important' }
                        }}
                      >
                        {__('settings') || 'Settings'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'var(--text-secondary)' }}>
                  No plugins in this category.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Proxy Settings Dialog for this user/bot */}
      <Dialog open={proxyDialogOpen} onClose={() => setProxyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {__("proxySettings") || "Proxy Settings"} — {user.name}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            
            {/* Warning banner */}
            <Box sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: 'rgba(255, 167, 38, 0.1)',
              border: '1px solid rgba(255, 167, 38, 0.3)',
              color: '#ffa726'
            }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {__("proxyWarning") || "Note: Free proxies are completely fine as long as they are working."}
              </Typography>
            </Box>

            <FormControlLabel
              control={<Checkbox size="small" checked={proxyEnabledLocal} onChange={e => setProxyEnabledLocal(e.target.checked)} />}
              label={<Typography variant="body2">{__("enableProxy") || "Enable Proxy"}</Typography>}
            />

            <FormControl size="small" fullWidth disabled={!proxyEnabledLocal}>
              <InputLabel id="card-proxy-type-label">{__("proxyType") || "Type"}</InputLabel>
              <Select
                labelId="card-proxy-type-label"
                id="card-proxy-type-select"
                value={proxyTypeLocal}
                label={__("proxyType") || "Type"}
                onChange={e => setProxyTypeLocal(e.target.value)}
              >
                <MenuItem value="HTTP">HTTP</MenuItem>
                <MenuItem value="HTTPS">HTTPS</MenuItem>
                <MenuItem value="SOCKS4">SOCKS4</MenuItem>
                <MenuItem value="SOCKS5">SOCKS5</MenuItem>
              </Select>
            </FormControl>

            <TextField
              size="small"
              fullWidth
              label={__("proxyAddress") || "Proxy Address (ip:port:user:pass)"}
              placeholder="12.34.56.78:8080 or 12.34.56.78:8080:user:pass"
              value={proxyInputLocal}
              onChange={e => setProxyInputLocal(e.target.value)}
              disabled={!proxyEnabledLocal}
            />

            <Button
              variant="outlined"
              size="medium"
              onClick={handleTestProxy}
              disabled={!proxyEnabledLocal || testStatusLocal === "testing"}
            >
              {testStatusLocal === "testing" ? (__("testing") || "Testing...") : (__("testProxy") || "Test Proxy")}
            </Button>

            {testStatusLocal === "success" && (
              <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'rgba(62, 207, 142, 0.1)', border: '1px solid rgba(62, 207, 142, 0.3)', color: '#3ecf8e' }}>
                <Typography variant="body2">{__("proxyTestSuccess") || "Proxy connected successfully!"}</Typography>
              </Box>
            )}
            {testStatusLocal === "error" && (
              <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', color: '#ff6b6b' }}>
                <Typography variant="body2">
                  {(__("proxyTestFailed") || "Proxy connection failed:")} {testErrorMessageLocal}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProxyDialogOpen(false)}>{__("cancel") || "Cancel"}</Button>
          <Button onClick={handleSaveProxy} variant="contained" color="success">
            {__("save") || "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
