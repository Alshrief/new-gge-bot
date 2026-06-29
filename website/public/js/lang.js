// Language Controller for static pages (landing.html, signin.html, signup.html)

const translations = {
  en: {
    // General
    dev_by: "Dev By ",
    facebook: "Facebook",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    discord: "Discord",
    
    // Sign In Page
    signin_title: "EGY BOT - Login to Goodgame Empire Automation Board",
    signin_welcome: "Welcome back",
    signin_subtitle: "Sign in to your EGY BOT account",
    signin_warning: "💡 <strong>Notice:</strong> If you are signing in using email, please write your <strong>game-registered email</strong>.",
    signin_placeholder_email: "Username or Game Email",
    signin_placeholder_password: "Password",
    signin_keep_signed_in: "Keep me signed in",
    signin_btn: "Sign In",
    signin_no_account: "Don't have an account? ",
    signup_link: "Sign Up",
    
    // Sign Up Page
    signup_title: "EGY BOT - Create Account for Goodgame Empire Bot",
    signup_welcome: "Create Account",
    signup_subtitle: "Get started with your game automation dashboard",
    signup_warning: "⚠️ <strong>VERY IMPORTANT WARNING:</strong><br>The <strong>Game Email</strong> and <strong>Server</strong> must match your in-game registered account details exactly! You will NOT be able to change your email or server after registration!",
    signup_placeholder_username: "Username (Dashboard Login)",
    signup_placeholder_email: "Game Email (GGE Account)",
    signup_placeholder_password: "Password (Dashboard)",
    signup_placeholder_server: "Select Game Server...",
    signup_search_server: "Search servers...",
    signup_loading_servers: "Loading servers...",
    signup_error_loading_servers: "Error loading servers.",
    signup_btn: "Sign Up",
    signup_already_account: "Already have an account? ",
    signin_link: "Sign In",
    
    // Runtime errors/notifications
    err_required_fields: "All fields are required.",
    err_invalid_credentials: "The credentials that you provided were invalid.",
    err_network: "An error occurred. Please try again.",
    success_registration: "Registration successful! Redirecting...",
    err_registration_failed: "Registration failed."
  },
  ar: {
    // General
    dev_by: "تطوير بواسطة ",
    facebook: "فيسبوك",
    whatsapp: "واتساب",
    telegram: "تليجرام",
    discord: "ديسكورد",
    
    // Sign In Page
    signin_title: "إيجي بوت - تسجيل الدخول لوحة أتمتة Goodgame Empire",
    signin_welcome: "مرحباً بك مجدداً",
    signin_subtitle: "تسجيل الدخول إلى حسابك في EGY BOT",
    signin_warning: "💡 <strong>تنبيه:</strong> إذا كنت تسجل الدخول باستخدام البريد الإلكتروني، يرجى كتابة <strong>بريدك الإلكتروني المسجل في اللعبة</strong>.",
    signin_placeholder_email: "اسم المستخدم أو إيميل اللعبة",
    signin_placeholder_password: "كلمة المرور",
    signin_keep_signed_in: "تذكر تسجيل دخولي",
    signin_btn: "تسجيل الدخول",
    signin_no_account: "ليس لديك حساب؟ ",
    signup_link: "إنشاء حساب",
    
    // Sign Up Page
    signup_title: "إيجي بوت - إنشاء حساب بوت Goodgame Empire",
    signup_welcome: "إنشاء حساب جديد",
    signup_subtitle: "ابدأ تشغيل لوحة التحكم لأتمتة لعبتك",
    signup_warning: "⚠️ <strong>تنبيه هام جداً:</strong><br>يجب أن يكون <strong>البريد الإلكتروني (Game Email)</strong> و <strong>السيرفر</strong> مطابقين تماماً لبيانات حسابك المسجل داخل اللعبة بالملي! لن تتمكن من تغيير البريد الإلكتروني أو السيرفر الخاص بالحساب نهائياً بعد إنشاء الحساب!",
    signup_placeholder_username: "اسم مستخدم للوحة (Dashboard Login)",
    signup_placeholder_email: "البريد الإلكتروني للعبة (GGE Account)",
    signup_placeholder_password: "كلمة المرور للوحة (Password)",
    signup_placeholder_server: "اختر سيرفر اللعبة...",
    signup_search_server: "البحث عن سيرفر...",
    signup_loading_servers: "جاري تحميل السيرفرات...",
    signup_error_loading_servers: "خطأ في تحميل السيرفرات.",
    signup_btn: "إنشاء الحساب",
    signup_already_account: "لديك حساب بالفعل؟ ",
    signin_link: "تسجيل الدخول",
    
    // Runtime errors/notifications
    err_required_fields: "جميع الحقول مطلوبة.",
    err_invalid_credentials: "بيانات الدخول التي أدخلتها غير صالحة.",
    err_network: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    success_registration: "تم تسجيل الحساب بنجاح! جاري التوجيه...",
    err_registration_failed: "فشل إنشاء الحساب."
  }
};

