import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { CookiesProvider } from 'react-cookie'

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
    <CookiesProvider defaultSetOptions={{ path: '/' }}>
    <App />
    </CookiesProvider>
  // </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister().then(success => {
        if (success) console.log('Service Worker unregistered successfully.');
      });
    }
  });
}