import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registrarServiceWorker } from './lib/actualizacion-pwa'

// PWA instalable: la interfaz carga desde la caché del Service Worker (los datos no)
registrarServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
