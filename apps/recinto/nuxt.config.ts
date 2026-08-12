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
  vite: {
    plugins: [tailwindcss()],
  },
})
