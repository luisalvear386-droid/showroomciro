import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/*
 * Pruebas manuales con Playwright contra el build de producción (`vite preview`), conectadas
 * a la base real de Supabase: cargan datos de verdad (ventas, cajas, stock). Anotar en
 * docs/tasks.md lo que cargue cada corrida.
 *
 * Credenciales en `.env.e2e` (no se sube al repo, ver .gitignore):
 *   E2E_USUARIO=...
 *   E2E_CONTRASENA=...
 */
if (existsSync('.env.e2e')) process.loadEnvFile('.env.e2e')

export default defineConfig({
  testDir: './e2e',
  // Una sola caja y un solo mostrador: las pruebas van en orden, una a la vez
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
    locale: 'es-AR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
