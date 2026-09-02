/** Compilación cliente + DOM liviano para las pruebas del puesto de Apoyo Técnico. */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const raizTecnico = fileURLToPath(new URL('.', import.meta.url))
const require = createRequire(import.meta.url)
const pluginVue = require('@vitejs/plugin-vue')
const vue = pluginVue.default || pluginVue

export default defineConfig({
  root: raizTecnico,
  plugins: [
    vue({
      isProduction: false,
      template: {
        compilerOptions: {
          hoistStatic: false,
        },
      },
    }),
  ],
  test: {
    environment: './tests/entorno_dom_cliente.ts',
    setupFiles: ['../moderacion/tests/setup_dom.ts'],
    include: ['tests/*.test.ts'],
  },
})
