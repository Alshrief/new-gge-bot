import * as React from 'react'
import { TextField, Button, Box, Typography, Paper, Alert, IconButton, InputAdornment } from '@mui/material'
import { ActionType, ErrorType } from '../types.js'
import { KeyRound, Eye, EyeOff, Lock } from 'lucide-react'

export default function ChangePasswordForm({ ws, __, profile, users = [] }) {
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [status, setStatus] = React.useState({ type: '', message: '' })

  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNew, setShowNew] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)

  React.useEffect(() => {
    const handleMessage = (event) => {
      try {
        const [err, action, obj] = JSON.parse(event.data.toString())
        if (Number(action) === ActionType.ChangePassword) {
          if (Number(err) === ErrorType.Success && obj.success) {
            setStatus({ type: 'success', message: __('passwordChangedSuccessfully') || 'Password changed successfully!' })
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
          } else {
            setStatus({ type: 'error', message: obj.error || __('failedToChangePassword') || 'Failed to change password.' })
          }
        }
      } catch (e) {
        console.error(e)
      }
    }

    ws.addEventListener('message', handleMessage)
    return () => {
      ws.removeEventListener('message', handleMessage)
    }
  }, [ws, __])

  const handleSubmit = (e) => {
    e.preventDefault()
    setStatus({ type: '', message: '' })

    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus({ type: 'error', message: __('fillAllFields') || 'Please fill in all fields.' })
      return
    }

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: __('passwordsDoNotMatch') || 'New passwords do not match.' })
      return
    }

    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: __('passwordTooShort') || 'Password must be at least 6 characters long.' })
      return
    }

    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.ChangePassword,
      { currentPassword, newPassword }
    ]))
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '520px', mx: 'auto', mt: 2 }}>
      <Paper className="premium-glass-card border-glow-gold" sx={{ p: { xs: 3, md: 4 } }} elevation={0}>
        
        {/* Header Section */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, textAlign: 'center' }}>
          <Box className="form-header-badge" sx={{ bgcolor: 'rgba(255, 215, 0, 0.08)', color: 'var(--warn)', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
            <KeyRound size={22} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.02em' }}>
            {__('changePassword') || 'Change Password'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: '400px', fontSize: '13.5px' }}>
            {__('changePasswordSubtitle') || 'Update your credentials for accessing the GGE-BOT panel.'}
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

        {/* Read-Only Account Details */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <TextField
            fullWidth
            label={__('dashboardUsername') || 'Dashboard Username'}
            value={profile?.username || ''}
            disabled
            InputProps={{
              readOnly: true,
            }}
          />
          {users.map((u, idx) => (
            <TextField
              key={u.id || idx}
              fullWidth
              label={users.length > 1 ? `${__('gameEmail') || 'Game Email'} (${idx + 1})` : (__('gameEmail') || 'Game Email')}
              value={u.name || ''}
              disabled
              helperText={__('emailCannotBeChangedWarning') || '⚠️ Game email cannot be changed.'}
              FormHelperTextProps={{ sx: { color: '#ff6b6b', fontWeight: 600, fontSize: '12px' } }}
              InputProps={{
                readOnly: true,
              }}
            />
          ))}
        </Box>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <TextField
            fullWidth
            type={showCurrent ? 'text' : 'password'}
            label={__('currentPassword') || 'Current Password'}
            variant="outlined"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock size={16} style={{ color: 'var(--text-muted)' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowCurrent(!showCurrent)}
                    edge="end"
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <TextField
            fullWidth
            type={showNew ? 'text' : 'password'}
            label={__('newPassword') || 'New Password'}
            variant="outlined"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock size={16} style={{ color: 'var(--text-muted)' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowNew(!showNew)}
                    edge="end"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <TextField
            fullWidth
            type={showConfirm ? 'text' : 'password'}
            label={__('confirmPassword') || 'Confirm Password'}
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock size={16} style={{ color: 'var(--text-muted)' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirm(!showConfirm)}
                    edge="end"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            sx={{ fontWeight: 700, mt: 1, height: '48px', fontSize: '14px' }}
          >
            {__('updatePassword') || 'Update Password'}
          </Button>
        </form>
      </Paper>
    </Box>
  )
}
