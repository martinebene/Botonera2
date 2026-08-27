import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  // Estas opciones fuerzan una SPA generable como archivos estáticos. En
  // producción Nginx servirá el resultado y no habrá un proceso Node/Nitro.
  ssr: false,
  app: {
    // El prefijo forma parte del contrato de mismo origen. Nuxt lo incorpora
    // tanto a las rutas de la aplicación como a las URLs de sus assets.
    baseURL: '/moderacion/',
  },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/principal.css'],
  typescript: {
    strict: true,
    typeCheck: true,
  },
  runtimeConfig: {
    public: {
      // URL base del backend. Por defecto cadena vacía para conservar el contrato de mismo origen
      // en producción (ej. /api/v1). En desarrollo puede sobreescribirse mediante NUXT_PUBLIC_API_BASE_URL.
      apiBaseUrl: '',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
