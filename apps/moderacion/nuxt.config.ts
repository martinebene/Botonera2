import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  // Estas opciones fuerzan una SPA generable como archivos estáticos. En
  // producción Nginx servirá el resultado y no habrá un proceso Node/Nitro.
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
