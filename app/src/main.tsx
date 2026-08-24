import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { keepUpToDate } from './pwa'
import './index.css'

keepUpToDate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
