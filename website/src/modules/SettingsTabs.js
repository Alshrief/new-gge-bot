import * as React from 'react'
import { Box, Paper, Tabs, Tab } from '@mui/material'
import TelegramSettings from './TelegramSettings'
import ChangePasswordForm from './ChangePasswordForm'
import { Bell, KeyRound } from 'lucide-react'

export default function SettingsTabs({ ws, __, profile, users }) {
  const [tabValue, setTabValue] = React.useState(0)

  return (
    <Box className="animate-fade-in" sx={{ width: '100%' }}>
      <Paper className="premium-glass-card" sx={{ p: 0.5, mb: 3, background: 'rgba(18, 21, 34, 0.4) !important' }}>
        <Tabs
          value={tabValue}
          onChange={(e, val) => setTabValue(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{
            '& .MuiTabs-indicator': {
              height: '3px',
              borderRadius: '3px',
            }
          }}
        >
          <Tab 
            icon={<Bell size={18} style={{ marginRight: '8px' }} />} 
            label={__('telegramSettings') || 'إشعارات التليجرام'} 
            iconPosition="start"
            sx={{ fontWeight: 700, minHeight: '48px' }}
          />
          <Tab 
            icon={<KeyRound size={18} style={{ marginRight: '8px' }} />} 
            label={__('changePassword') || 'تغيير كلمة المرور'} 
            iconPosition="start"
            sx={{ fontWeight: 700, minHeight: '48px' }}
          />
        </Tabs>
      </Paper>

      <Box sx={{ mt: 1 }} className="animate-slide-up">
        {tabValue === 0 && <TelegramSettings ws={ws} __={__} />}
        {tabValue === 1 && <ChangePasswordForm ws={ws} __={__} profile={profile} users={users} />}
      </Box>
    </Box>
  )
}
