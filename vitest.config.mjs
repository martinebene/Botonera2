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
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'tests/playwright/**'],
  },
})
