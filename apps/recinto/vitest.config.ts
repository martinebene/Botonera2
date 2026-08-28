/** Compilación cliente + DOM liviano para las pruebas integrales del Recinto. */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const raizRecinto = fileURLToPath(new URL('.', import.meta.url))
const require = createRequire(import.meta.url)
const pluginVue = require('@vitejs/plugin-vue')
const vue = pluginVue.default || pluginVue

export default defineConfig({
  root: raizRecinto,
  plugins: [vue({ isProduction: false })],
  test: {
    // El entorno conserva Node y el DOM simulado existente, pero solicita a
    // Vite la variante cliente de los SFC para montar su render real.
    environment: './tests/entorno_dom_cliente.ts',
    setupFiles: ['../moderacion/tests/setup_dom.ts'],
    include: ['tests/*.test.ts'],
  },
})
