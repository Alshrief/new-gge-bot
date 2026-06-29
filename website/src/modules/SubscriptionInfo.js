import * as React from 'react'
import { Box, Typography, Paper, Grid, Button, List, ListItem, ListItemIcon, ListItemText, Alert, Snackbar } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import StarIcon from '@mui/icons-material/Star'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import { ErrorType, ActionType } from '../types.js'

export default function SubscriptionInfo({ username, maxAccounts, profile, ws, __ }) {
  const currentPlan = profile?.subscriptionPlan || 'none'
  const expiry = profile?.subscriptionExpiry
  const alliance = profile?.subscriptionAlliance
  const credits = profile?.credits || 0

  const [snackbar, setSnackbar] = React.useState({ open: false, message: '', severity: 'info' })
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const handleWsMessage = (msg) => {
      try {
        const [errVal, action, obj] = JSON.parse(msg.data.toString())
        if (action === ActionType.RenewSubscription) {
          setLoading(false)
          if (errVal === ErrorType.Success) {
            setSnackbar({ open: true, message: __('subscriptionRenewedSuccess') || 'Subscription renewed successfully!', severity: 'success' })
          } else {
            const errorMsg = obj.error === 'insufficientCredits' 
              ? (__('insufficientCredits') || 'Insufficient credits. Please contact the administrator.')
              : (obj.error || 'Failed to renew subscription.')
            setSnackbar({ open: true, message: errorMsg, severity: 'error' })
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    
    ws.addEventListener('message', handleWsMessage)
    return () => ws.removeEventListener('message', handleWsMessage)
  }, [ws])

  const handleRenewSubscription = () => {
    if (credits < 300) {
      setSnackbar({ open: true, message: __('insufficientCredits') || 'Insufficient credits. Please contact the Admin to buy credits.', severity: 'error' })
      return
    }
    setLoading(true)
    ws.send(JSON.stringify([
      ErrorType.Success,
      ActionType.RenewSubscription,
      {}
    ]))
  }

  const getPlanName = () => {
    if (profile?.privilege === 1) return __('administrator') || 'مدير النظام'
    if (currentPlan === 'pro') return __('proPlanName') || 'الباقة الاحترافية (Pro)'
    if (currentPlan === 'enterprise') return __('enterprisePlanName') || 'باقة إنتربرايز (Enterprise)'
    return __('noSubscription') || 'لا يوجد اشتراك نشط'
  }

  const getPlanDescription = () => {
    if (profile?.privilege === 1) return __('adminPlanDesc') || 'حسابك هو مدير النظام مع صلاحيات كاملة وعدد حسابات غير محدود.'
    if (currentPlan === 'pro') {
      return `${__('currentPlanDescPro') || 'أنت مشترك حالياً في الباقة الاحترافية (Pro).'} (${__('proPlanLimit') || 'تشغيل حساب لعبة واحد فقط'})`
    }
    if (currentPlan === 'enterprise') {
      let desc = __('currentPlanDescEnterprise') || 'أنت مشترك حالياً في باقة إنتربرايز (Enterprise).'
      if (alliance) {
        desc += ` - ${__('belongsToAlliance')?.replace('%s', alliance) || `تابعة لاشتراك (تحالف ${alliance})`}`
      }
      return desc
    }
    return __('noSubscriptionDesc') || 'ليس لديك أي اشتراك نشط حالياً. يرجى تجديد الاشتراك للتمكن من إضافة حسابات اللعبة وتشغيل البوت.'
  }

  return (
    <Box sx={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
      
      {/* Current Plan & Credits Summary Wallet */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        
        {/* Subscription Status */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(90, 180, 220, 0.02) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {__('mySubscription') || 'اشتراكي الحالي'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {__('welcomeUser') || 'مرحباً بالعميل'} <strong>{username}</strong>. {getPlanDescription()}
                </Typography>
                {expiry && currentPlan !== 'none' && (
                  <Typography variant="caption" display="block" sx={{ mt: 1.5, color: '#f43f5e', fontWeight: 700 }}>
                    📅 {__('subscriptionExpiry') || 'تاريخ الانتهاء'}: {expiry}
                  </Typography>
                )}
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{__('planType') || 'فئة الخطة'}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#00bda6', mt: 0.5 }}>
                  {getPlanName()}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Credits Wallet */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.04) 0%, rgba(255, 215, 0, 0.01) 100%)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <AccountBalanceWalletIcon sx={{ color: '#ffd700', fontSize: '38px', mb: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>AVAILABLE BALANCE</Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#ffd700', my: 0.5 }}>{credits} EGP</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              1 Credit = 1 EGP
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Available Plans */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
        💎 {__('availablePlans') || 'الخطط والباقات المتاحة'}
      </Typography>

      <Grid container spacing={3}>
        {/* Pro Plan */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3.5,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              borderColor: currentPlan === 'pro' ? '#00bda6 !important' : 'rgba(255,255,255,0.05)',
              background: 'linear-gradient(180deg, rgba(0, 189, 166, 0.05) 0%, rgba(12, 14, 22, 0.5) 100%)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ position: 'absolute', top: 12, right: 12, background: '#00bda6', color: '#fff', fontSize: '10px', fontWeight: 700, px: 1.5, py: 0.5, borderRadius: '10px' }}>
              RECOMMENDED
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#00bda6', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon fontSize="small" /> {__('proPlanName') || 'الباقة الاحترافية (Pro)'}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, mb: 1 }}>
                300 Credits <span style={{ fontSize: '14px', color: '#888', fontWeight: 500 }}>/ 30 {__('days') || 'يوم'}</span>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {__('perfectForMulti') || 'مثالية للاعبين متعددي الحسابات'}
              </Typography>
            </Box>

            <List sx={{ mb: 4, flexGrow: 1 }}>
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36, color: '#00bda6' }}><CheckCircleOutlineIcon /></ListItemIcon>
                <ListItemText primary={__('proPlanLimit') || 'تشغيل حساب لعبة واحد فقط (1 Worker)'} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36, color: '#00bda6' }}><CheckCircleOutlineIcon /></ListItemIcon>
                <ListItemText primary={__('telegramAlerts') || 'إشعارات التليجرام بالكامل'} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36, color: '#00bda6' }}><CheckCircleOutlineIcon /></ListItemIcon>
                <ListItemText primary={__('safeProxies') || 'حماية كاملة بالبروكسي'} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36, color: '#00bda6' }}><CheckCircleOutlineIcon /></ListItemIcon>
                <ListItemText primary={__('prioritySupport') || 'دعم فني سريع وأولوية تحديثات'} />
              </ListItem>
            </List>

            <Button
              variant="contained"
              disabled={loading}
              onClick={handleRenewSubscription}
              sx={{
                background: 'linear-gradient(135deg, #00bda6 0%, #009d87 100%) !important',
                boxShadow: '0 4px 15px rgba(0, 189, 166, 0.3)',
                fontWeight: 800
              }}
              fullWidth
            >
              {loading ? 'Processing...' : (currentPlan === 'pro' ? 'Extend Plan (300 Credits)' : 'Activate Pro Plan (300 Credits)')}
            </Button>
          </Paper>
        </Grid>

        {/* Enterprise Plan */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3.5,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              borderColor: currentPlan === 'enterprise' ? '#5ab4dc !important' : 'rgba(255,255,255,0.05)',
              borderStyle: 'solid',
              borderWidth: 1
            }}
          >
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#5ab4dc', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <WorkspacePremiumIcon fontSize="small" /> {__('enterprisePlanName') || 'باقة إنتربرايز (Enterprise)'}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 1.5, mb: 1, fontSize: '20px', color: '#fff' }}>
                {__('enterprisePlanPrice') || 'بالاتفاق مع صاحب الخدمة الأساسي'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {__('enterprisePlanPeriod') || 'كل شيء مخصص بالاتفاق مع الإدارة'}
              </Typography>
            </Box>

            <List sx={{ mb: 4, flexGrow: 1 }}>
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36, color: '#5ab4dc' }}><CheckCircleOutlineIcon /></ListItemIcon>
                <ListItemText primary={__('enterprisePlanLimit') || 'عدد حسابات غير محدود (حسب الطلب)'} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36, color: '#5ab4dc' }}><CheckCircleOutlineIcon /></ListItemIcon>
                <ListItemText primary={__('dedicatedSupport') || 'دعم فني مخصص وخادم خاص'} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 36, color: '#5ab4dc' }}><CheckCircleOutlineIcon /></ListItemIcon>
                <ListItemText primary={__('enterprisePlanDesc') || 'مصممة للتحالفات الكبرى والمحترفين'} />
              </ListItem>
            </List>

            <Button
              variant="outlined"
              color="primary"
              disabled={currentPlan === 'enterprise'}
              onClick={() => {
                setSnackbar({ open: true, message: document.documentElement.dir === 'rtl' ? 'يرجى التواصل مع الإدارة لتفعيل باقة إنتربرايز.' : 'Please contact the administrator to activate the Enterprise plan.', severity: 'info' })
              }}
              fullWidth
            >
              {currentPlan === 'enterprise' ? (__('trialActivated') || 'مفعلة حالياً') : (__('contactSales') || 'تواصل مع الإدارة للتفعيل')}
            </Button>
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
