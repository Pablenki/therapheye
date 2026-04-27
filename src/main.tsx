import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './accessibility.css'  // ← AGREGAR ESTA LÍNEA
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registrar Service Worker para PWA (offline + instalable)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}