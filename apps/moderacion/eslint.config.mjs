import withNuxt from './.nuxt/eslint.config.mjs'

// Nuxt genera la base consciente del proyecto; este archivo la hace explícita
// y versionada para que la CI use exactamente la misma configuración.
export default withNuxt()
