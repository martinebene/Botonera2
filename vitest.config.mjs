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
    // Todo Recinto usa el entorno cliente/Nuxt de su configuración dedicada.
    // Excluir la carpeta completa evita que una prueba nueva se ejecute antes
    // con este runner raíz de Node y termine compilando los SFC como SSR.
    exclude: ['**/node_modules/**', 'tests/playwright/**', 'apps/recinto/tests/**'],
  },
})
