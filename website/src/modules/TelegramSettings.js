import * as React from 'react'
import { TextField, Button, Box, Typography, FormControlLabel, Switch, IconButton, InputAdornment, Checkbox, Grid, Paper, Alert } from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { ActionType, ErrorType } from '../types.js'
import { Send, Bell, ShieldAlert, MessageSquare, Server, AlertTriangle, RefreshCw, Sliders, ShieldCheck } from 'lucide-react'

export default function TelegramSettings({ ws, __ }) {
  const [telegramToken, setTelegramToken] = React.useState('')
  const [telegramChatId, setTelegramChatId] = React.useState('')
  const [telegramEnabled, setTelegramEnabled] = React.useState(false)
  const [telegramLanguage, setTelegramLanguage] = React.useState('ar')
  const [telegramAlertSettings, setTelegramAlertSettings] = React.useState({
    incomingMe: true,
    incomingAlliance: true,
    outgoingMe: true,
    outgoingAlliance: true,
    errors: true,
    system: true,
    chat: true,
    fortress: true
  })
  const [secondsTillRestartBot, setSecondsTillRestartBot] = React.useState(120)
  const [autoReconnectEnabled, setAutoReconnectEnabled] = React.useState(true)
  const [allowedAlertsList, setAllowedAlertsList] = React.useState(null)
  const [showToken, setShowToken] = React.useState(false)
  const [status, setStatus] = React.useState({ type: '', message: '' })

  const isAlertDisabled = (type) => {
    if (!allowedAlertsList) return false
    return !allowedAlertsList.includes(type)
  }

  React.useEffect(() => {
    const sendGetConfig = () => {
      if (ws.readyState === 1) { // 1 means OPEN
        ws.send(JSON.stringify([
          ErrorType.Success,
          ActionType.GetTelegramConfig,
          {}
        ]))
      }
    }

    sendGetConfig()

    const handleMessage = (event) => {
      try {
        const [err, action, obj] = JSON.parse(event.data.toString())
        if (Number(action) === ActionType.GetTelegramConfig) {
          if (Number(err) === ErrorType.Success) {
            setTelegramToken(obj.telegramToken || '')
            setTelegramChatId(obj.telegramChatId || '')
            setTelegramEnabled(!!obj.telegramEnabled)
            setTelegramLanguage(obj.telegramLanguage || 'ar')
            setSecondsTillRestartBot(obj.secondsTillRestartBot !== undefined ? obj.secondsTillRestartBot : 120)
            setAutoReconnectEnabled(obj.autoReconnectEnabled !== undefined ? Boolean(obj.autoReconnectEnabled) : true)
            if (obj.allowedAlerts) {
              try {
                setAllowedAlertsList(JSON.parse(obj.allowedAlerts))
              } catch (e) {
                setAllowedAlertsList(null)
              }
            } else {
              setAllowedAlertsList(null)
            }
            if (obj.telegramAlertSettings) {
              try {
                const parsed = JSON.parse(obj.telegramAlertSettings)
                setTelegramAlertSettings(prev => ({ ...prev, ...parsed }))
              } catch (e) {}
            }
          }
        } else if (Number(action) === ActionType.SetTelegramConfig) {
          if (Number(err) === ErrorType.Success && obj.success) {
            setStatus({ type: 'success', message: __('telegramConfigSavedSuccessfully') || 'Telegram settings saved successfully!' })
          } else {
            setStatus({ type: 'error', message: obj.error || __('failedToSaveTelegramConfig') || 'Failed to save Telegram settings.' })
          }
        }
      } catch (e) {
        console.error(e)
      }
    }

    ws.addEventListener('message', handleMessage)
    ws.addEventListener('open', sendGetConfig)

    return () => {
      ws.removeEventListener('message', handleMessage)
      ws.removeEventListener('open', sendGetConfig)
    }
  }, [ws, __])

  const handleSubmit = (e) => {
    e.preventDefault()
    setStatus({ type: '', message: '' })

    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.SetTelegramConfig,
      {
        telegramToken,
        telegramChatId,
        telegramEnabled,
        telegramLanguage,
        telegramAlertSettings: JSON.stringify(telegramAlertSettings),
        secondsTillRestartBot: Number(secondsTillRestartBot),
        autoReconnectEnabled: Boolean(autoReconnectEnabled)
      }
    ]))
  }

  const handleClickShowToken = () => {
    setShowToken(!showToken)
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '680px', mx: 'auto', mt: 2 }}>
      <Paper className="premium-glass-card border-glow-blue" sx={{ p: { xs: 3, md: 4 } }} elevation={0}>
        
        {/* Header Section */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, textAlign: 'center' }}>
          <Box className="form-header-badge" sx={{ bgcolor: 'rgba(90, 180, 220, 0.1)', color: 'var(--brand-2)', border: '1px solid rgba(90, 180, 220, 0.25)' }}>
            <Send size={22} style={{ transform: 'rotate(-25deg)', marginRight: '2px', marginTop: '-2px' }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.02em' }}>
            {__('telegramSettings') || 'Telegram Notifications'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: '460px', fontSize: '13.5px' }}>
            {__('telegramSettingsSubtitle') || 'Configure Telegram Bot Token and Chat ID to receive real-time notifications.'}
          </Typography>
        </Box>

        {/* Status Alerts */}
        {status.message && (
          <Alert 
            severity={status.type} 
            sx={{ mb: 3, borderRadius: '10px', fontWeight: 600 }}
            onClose={() => setStatus({ type: '', message: '' })}
          >
            {status.message}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {/* Credentials Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.2, mb: 3.5 }}>
            <TextField
              fullWidth
              type={showToken ? 'text' : 'password'}
              label={__('telegramBotToken') || 'Telegram Bot Token'}
              variant="outlined"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleClickShowToken}
                      edge="end"
                    >
                      {showToken ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <TextField
              fullWidth
              type="text"
              label={__('telegramChatId') || 'Telegram Chat ID'}
              variant="outlined"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
            />

            <TextField
              fullWidth
              select
              label={__('telegramLanguage') || 'Bot Language'}
              value={telegramLanguage}
              onChange={(e) => setTelegramLanguage(e.target.value)}
              SelectProps={{
                native: true,
              }}
              variant="outlined"
            >
              <option value="ar">{__('arabic') || 'العربية (Arabic)'}</option>
              <option value="en">{__('english') || 'English'}</option>
            </TextField>
          </Box>

          {/* Master Enable Notification Bar */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 4, 
            p: 2, 
            borderRadius: '12px', 
            border: '1px solid var(--line)', 
            background: 'rgba(255,255,255,0.015)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Bell size={18} style={{ color: telegramEnabled ? 'var(--brand-2)' : 'var(--text-muted)' }} />
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '14px' }}>
                  {__('enableTelegramNotifications') || 'Enable Telegram Notifications'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                  {telegramEnabled ? 'Active and listening for events' : 'Notifications are paused'}
                </Typography>
              </Box>
            </Box>
            <Switch
              checked={telegramEnabled}
              onChange={(e) => setTelegramEnabled(e.target.checked)}
              color="primary"
            />
          </Box>

          {/* Alert Preferences Grid */}
          {telegramEnabled && (
            <Box sx={{ 
              mb: 4, 
              p: 2.5, 
              border: '1px solid var(--line)', 
              borderRadius: '12px', 
              background: 'rgba(255, 255, 255, 0.01)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ShieldCheck size={18} style={{ color: 'var(--brand-2)' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '14.5px' }}>
                  {__('telegramAlertTypes') || 'Alert Preferences'}
                </Typography>
              </Box>

              <Grid container spacing={1.5}>
                {/* 1. Incoming Me */}
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    className={`settings-checkbox-card ${isAlertDisabled('incomingMe') ? 'disabled' : ''}`}
                    control={
                      <Checkbox
                        checked={isAlertDisabled('incomingMe') ? false : telegramAlertSettings.incomingMe}
                        disabled={isAlertDisabled('incomingMe')}
                        onChange={(e) => setTelegramAlertSettings(prev => ({ ...prev, incomingMe: e.target.checked }))}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ShieldAlert size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12.5px' }}>
                            {__('alertIncomingMe') || 'Attacks on Me'}
                          </Typography>
                          {isAlertDisabled('incomingMe') && (
                            <Typography variant="caption" sx={{ color: 'var(--danger)', display: 'block', fontSize: '10px' }}>
                              ({__('blockedByAdmin') || 'Disabled by Admin'})
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </Grid>

                {/* 2. Incoming Alliance */}
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    className={`settings-checkbox-card ${isAlertDisabled('incomingAlliance') ? 'disabled' : ''}`}
                    control={
                      <Checkbox
                        checked={isAlertDisabled('incomingAlliance') ? false : telegramAlertSettings.incomingAlliance}
                        disabled={isAlertDisabled('incomingAlliance')}
                        onChange={(e) => setTelegramAlertSettings(prev => ({ ...prev, incomingAlliance: e.target.checked }))}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ShieldAlert size={18} style={{ color: 'var(--warn)', flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12.5px' }}>
                            {__('alertIncomingAlliance') || 'Attacks on Alliance'}
                          </Typography>
                          {isAlertDisabled('incomingAlliance') && (
                            <Typography variant="caption" sx={{ color: 'var(--danger)', display: 'block', fontSize: '10px' }}>
                              ({__('blockedByAdmin') || 'Disabled by Admin'})
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </Grid>

                {/* 3. Outgoing Me */}
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    className={`settings-checkbox-card ${isAlertDisabled('outgoingMe') ? 'disabled' : ''}`}
                    control={
                      <Checkbox
                        checked={isAlertDisabled('outgoingMe') ? false : telegramAlertSettings.outgoingMe}
                        disabled={isAlertDisabled('outgoingMe')}
                        onChange={(e) => setTelegramAlertSettings(prev => ({ ...prev, outgoingMe: e.target.checked }))}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Send size={18} style={{ color: 'var(--ok)', flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12.5px' }}>
                            {__('alertOutgoingMe') || 'My Outgoing Attacks'}
                          </Typography>
                          {isAlertDisabled('outgoingMe') && (
                            <Typography variant="caption" sx={{ color: 'var(--danger)', display: 'block', fontSize: '10px' }}>
                              ({__('blockedByAdmin') || 'Disabled by Admin'})
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </Grid>

                {/* 4. Outgoing Alliance */}
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    className={`settings-checkbox-card ${isAlertDisabled('outgoingAlliance') ? 'disabled' : ''}`}
                    control={
                      <Checkbox
                        checked={isAlertDisabled('outgoingAlliance') ? false : telegramAlertSettings.outgoingAlliance}
                        disabled={isAlertDisabled('outgoingAlliance')}
                        onChange={(e) => setTelegramAlertSettings(prev => ({ ...prev, outgoingAlliance: e.target.checked }))}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Send size={18} style={{ color: 'var(--brand-2)', flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12.5px' }}>
                            {__('alertOutgoingAlliance') || 'Alliance Outgoing Attacks'}
                          </Typography>
                          {isAlertDisabled('outgoingAlliance') && (
                            <Typography variant="caption" sx={{ color: 'var(--danger)', display: 'block', fontSize: '10px' }}>
                              ({__('blockedByAdmin') || 'Disabled by Admin'})
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </Grid>

                {/* 5. Chat */}
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    className={`settings-checkbox-card ${isAlertDisabled('chat') ? 'disabled' : ''}`}
                    control={
                      <Checkbox
                        checked={isAlertDisabled('chat') ? false : telegramAlertSettings.chat}
                        disabled={isAlertDisabled('chat')}
                        onChange={(e) => setTelegramAlertSettings(prev => ({ ...prev, chat: e.target.checked }))}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MessageSquare size={18} style={{ color: '#a78bfa', flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12.5px' }}>
                            {__('alertChat') || 'Alliance Chat'}
                          </Typography>
                          {isAlertDisabled('chat') && (
                            <Typography variant="caption" sx={{ color: 'var(--danger)', display: 'block', fontSize: '10px' }}>
                              ({__('blockedByAdmin') || 'Disabled by Admin'})
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </Grid>

                {/* 6. Fortress */}
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    className={`settings-checkbox-card ${isAlertDisabled('fortress') ? 'disabled' : ''}`}
                    control={
                      <Checkbox
                        checked={isAlertDisabled('fortress') ? false : telegramAlertSettings.fortress}
                        disabled={isAlertDisabled('fortress')}
                        onChange={(e) => setTelegramAlertSettings(prev => ({ ...prev, fortress: e.target.checked }))}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Server size={18} style={{ color: '#00bda6', flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12.5px' }}>
                            {__('alertFortress') || 'Fortress & Towers'}
                          </Typography>
                          {isAlertDisabled('fortress') && (
                            <Typography variant="caption" sx={{ color: 'var(--danger)', display: 'block', fontSize: '10px' }}>
                              ({__('blockedByAdmin') || 'Disabled by Admin'})
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </Grid>

                {/* 7. Errors */}
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    className={`settings-checkbox-card ${isAlertDisabled('errors') ? 'disabled' : ''}`}
                    control={
                      <Checkbox
                        checked={isAlertDisabled('errors') ? false : telegramAlertSettings.errors}
                        disabled={isAlertDisabled('errors')}
                        onChange={(e) => setTelegramAlertSettings(prev => ({ ...prev, errors: e.target.checked }))}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12.5px' }}>
                            {__('alertErrors') || 'Bot Errors & Warnings'}
                          </Typography>
                          {isAlertDisabled('errors') && (
                            <Typography variant="caption" sx={{ color: 'var(--danger)', display: 'block', fontSize: '10px' }}>
                              ({__('blockedByAdmin') || 'Disabled by Admin'})
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </Grid>

                {/* 8. System */}
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    className={`settings-checkbox-card ${isAlertDisabled('system') ? 'disabled' : ''}`}
                    control={
                      <Checkbox
                        checked={isAlertDisabled('system') ? false : telegramAlertSettings.system}
                        disabled={isAlertDisabled('system')}
                        onChange={(e) => setTelegramAlertSettings(prev => ({ ...prev, system: e.target.checked }))}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RefreshCw size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '12.5px' }}>
                            {__('alertSystem') || 'Bot Logs & Startup'}
                          </Typography>
                          {isAlertDisabled('system') && (
                            <Typography variant="caption" sx={{ color: 'var(--danger)', display: 'block', fontSize: '10px' }}>
                              ({__('blockedByAdmin') || 'Disabled by Admin'})
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Auto Reconnect Settings Card */}
          <Box sx={{ 
            mb: 4, 
            p: 2.5, 
            border: '1px solid var(--line)', 
            borderRadius: '12px', 
            background: 'rgba(255, 255, 255, 0.015)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Sliders size={18} style={{ color: 'var(--brand-2)' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '14.5px' }}>
                {__('reconnectSettings') || 'Auto Reconnect Settings'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoReconnectEnabled}
                    onChange={(e) => setAutoReconnectEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '13px' }}>
                      {__('autoReconnectEnabled') || 'Enable Auto Reconnect'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                      {__('autoReconnectSubtitle') || 'Automatically try to restart active bot sessions if they disconnect.'}
                    </Typography>
                  </Box>
                }
              />

              {autoReconnectEnabled && (
                <Box sx={{ mt: 1, className: 'animate-fade-in' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, fontSize: '13px' }}>
                    {__('secondsTillRestartBot') || 'Bot Restart Delay (seconds)'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block', mb: 1.5 }}>
                    {__('secondsTillRestartBotSubtitle') || 'Safety wait time before logging back in and playing if the bot disconnects or stops.'}
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    variant="outlined"
                    inputProps={{ min: 5 }}
                    value={secondsTillRestartBot}
                    onChange={(e) => setSecondsTillRestartBot(e.target.value)}
                  />
                </Box>
              )}
            </Box>
          </Box>

          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            sx={{ fontWeight: 700, height: '48px', fontSize: '14px' }}
          >
            {__('save') || 'Save Settings'}
          </Button>
        </form>
      </Paper>
    </Box>
  )
}
