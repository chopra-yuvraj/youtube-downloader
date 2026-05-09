import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Register the service worker for PWA support
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const { registerSW } = await import('virtual:pwa-register')
      registerSW({
        onNeedRefresh() {
          // New version available — could show a toast, but auto-update is fine
        },
        onOfflineReady() {
          console.log('AnyDL is ready to work offline')
        },
      })
    } catch (e) {
      // PWA registration may fail in dev — that's fine
      console.warn('PWA registration skipped:', e)
    }
  }
}

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
