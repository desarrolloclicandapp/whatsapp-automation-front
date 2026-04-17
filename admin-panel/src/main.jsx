import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ReactGA from 'react-ga4'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { BrandingProvider } from './context/BrandingContext'
import { LanguageProvider } from './context/LanguageContext'

ReactGA.initialize('G-6LS8CVYQE9')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrandingProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </BrandingProvider>
    </ThemeProvider>
  </StrictMode>,
)