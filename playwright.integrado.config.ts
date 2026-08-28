import { defineConfig, devices } from '@playwright/test'

/**
 * Configuración del E2E real de WP-027.
 *
 * A diferencia del E2E de componentes frontend, este runner no declara
 * `webServer`: la prueba es dueña del proceso FastAPI porque necesita detenerlo,
 * comprobar que liberó el puerto y volverlo a iniciar para demostrar el estado
 * volátil. Un único worker evita que dos flujos institucionales compartan el
 * mismo backend autoritativo en memoria.
 */
export default defineConfig({
  testDir: './tests/playwright-integrado',
  timeout: 180_000,
  expect: {
    timeout: 12_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:18027',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-integrado',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
