import * as React from 'react'
import { Box, Paper, Typography, Accordion, AccordionSummary, AccordionDetails, Grid, Alert, Card, CardContent, Tabs, Tab } from '@mui/material'
import { ChevronDown, BookOpen, KeyRound, FastForward, Shield, Send, Settings, Play, Youtube, VideoOff } from 'lucide-react'

export default function HelpGuide({ languageCode, __ }) {
  const isAr = languageCode === 'ar'
  const [videoTab, setVideoTab] = React.useState(languageCode === 'ar' ? 0 : 1)

  React.useEffect(() => {
    setVideoTab(languageCode === 'ar' ? 0 : 1)
  }, [languageCode])

  const guideContent = {
    en: {
      title: "User Guide & Documentation",
      subtitle: "Learn how to configure your GGE BOT, set up plugins, and optimize your automation.",
      sections: [
        {
          id: "intro",
          title: "1. Getting Started & Logging In",
          icon: <Play size={20} style={{ marginRight: '10px', color: 'var(--accent)' }} />,
          content: (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                Welcome to GGE BOT! The tool is designed to automate game loops efficiently. During registration:
              </Typography>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li>Your <strong>Game Email</strong> serves as your login username for this bot dashboard.</li>
                <li>Your chosen password during signup is your **Dashboard Password** only.</li>
                <li>To start botting, you must provide your actual game password in the Settings menu (Game Password tab).</li>
              </ul>
              <Alert severity="info" sx={{ borderRadius: '8px' }}>
                Always make sure you select the correct Game Server matching your castle to avoid connection failures.
              </Alert>
            </Box>
          )
        },
        {
          id: "passwords",
          title: "2. Game Password vs. Dashboard Password",
          icon: <KeyRound size={20} style={{ marginRight: '10px', color: '#ffb74d' }} />,
          content: (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                It is critical to distinguish between the two passwords:
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ color: 'var(--accent)', fontWeight: 700, mb: 1 }}>
                        Dashboard Password
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                        Used strictly to log into this web panel. Keep it secure and distinct.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ color: '#ffb74d', fontWeight: 700, mb: 1 }}>
                        Game Account Password
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                        Your Goodgame Empire game password. The bot uses this to log into the game servers on your behalf.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Alert severity="warning" sx={{ borderRadius: '8px' }}>
                If you change your GGE game password, you must update it in Settings {"->"} Game Account Password. The bot will automatically restart to connect with the new password.
              </Alert>
            </Box>
          )
        },
        {
          id: "skips",
          title: "3. Integrated Time Skips (Auto-Speed)",
          icon: <FastForward size={20} style={{ marginRight: '10px', color: '#64b5f6' }} />,
          content: (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                Rather than running skips as a separate background task, skip controls are now integrated directly into each plugin. This allows you to fine-tune speeds individually for each feature (e.g. Barons vs Nomads).
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
                How to configure:
              </Typography>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li>Open the configuration menu for any attack plugin (e.g. <strong>Attack Barons</strong>).</li>
                <li>Check the **Use time skips** checkbox to enable skipping cooldowns.</li>
                <li>Select which skip tokens (1 min, 5 min, 10 min, 30 min, 1 hour, 5 hours, 24 hours) the bot is allowed to consume for that specific plugin.</li>
              </ul>
              <Alert severity="info" sx={{ borderRadius: '8px' }}>
                Enabling skips speeds up watchtower cycling and increases the rate of attacks. Choose your allowed skips carefully based on your inventory.
              </Alert>
            </Box>
          )
        },
        {
          id: "proxies",
          title: "4. Proxy Protection Settings",
          icon: <Shield size={20} style={{ marginRight: '10px', color: '#81c784' }} />,
          content: (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                To secure your account and avoid server rate limits or IP flags, we recommend assigning a proxy to your bot instance.
              </Typography>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li>Go to the game account options inside your account settings.</li>
                <li>Enable **Proxy Settings** and select the proxy type (HTTP, HTTPS, SOCKS4, SOCKS5).</li>
                <li>Enter the proxy details using the format: <code>ip:port</code> or <code>ip:port:username:password</code>.</li>
                <li>Use the **Test Proxy** button to verify connection status before starting the bot.</li>
              </ul>
            </Box>
          )
        },
        {
          id: "telegram",
          title: "5. Telegram Real-time Notifications",
          icon: <Send size={20} style={{ marginRight: '10px', color: '#4fc3f7' }} />,
          content: (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                Configure real-time notifications to track bot actions directly on your mobile device:
              </Typography>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li>Enter your Telegram Bot Token and Chat ID under Settings {"->"} Telegram Settings.</li>
                <li>Enable notifications and select which alert categories you wish to receive (e.g., Incoming attacks, Alliance chat, Errors, or Outgoing movements).</li>
              </ul>
            </Box>
          )
        }
      ]
    },
    ar: {
      title: "دليل الاستخدام والشروحات",
      subtitle: "تعرف على كيفية إعداد البوت والبلجنات المتاحة لتحسين كفاءة الأتمتة واللعب.",
      sections: [
        {
          id: "intro",
          title: "1. البداية وتسجيل الدخول",
          icon: <Play size={20} style={{ marginLeft: '10px', color: 'var(--accent)' }} />,
          content: (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                مرحباً بك في لوحة تحكم GGE BOT! تم تصميم الأداة لتنفيذ مهام اللعبة تلقائياً. عند تسجيل حساب جديد:
              </Typography>
              <ul style={{ paddingRight: '20px', paddingLeft: '0px', marginBottom: '16px', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li><strong>البريد الإلكتروني للعبة</strong> هو نفسه اسم المستخدم للدخول إلى لوحة التحكم.</li>
                <li>كلمة المرور التي تدخلها عند التسجيل هي **كلمة مرور لوحة التحكم فقط**.</li>
                <li>لتشغيل البوت، يجب إدخال كلمة مرور حساب اللعبة الفعلي داخل صفحة الإعدادات (تبويب كلمة مرور اللعبة).</li>
              </ul>
              <Alert severity="info" sx={{ borderRadius: '8px', direction: 'rtl', textAlign: 'right' }}>
                تأكد دائماً من اختيار خادم اللعبة الصحيح المطابق لقلعتك لضمان نجاح الاتصال.
              </Alert>
            </Box>
          )
        },
        {
          id: "passwords",
          title: "2. كلمة مرور اللعبة مقابل كلمة مرور اللوحة",
          icon: <KeyRound size={20} style={{ marginLeft: '10px', color: '#ffb74d' }} />,
          content: (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                من الضروري جداً التمييز بين كلمتي المرور:
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ color: 'var(--accent)', fontWeight: 700, mb: 1 }}>
                        كلمة مرور لوحة التحكم
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                        تستخدم فقط لتسجيل الدخول إلى لوحة التحكم الحالية لإدارة الحساب.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <CardContent>
                      <Typography variant="subtitle2" sx={{ color: '#ffb74d', fontWeight: 700, mb: 1 }}>
                        كلمة مرور حساب اللعبة
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                        كلمة مرور حسابك الفعلي داخل Goodgame Empire. يستخدمها البوت لتسجيل الدخول لخوادم اللعبة بالنيابة عنك.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Alert severity="warning" sx={{ borderRadius: '8px', direction: 'rtl', textAlign: 'right' }}>
                في حال قمت بتغيير كلمة مرور حساب اللعبة داخل اللعبة، يجب تحديثها هنا من الإعدادات {"->"} كلمة مرور حساب اللعبة. وسيقوم البوت بإعادة التشغيل تلقائياً للاتصال بالبيانات الجديدة.
              </Alert>
            </Box>
          )
        },
        {
          id: "skips",
          title: "3. ميزة تخطي الوقت (التسريع المدمج)",
          icon: <FastForward size={20} style={{ marginLeft: '10px', color: '#64b5f6' }} />,
          content: (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                بدلاً من استخدام بلجن منفصل لتخطي الوقت، تم دمج إعدادات التخطي داخل كل إضافة على حدة. يتيح لك هذا تحديد سرعة التشغيل ونوع التخطي المناسب لكل حدث بشكل منفصل (مثل البارونات مقابل البدو).
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
                طريقة الإعداد:
              </Typography>
              <ul style={{ paddingRight: '20px', paddingLeft: '0px', marginBottom: '16px', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li>افتح إعدادات أي بلجن هجوم (مثل <strong>هجوم البارونات</strong>).</li>
                <li>قم بتفعيل خيار **استخدام تذاكر الوقت** (Use time skips).</li>
                <li>اختر أنواع تذاكر الوقت المسموح للبوت باستهلاكها لهذا البلجن فقط (دقيقة، 5 دقائق، 10 دقائق، 30 دقيقة، ساعة، 5 ساعات، 24 ساعة).</li>
              </ul>
              <Alert severity="info" sx={{ borderRadius: '8px', direction: 'rtl', textAlign: 'right' }}>
                تفعيل التخطي يزيد بشكل كبير من سرعة الهجمات وإنهاء فترات الانتظار. حدد التذاكر المتاحة في مخزنك بعناية لتجنب نفادها.
              </Alert>
            </Box>
          )
        },
        {
          id: "proxies",
          title: "4. إعدادات حماية البروكسي (Proxy)",
          icon: <Shield size={20} style={{ marginLeft: '10px', color: '#81c784' }} />,
          content: (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                لحماية حسابك وتجنب عمليات الحظر أو قيود الخادم على بروتوكول الإنترنت، ننصح دائماً بربط حسابك ببروكسي خاص.
              </Typography>
              <ul style={{ paddingRight: '20px', paddingLeft: '0px', marginBottom: '16px', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li>اضغط على تعديل الحساب في لوحة التحكم الرئيسية.</li>
                <li>قم بتفعيل **إعدادات البروكسي** واختر النوع (HTTP, HTTPS, SOCKS4, SOCKS5).</li>
                <li>أدخل عنوان البروكسي بالصيغة: <code>ip:port</code> أو <code>ip:port:user:pass</code>.</li>
                <li>اضغط على زر **اختبار البروكسي** للتأكد من اتصاله بشكل صحيح قبل تشغيل البوت.</li>
              </ul>
            </Box>
          )
        },
        {
          id: "telegram",
          title: "5. إشعارات التيليجرام الفورية",
          icon: <Send size={20} style={{ marginLeft: '10px', color: '#4fc3f7' }} />,
          content: (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                يمكنك ضبط إشعارات البوت لتصلك مباشرة على تطبيق تيليجرام لمتابعة حسابك:
              </Typography>
              <ul style={{ paddingRight: '20px', paddingLeft: '0px', marginBottom: '16px', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li>أدخل توكن البوت (Bot Token) ومعرف المحادثة (Chat ID) في صفحة الإعدادات {"->"} إشعارات تليجرام.</li>
                <li>قم بتفعيل الإشعارات وحدد أنواع التنبيهات التي ترغب في استقبالها (الهجمات الواردة، دردشة التحالف، أخطاء البوت، أو الهجمات الصادرة).</li>
              </ul>
            </Box>
          )
        }
      ]
    }
  }

  const content = isAr ? guideContent.ar : guideContent.en

  return (
    <Box sx={{ width: '100%', mt: 2 }} className="animate-fade-in">
      <Paper className="premium-glass-card border-glow-gold" sx={{ p: { xs: 3, md: 4 } }} elevation={0}>
        
        {/* Header */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, textAlign: 'center' }}>
          <Box className="form-header-badge" sx={{ bgcolor: 'rgba(0, 189, 166, 0.08)', color: 'var(--accent)', border: '1px solid rgba(0, 189, 166, 0.2)', mb: 2 }}>
            <BookOpen size={24} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.02em' }}>
            {content.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: '600px' }}>
            {content.subtitle}
          </Typography>
        </Box>

        {/* Video Guide Section */}
        <Box sx={{ maxWidth: '800px', mx: 'auto', mb: 5 }}>
          <Box 
            className="premium-glass-card" 
            sx={{ 
              p: 3, 
              borderRadius: '16px',
              background: 'rgba(18, 21, 34, 0.4) !important',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
              position: 'relative'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2.5 }}>
              <Youtube size={24} style={{ color: '#ff0000' }} />
              <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'Cairo, Outfit, sans-serif' }}>
                {isAr ? 'شرح الفيديو التعليمي' : 'Video Tutorial Guide'}
              </Typography>
            </Box>

            <Tabs
              value={videoTab}
              onChange={(e, newValue) => setVideoTab(newValue)}
              centered
              sx={{
                mb: 3,
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                '& .MuiTab-root': {
                  fontWeight: 800,
                  fontSize: '14.5px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'Cairo, Outfit, sans-serif !important',
                  minWidth: '120px',
                  '&.Mui-selected': {
                    color: 'var(--accent)'
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: 'var(--accent)',
                  height: '3px',
                  borderRadius: '3px'
                }
              }}
            >
              <Tab label={isAr ? 'بالعربي' : 'Arabic'} />
              <Tab label={isAr ? 'بالإنجليزي' : 'English'} />
            </Tabs>

            <Box sx={{ mt: 2 }}>
              {videoTab === 0 ? (
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16/9',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)'
                  }}
                >
                  <iframe
                    src="https://www.youtube.com/embed/4-JKJzagBwk"
                    title={isAr ? 'شرح الاستخدام بالعربي' : 'Arabic Video Guide'}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      border: 0
                    }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 6,
                    px: 3,
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.01)',
                    borderRadius: '12px',
                    border: '1px dashed rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <VideoOff size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.6 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'var(--text-primary)', fontFamily: 'Cairo, Outfit, sans-serif' }}>
                    {isAr ? 'فيديو الشرح باللغة الإنجليزية غير متوفر حالياً' : 'English Video Guide Not Available'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--text-muted)', maxWidth: '400px', fontFamily: 'Cairo, Outfit, sans-serif' }}>
                    {isAr
                      ? 'سوف نقوم بإضافة فيديو الشرح باللغة الإنجليزية في أقرب وقت ممكن.'
                      : 'We will upload the English tutorial video soon. Please check back later.'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* Guide Sections */}
        <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
          {content.sections.map((section) => (
            <Accordion 
              key={section.id} 
              className="premium-glass-card" 
              sx={{ 
                mb: 2, 
                border: '1px solid rgba(255, 255, 255, 0.04) !important',
                background: 'rgba(18, 21, 34, 0.4) !important',
                boxShadow: 'none',
                '&:before': { display: 'none' },
                borderRadius: '12px !important',
                overflow: 'hidden'
              }}
            >
              <AccordionSummary
                expandIcon={<ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
                sx={{ 
                  px: 3,
                  py: 1,
                  '& .MuiAccordionSummary-content': { 
                    alignItems: 'center',
                    display: 'flex',
                    direction: isAr ? 'rtl' : 'ltr'
                  } 
                }}
              >
                {section.icon}
                <Typography sx={{ fontWeight: 700, fontSize: '15px' }}>
                  {section.title}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3, borderTop: '1px solid rgba(255, 255, 255, 0.04)', direction: isAr ? 'rtl' : 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                {section.content}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

      </Paper>
    </Box>
  )
}
