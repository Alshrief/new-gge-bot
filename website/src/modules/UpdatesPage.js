import * as React from 'react'
import {
  Box,
  Typography,
  Grid,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material'
import { Sparkles, CheckCircle2, Calendar, Rocket, Award, Info, ArrowUpRight } from 'lucide-react'

export default function UpdatesPage({ __, languageCode }) {
  const [activeTab, setActiveTab] = React.useState(0)

  // Grab the translation arrays safely
  const completedUpdates = __("completedUpdatesList") || []
  const upcomingUpdates = __("upcomingUpdatesList") || []

  // Ensure they are arrays
  const completedList = Array.isArray(completedUpdates) ? completedUpdates : []
  const upcomingList = Array.isArray(upcomingUpdates) ? upcomingUpdates : []

  return (
    <Box sx={{ width: '100%', mt: 1 }}>
      {/* Header Banner */}
      <Box className="premium-glass-card border-glow-blue" sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Sparkles size={24} style={{ color: 'var(--brand-2, #5ab4dc)' }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {__('updatesAndRoadmap')}
              </Typography>
            </Box>
            <Typography sx={{ color: 'var(--text-2)', fontSize: 13.5, mt: 1, maxW: '600px' }}>
              {languageCode === 'ar' 
                ? 'تابع أحدث الميزات المضافة وخريطة التطوير الخاصة ببوت GGE المطور.'
                : 'Follow the latest features, security enhancements, and upcoming development roadmap of GGE Bot.'}
            </Typography>
          </Grid>
        </Grid>
      </Box>

      {/* Tabs Menu */}
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        sx={{
          mb: 3,
          borderBottom: '1px solid var(--line)',
          '& .MuiTab-root': {
            fontWeight: 800,
            fontSize: '14px',
            color: 'var(--text-2)',
            fontFamily: 'Cairo, Outfit, sans-serif !important',
            padding: '12px 24px',
            '&.Mui-selected': {
              color: 'var(--brand-1, #00bda6)'
            }
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'var(--brand-1, #00bda6)',
            height: '3px',
            borderRadius: '3px'
          }
        }}
      >
        <Tab icon={<CheckCircle2 size={16} />} iconPosition="start" label={__('completedUpdates')} />
        <Tab icon={<Rocket size={16} />} iconPosition="start" label={__('upcomingUpdates')} />
      </Tabs>

      {/* Content Area */}
      {activeTab === 0 ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper className="premium-glass-card border-glow-green" sx={{ p: 3 }} elevation={0}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#10b981' }}>
                <CheckCircle2 size={20} />
                {__('completedUpdates')}
              </Typography>
              <Divider sx={{ mb: 2, borderColor: 'rgba(255, 255, 255, 0.05)' }} />
              
              <List sx={{ p: 0 }}>
                {completedList.map((item, index) => {
                  const parts = item.split(':')
                  const title = parts[0]
                  const description = parts.slice(1).join(':')
                  
                  return (
                    <ListItem 
                      key={index} 
                      alignItems="flex-start"
                      sx={{ 
                        px: 0, 
                        py: 2,
                        borderBottom: index < completedList.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none'
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                        <Award size={18} style={{ color: '#10b981' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography sx={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                            {title}
                          </Typography>
                        }
                        secondary={
                          <Typography sx={{ mt: 0.5, fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                            {description}
                          </Typography>
                        }
                      />
                    </ListItem>
                  )
                })}
              </List>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper className="premium-glass-card border-glow-gold" sx={{ p: 3, height: '100%' }} elevation={0}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: 'var(--warn)' }}>
                <Info size={18} />
                {languageCode === 'ar' ? 'نبذة عن التحديث' : 'Update Summary'}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, mb: 2 }}>
                {languageCode === 'ar'
                  ? 'يتم إصدار تحديثات البوت تلقائياً ومباشرة على خادم الويب الخاص بك. تركز التحديثات الأخيرة على إعادة هيكلة موجات الهجوم ونظام ترتيب الصناديق للأحداث الكبرى وتحسين أمان وثبات الخادم العام وقاعدة البيانات.'
                  : 'Updates are deployed directly to your host dashboard. Recent changes prioritize restructuring attack wave settings, chest organization filters for events, and hardening server endpoints to guarantee privacy.'}
              </Typography>
              <Box 
                sx={{ 
                  p: 2, 
                  borderRadius: '10px', 
                  background: 'rgba(255, 215, 0, 0.05)', 
                  border: '1px solid rgba(255, 215, 0, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Sparkles size={14} style={{ color: 'var(--warn)' }} />
                  {languageCode === 'ar' ? 'أداء قاعدة البيانات' : 'DB Performance'}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {languageCode === 'ar'
                    ? 'نظام الحذف التلقائي يحافظ على حجم قاعدة بيانات SQLite صغيراً وسريعاً عن طريق التخلص من الإشعارات القديمة خلال 24 ساعة.'
                    : 'The automatic pruning routine maintains a lightweight SQLite database structure by purging read and unread messages after 24 hours.'}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper className="premium-glass-card border-glow-blue" sx={{ p: 3 }} elevation={0}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#3b82f6' }}>
                <Rocket size={20} />
                {__('upcomingUpdates')}
              </Typography>
              <Divider sx={{ mb: 2, borderColor: 'rgba(255, 255, 255, 0.05)' }} />

              <List sx={{ p: 0 }}>
                {upcomingList.map((item, index) => {
                  const parts = item.split(':')
                  const title = parts[0]
                  const description = parts.slice(1).join(':')

                  return (
                    <ListItem 
                      key={index} 
                      alignItems="flex-start"
                      sx={{ 
                        px: 0, 
                        py: 2,
                        borderBottom: index < upcomingList.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none'
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                        <ArrowUpRight size={18} style={{ color: '#3b82f6' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography sx={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                            {title}
                          </Typography>
                        }
                        secondary={
                          <Typography sx={{ mt: 0.5, fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                            {description}
                          </Typography>
                        }
                      />
                    </ListItem>
                  )
                })}
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper className="premium-glass-card border-glow-rose" sx={{ p: 3, height: '100%' }} elevation={0}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: '#f43f5e' }}>
                <Calendar size={18} />
                {languageCode === 'ar' ? 'التخطيط المستقبلي' : 'Future Planning'}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                {languageCode === 'ar'
                  ? 'فريق التطوير يعمل بشكل مستمر لإضافة أدوات التحرير التلقائي وحساب الكفاءة. إذا كانت لديك ميزة تقترحها، يمكنك التواصل معنا مباشرة لإدراجها في خططنا القادمة.'
                  : 'Our development cycle is focused on bringing automation tools to all event networks. If you have requests or feature suggestions, feel free to contact us to discuss integrating them.'}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  )
}
