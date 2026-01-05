import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { BrandingProvider } from './context/BrandingContext' // ✅ Importar

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrandingProvider> {/* ✅ Envolver */}
        <App />
      </BrandingProvider>
    </ThemeProvider>
  </StrictMode>,
)