const serverDetailsMapAr = {
  'generic_country_international': { flag: '🌐', name: 'العالمي (International)' },
  'generic_country_de': { flag: '🇩🇪', name: 'ألمانيا' },
  'generic_country_fr': { flag: '🇫🇷', name: 'فرنسا' },
  'generic_country_cz': { flag: '🇨🇿', name: 'التشيك' },
  'generic_country_pl': { flag: '🇵🇱', name: 'بولندا' },
  'generic_language_pt': { flag: '🇵🇹', name: 'البرتغال/البرازيل' },
  'generic_country_es': { flag: '🇪🇸', name: 'إسبانيا' },
  'generic_country_it': { flag: '🇮🇹', name: 'إيطاليا' },
  'generic_country_tr': { flag: '🇹🇷', name: 'تركيا' },
  'generic_country_nl': { flag: '🇳🇱', name: 'هولندا' },
  'generic_country_hu': { flag: '🇭🇺', name: 'المجر' },
  'generic_language_skn': { flag: '🇸🇪', name: 'إسكندنافيا' },
  'generic_country_ru': { flag: '🇷🇺', name: 'روسيا' },
  'generic_country_ro': { flag: '🇷🇴', name: 'رومانيا' },
  'generic_country_bg': { flag: '🇧🇬', name: 'بلغاريا' },
  'generic_country_sk': { flag: '🇸🇰', name: 'سلوفاكيا' },
  'generic_country_gb': { flag: '🇬🇧', name: 'المملكة المتحدة' },
  'generic_country_br': { flag: '🇧🇷', name: 'البرازيل' },
  'generic_country_us': { flag: '🇺🇸', name: 'أمريكا' },
  'generic_country_au': { flag: '🇦🇺', name: 'أستراليا' },
  'generic_country_kr': { flag: '🇰🇷', name: 'كوريا الجنوبية' },
  'generic_country_jp': { flag: '🇯🇵', name: 'اليابان' },
  'generic_country_his': { flag: '🇪🇸', name: 'أمريكا اللاتينية' },
  'generic_country_in': { flag: '🇮🇳', name: 'الهند' },
  'generic_country_cn': { flag: '🇨🇳', name: 'الصين' },
  'generic_country_gr': { flag: '🇬🇷', name: 'اليونان' },
  'generic_country_lt': { flag: '🇱🇹', name: 'ليتوانيا' },
  'generic_country_sa': { flag: '🇸🇦', name: 'السعودية' },
  'generic_country_ae': { flag: '🇦🇪', name: 'الإمارات' },
  'generic_country_eg': { flag: '🇪🇬', name: 'مصر' },
  'generic_country_arab': { flag: '🌐', name: 'العربي (Arabic)' },
  'generic_country_asia': { flag: '🌐', name: 'آسيا' },
  'generic_country_hant': { flag: '🇹🇼', name: 'تايوان/هونغ كونغ' },
  'generic_country_world': { flag: '🌐', name: 'العالم' }
};

function getLang() {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; lang=`);
  if (parts.length === 2) {
    const cookieLang = parts.pop().split(';').shift();
    if (cookieLang === 'ar' || cookieLang === 'en') {
      return cookieLang;
    }
  }
  // Fallback to browser language
  if (navigator.language && navigator.language.startsWith('ar')) {
    return 'ar';
  }
  return 'en'; // Default fallback
}

function setLangCookie(lang) {
  document.cookie = `lang=${lang}; max-age=31536000; path=/`;
  applyLanguage(lang);
}

function applyLanguage(lang) {
  const isRtl = lang === 'ar';
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  
  if (isRtl) {
    document.body.classList.remove('lang-en');
    document.body.classList.add('lang-ar');
  } else {
    document.body.classList.remove('lang-ar');
    document.body.classList.add('lang-en');
  }

  // Apply translations
  const dict = translations[lang] || translations['en'];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const trans = dict[key];
    if (!trans) return;

    if (el.tagName === 'INPUT') {
      el.placeholder = trans;
    } else {
      el.innerHTML = trans;
    }
  });

  // Update switcher buttons text/design
  const switcherBtns = document.querySelectorAll('.lang-switch-btn');
  switcherBtns.forEach(btn => {
    if (lang === 'ar') {
      btn.innerHTML = '🌐 English (EN)';
    } else {
      btn.innerHTML = '🌐 العربية (AR)';
    }
  });
  
  // Custom server mapping updates on signup page if function exists
  if (typeof updateServerListLanguage === 'function') {
    updateServerListLanguage(lang);
  }
}

function toggleLanguage() {
  const currentLang = getLang();
  const newLang = currentLang === 'ar' ? 'en' : 'ar';
  setLangCookie(newLang);
}

function getTranslation(key) {
  const lang = getLang();
  return translations[lang]?.[key] || translations['en']?.[key] || key;
}

// Attach globally
window.getLang = getLang;
window.setLangCookie = setLangCookie;
window.toggleLanguage = toggleLanguage;
window.getTranslation = getTranslation;
window.serverDetailsMapAr = serverDetailsMapAr;

// Initialize on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    applyLanguage(getLang());
  });
} else {
  applyLanguage(getLang());
}
