import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 'es2020' soporta import.meta, necesario para las variables de entorno
    target: 'es2020',
  },
  esbuild: {
    // Aseguramos que el pre-bundling también soporte características modernas
    target: 'es2020',
  },
})