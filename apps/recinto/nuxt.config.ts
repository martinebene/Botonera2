import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  // Recinto comparte la estrategia de despliegue estático de Moderación, pero
  // conserva una aplicación separada para no mezclar responsabilidades.
  ssr: false,
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/principal.css'],
  typescript: {
    strict: true,
    typeCheck: true,
  },
  runtimeConfig: {
    public: {
      // En producción Recinto y FastAPI comparten origen. Esta variable solo
      // permite apuntar a otro backend durante desarrollo o pruebas manuales.
      apiBaseUrl: '',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
