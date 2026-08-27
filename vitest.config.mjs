import { defineConfig } from 'vitest/config'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let pluginVue
try {
  pluginVue = require('@vitejs/plugin-vue')
} catch {
  pluginVue = require('./apps/moderacion/node_modules/@vitejs/plugin-vue')
}
const vue = pluginVue.default || pluginVue

export default defineConfig({
  plugins: [vue({ isProduction: false })],
  test: {
    environment: 'node',
    setupFiles: ['./apps/moderacion/tests/setup_dom.ts'],
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    // El shell público usa el entorno Nuxt real en su configuración dedicada.
    exclude: [
      '**/node_modules/**',
      'tests/playwright/**',
      'apps/recinto/tests/shell_publico.test.ts',
    ],
  },
})
