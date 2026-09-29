import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registrarServiceWorker } from './lib/actualizacion-pwa'

// PWA: la app abre sin conexión en el mostrador (Módulo 11)
registrarServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
