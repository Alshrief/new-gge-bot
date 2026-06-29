import * as React from 'react'
import { Card, CardContent, Typography, Button, Box, Grid, Alert } from '@mui/material'
import { Download, Smartphone, Monitor, CheckCircle, Info, Sparkles, Share2 } from 'lucide-react'

export default function DownloadPWA({ installPrompt, __, languageCode }) {
  const [isInstalled, setIsInstalled] = React.useState(false)

  React.useEffect(() => {
    // Check if app is running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true
    setIsInstalled(isStandalone)
  }, [])

  const handleInstallClick = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    console.log(`PWA installation outcome: ${outcome}`)
  }

  const isRtl = languageCode === 'ar'

  const t = {
    title: isRtl ? 'تحميل تطبيق EGY BOT' : 'Download EGY BOT App',
    subtitle: isRtl ? 'ثبّت البرنامج كـتطبيق مستقل على هاتفك أو جهاز الكمبيوتر للوصول السريع والأداء الأفضل' : 'Install EGY BOT as a standalone app on your mobile or desktop for fast access and optimized performance.',
    installBtn: isRtl ? 'تثبيت البرنامج الآن' : 'Install Application Now',
    installedTitle: isRtl ? 'التطبيق مثبت بالفعل!' : 'Application Installed!',
    installedDesc: isRtl ? 'يعمل برنامج EGY BOT حالياً كتطبيق مستقل على جهازك بنجاح.' : 'EGY BOT is currently running as a native app on your device.',
    advantagesTitle: isRtl ? 'مميزات تطبيق الـ PWA' : 'Why Install EGY BOT PWA?',
    adv1: isRtl ? 'وصول بنقرة واحدة من الشاشة الرئيسية دون فتح المتصفح' : 'One-click launch directly from your home screen.',
    adv2: isRtl ? 'واجهة نظيفة وخفيفة خالية من شريط عناوين المتصفح المزدحم' : 'Clean interface without browser address bar clutter.',
    adv3: isRtl ? 'تحديثات تلقائية في الخلفية دون الحاجة لتنزيلات يدوية' : 'Automatic background updates without manual downloads.',
    adv4: isRtl ? 'أداء أسرع واستهلاك أقل للبطارية والبيانات' : 'Faster performance and reduced battery/data consumption.',
    platformsTitle: isRtl ? 'تعليمات التثبيت حسب جهازك' : 'Installation Guide per Device',
    iosTitle: isRtl ? 'أجهزة الآيفون والآيباد (Safari)' : 'Apple iOS (Safari Browser)',
    iosStep1: isRtl ? 'افتح الموقع في متصفح Safari الرسمي.' : 'Open this website inside the official Safari browser.',
    iosStep2: isRtl ? 'اضغط على زر "مشاركة" (Share) في شريط الأدوات بالأسفل.' : 'Tap the "Share" button in the bottom navigation bar.',
    iosStep3: isRtl ? 'اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).' : 'Select "Add to Home Screen" from the menu options.',
    iosStep4: isRtl ? 'اضغط على "إضافة" (Add) في الزاوية العلوية لتأكيد التثبيت.' : 'Tap "Add" in the top corner to complete the installation.',
    androidTitle: isRtl ? 'أجهزة الأندرويد والكروم' : 'Android & Google Chrome',
    androidStep1: isRtl ? 'افتح الموقع في متصفح Google Chrome.' : 'Open this website inside Google Chrome browser.',
    androidStep2: isRtl ? 'اضغط على زر "تثبيت" المتاح في صفحتنا أو شريط العنوان.' : 'Tap the "Install" button on this page or the address bar.',
    androidStep3: isRtl ? 'إذا لم يظهر، اضغط على زر القائمة (⋮) ثم اختر "تثبيت التطبيق".' : 'Or open Chrome menu (⋮) and select "Install App".',
    desktopTitle: isRtl ? 'أجهزة الكمبيوتر (Windows / Mac)' : 'Desktop (Windows & macOS Chrome/Edge)',
    desktopStep1: isRtl ? 'افتح الموقع في متصفح Chrome أو Edge.' : 'Open this website in Chrome or Microsoft Edge browser.',
    desktopStep2: isRtl ? 'اضغط على أيقونة الشاشة الصغيرة (+ / سهم التثبيت) في شريط العنوان.' : 'Click the "Install" icon (monitor with plus/arrow) in the address bar.',
    desktopStep3: isRtl ? 'اضغط على "تثبيت" (Install) لتأكيد تثبيت EGY BOT على سطح المكتب.' : 'Confirm by clicking "Install" to create a desktop shortcut.',
    infoNote: isRtl ? 'تطبيق ويب تقدمي (PWA) يعتمد على تكنولوجيا الويب الحديثة ولا يحتاج للتحميل من متجر التطبيقات.' : 'Progressive Web App (PWA) uses modern web standards and does not require downloads from Google Play or App Store.'
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* Header section with vibrant look */}
      <Box 
        sx={{ 
          background: 'linear-gradient(135deg, rgba(0, 189, 166, 0.15) 0%, rgba(90, 180, 220, 0.05) 100%)',
          border: '1px solid rgba(0, 189, 166, 0.25)',
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          mb: 4,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ position: 'absolute', top: -20, right: -20, opacity: 0.1, color: '#00bda6' }}>
          <Download size={140} />
        </Box>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Sparkles size={22} className="text-accent" style={{ color: '#00bda6' }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff' }}>
              {t.title}
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: '700px', mb: 3, fontSize: '15px', lineHeight: 1.6 }}>
            {t.subtitle}
          </Typography>

          {isInstalled ? (
            <Alert 
              icon={<CheckCircle size={20} />} 
              severity="success" 
              sx={{ 
                background: 'rgba(46, 125, 50, 0.1)', 
                color: '#4caf50', 
                border: '1px solid rgba(46, 125, 50, 0.3)',
                borderRadius: 2,
                maxWidth: '550px'
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t.installedTitle}</Typography>
              <Typography variant="body2">{t.installedDesc}</Typography>
            </Alert>
          ) : installPrompt ? (
            <Button
              variant="contained"
              size="large"
              onClick={handleInstallClick}
              startIcon={<Download size={20} />}
              sx={{
                background: 'linear-gradient(135deg, #00bda6 0%, #008f7e 100%)',
                color: '#fff',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                borderRadius: 3,
                boxShadow: '0 8px 24px rgba(0, 189, 166, 0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #00d4bc 0%, #008f7e 100%)',
                  boxShadow: '0 12px 30px rgba(0, 189, 166, 0.5)',
                }
              }}
            >
              {t.installBtn}
            </Button>
          ) : (
            <Alert 
              icon={<Info size={20} />} 
              severity="info" 
              sx={{ 
                background: 'rgba(2, 136, 209, 0.1)', 
                color: '#0288d1', 
                border: '1px solid rgba(2, 136, 209, 0.3)',
                borderRadius: 2,
                maxWidth: '650px'
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.infoNote}</Typography>
            </Alert>
          )}
        </Box>
      </Box>

      {/* Grid columns */}
      <Grid container spacing={4}>
        {/* Left column: Advantages */}
        <Grid item xs={12} lg={4}>
          <Card 
            sx={{ 
              height: '100%', 
              background: 'rgba(255, 255, 255, 0.02)', 
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 3
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', mb: 3, display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Sparkles size={18} className="text-accent" style={{ color: '#00bda6' }} />
                {t.advantagesTitle}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{ p: 1, height: 'fit-content', borderRadius: 2, background: 'rgba(0, 189, 166, 0.1)', color: '#00bda6' }}>
                    <Smartphone size={20} />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5, mt: 0.5 }}>
                    {t.adv1}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{ p: 1, height: 'fit-content', borderRadius: 2, background: 'rgba(0, 189, 166, 0.1)', color: '#00bda6' }}>
                    <Monitor size={20} />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5, mt: 0.5 }}>
                    {t.adv2}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{ p: 1, height: 'fit-content', borderRadius: 2, background: 'rgba(0, 189, 166, 0.1)', color: '#00bda6' }}>
                    <CheckCircle size={20} />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5, mt: 0.5 }}>
                    {t.adv3}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{ p: 1, height: 'fit-content', borderRadius: 2, background: 'rgba(0, 189, 166, 0.1)', color: '#00bda6' }}>
                    <Download size={20} />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5, mt: 0.5 }}>
                    {t.adv4}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right column: Instructions for various devices */}
        <Grid item xs={12} lg={8}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', mb: 3 }}>
            {t.platformsTitle}
          </Typography>

          <Grid container spacing={3}>
            {/* iOS Card */}
            <Grid item xs={12} md={6}>
              <Card 
                sx={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 3,
                  height: '100%'
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{ p: 1, borderRadius: 2, background: 'rgba(90, 180, 220, 0.1)', color: '#5ab4dc' }}>
                      <Smartphone size={20} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
                      {t.iosTitle}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ color: '#00bda6', fontWeight: 800 }}>1.</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.iosStep1}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ color: '#00bda6', fontWeight: 800 }}>2.</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                        {t.iosStep2} <Share2 size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ color: '#00bda6', fontWeight: 800 }}>3.</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.iosStep3}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ color: '#00bda6', fontWeight: 800 }}>4.</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.iosStep4}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Android Card */}
            <Grid item xs={12} md={6}>
              <Card 
                sx={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 3,
                  height: '100%'
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{ p: 1, borderRadius: 2, background: 'rgba(0, 189, 166, 0.1)', color: '#00bda6' }}>
                      <Download size={20} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
                      {t.androidTitle}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ color: '#00bda6', fontWeight: 800 }}>1.</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.androidStep1}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ color: '#00bda6', fontWeight: 800 }}>2.</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.androidStep2}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ color: '#00bda6', fontWeight: 800 }}>3.</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.androidStep3}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Desktop Card */}
            <Grid item xs={12}>
              <Card 
                sx={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 3
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{ p: 1, borderRadius: 2, background: 'rgba(255, 255, 255, 0.05)', color: '#fff' }}>
                      <Monitor size={20} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
                      {t.desktopTitle}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ color: '#00bda6', fontWeight: 800 }}>1.</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.desktopStep1}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ color: '#00bda6', fontWeight: 800 }}>2.</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.desktopStep2}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography sx={{ color: '#00bda6', fontWeight: 800 }}>3.</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t.desktopStep3}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  )
}
