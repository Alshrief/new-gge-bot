let recaptchaEnabled = false

addEventListener("DOMContentLoaded", async () => {
  document.getElementById("login-form").addEventListener('submit', login)

  try {
    const configRes = await fetch('/api/recaptcha-config')
    const config = await configRes.json()
    if (config.enabled && config.siteKey) {
      recaptchaEnabled = true
      window.onRecaptchaLoad = () => {
        grecaptcha.render('recaptcha-container', {
          'sitekey': config.siteKey,
          'theme': 'dark'
        })
      }
      const script = document.createElement('script')
      script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  } catch (e) {
    console.warn("Failed to check reCAPTCHA configuration:", e)
  }
})

async function login(event) {
  event.preventDefault()
  
  let loginFormElement = document.getElementById("login-form")

  let emailOrName = loginFormElement.querySelector("#email_name").value
  let password = loginFormElement.querySelector("#password").value
  let loginInfoBannerElement = loginFormElement.querySelector("#login-info-banner")
  let isChecked = loginFormElement.querySelector('#remember-password').checked

  loginInfoBannerElement.innerHTML = ""
  if(emailOrName.length === 0 || password.length === 0)
  {
    loginInfoBannerElement.innerHTML = window.getTranslation ? window.getTranslation("err_invalid_credentials") : "The credentials that you provided were invalid"
    return false
  }

  let recaptchaToken = null
  if (recaptchaEnabled) {
    try {
      recaptchaToken = grecaptcha.getResponse()
    } catch (e) {}
    if (!recaptchaToken) {
      loginInfoBannerElement.innerHTML = window.getTranslation ? window.getTranslation("err_recaptcha_required") : "Please complete the CAPTCHA check.<br>يرجى إكمال اختبار التحقق (CAPTCHA)."
      return false
    }
  }

  let json = await (await fetch(`${location.protocol === 'https:' ? "https" : "http"}://${window.location.hostname}:${location.port}/api`, {
    method: "POST",
    body: JSON.stringify({ id: 0, email_name: emailOrName, password: password, recaptchaToken: recaptchaToken }),
    headers: {
      "Content-type": "application/json; charset=UTF-8"
    }
  })).json()

  switch(Number(json.id))
  {
    case 0: //Logged in
    if(json.r != 0) {
      loginInfoBannerElement.innerHTML = json.error
      if (recaptchaEnabled) {
        try { grecaptcha.reset() } catch (e) {}
      }
      return false
    }
    if(!isChecked)
      document.cookie = `uuid=true; path=/`
    else
      document.cookie = `uuid=true; max-age=31536000; path=/`

    window.location.replace("/index.html")
  }
  return false
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister().then(success => {
        if (success) console.log('Service Worker unregistered successfully.');
      });
    }
  });
}