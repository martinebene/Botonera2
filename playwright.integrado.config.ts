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
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          /*
            Política de autoplay de los dos puestos que sonorizan (WP-066, WP-071).

            Ni el monitor del recinto ni el puesto de Apoyo Técnico reciben una interacción
            humana antes de tener que reproducir: no hay quien toque la pantalla del salón,
            y el operador técnico puede pasar toda la sesión sin hacer clic. Chromium exige
            por defecto un gesto previo, y HUMAN_GATE descartó agregar un botón «Activar
            sonido» en cualquiera de las dos superficies.

            La bandera declara acá la misma condición que el equipo de producción debe
            cumplir, documentada en `docs/13-despliegue-y-operacion.md` y en el manual. Es
            la misma que ya usa `playwright.config.ts` para las pruebas de componentes.
          */
          args: ['--autoplay-policy=no-user-gesture-required'],
        },
      },
    },
  ],
})
