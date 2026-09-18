import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Build-time values that production cannot run without. On 2026-09-14 a
// panel was built without them: installs went to the "waflow development"
// app and the card form fell back to a placeholder Stripe key. A production
// build now refuses to compile instead of shipping that silently.
const REQUIRED_PRODUCTION_ENV = {
  VITE_API_URL: { pattern: /^https:\/\/\S+$/, hint: 'https URL of the API (https://wa.waflow.ai)' },
  VITE_INSTALL_APP_URL: { pattern: /\/integration\/[0-9a-f]{24}(?:[/?#].*)?$/, hint: 'GHL marketplace install URL of the production app' },
  VITE_STRIPE_PUBLIC_KEY: { pattern: /^pk_live_[A-Za-z0-9]+$/, hint: 'live Stripe publishable key (pk_live_...)' },
  VITE_SUPPORT_PHONE: { pattern: /^\d{8,15}$/, hint: 'support phone, digits only with country code' },
}

// Values that must never reach a production bundle, whatever variable holds them.
const FORBIDDEN_PRODUCTION_VALUES = [
  { pattern: /6968d10f1f0b9e6b537024cd/, why: 'the "waflow development" GHL app' },
  { pattern: /lrkqbo|test-development-/, why: 'the test environment' },
  { pattern: /localhost|127\.0\.0\.1/, why: 'a local address' },
  { pattern: /your_key_here|placeholder/i, why: 'a placeholder' },
]

export function findProductionEnvProblems(env = {}) {
  const problems = []
  for (const [name, rule] of Object.entries(REQUIRED_PRODUCTION_ENV)) {
    const value = String(env[name] || '').trim()
    if (!value) problems.push(`${name} is missing (${rule.hint})`)
    else if (!rule.pattern.test(value)) problems.push(`${name} has an unexpected value (${rule.hint})`)
  }
  for (const [name, raw] of Object.entries(env)) {
    if (!name.startsWith('VITE_')) continue
    const value = String(raw || '')
    for (const rule of FORBIDDEN_PRODUCTION_VALUES) {
      if (rule.pattern.test(value)) problems.push(`${name} points at ${rule.why}`)
    }
  }
  return problems
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production' && process.env.WAFLOW_ALLOW_INCOMPLETE_BUILD !== '1') {
    const problems = findProductionEnvProblems(loadEnv(mode, process.cwd(), 'VITE_'))
    if (problems.length > 0) {
      throw new Error(
        `Refusing to build the production panel:\n  - ${problems.join('\n  - ')}\n` +
        'Pass them as --build-arg (see Dockerfile). For a local, non-deployable build set WAFLOW_ALLOW_INCOMPLETE_BUILD=1.'
      )
    }
  }

  return {
    plugins: [react()],
    build: {
      // 'es2020' soporta import.meta, necesario para las variables de entorno
      target: 'es2020',
    },
    esbuild: {
      // Aseguramos que el pre-bundling también soporte características modernas
      target: 'es2020',
    },
  }
})
