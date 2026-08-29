import tailwindcss from '@tailwindcss/vite'

const shaConstruccion = process.env.BOTONERA2_SHA_CONSTRUCCION
const instanteConstruccion = Number(process.env.BOTONERA2_INSTANTE_CONSTRUCCION ?? Date.now())
const patronInstantePrerender = /(\[\{"prerenderedAt":\d+,"serverRendered":\d+\},)\d+(,false\])/g

export default defineNuxtConfig({
  // El simulador comparte la estrategia de despliegue estático como SPA independiente.
  // En producción Nginx servirá los archivos estáticos y no existirá un proceso Node runtime.
  ssr: false,
  // El lanzador productivo usa el SHA Git exacto para garantizar compilaciones reproducibles.
  buildId: shaConstruccion,
  experimental: {
    // Sin app manifest no se generan UUIDs/timestamps volátiles ni polling en el cliente.
    appManifest: false,
  },
  app: {
    // Prefijo canónico de la subruta del simulador bajo el contrato de mismo origen.
    baseURL: '/simulador/',
  },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/principal.css'],
  typescript: {
    strict: true,
    typeCheck: true,
  },
  runtimeConfig: {
    public: {
      // URL base del backend. Cadena vacía por defecto para consumir /api/v1 bajo mismo origen.
      apiBaseUrl: '',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  nitro: {
    hooks: {
      /**
       * Reemplaza la hora de ejecución que Nuxt agrega al payload de cada SPA.
       * El hook oficial de Nitro actúa sobre el HTML generado antes de guardarlo,
       * fijando el instante del commit para garantizar reproducibilidad exacta byte a byte.
       */
      'prerender:generate'(ruta) {
        if (!ruta.contents?.includes('data-nuxt-data')) {
          return
        }

        const contenidoEstable = ruta.contents.replace(
          patronInstantePrerender,
          `$1${instanteConstruccion}$2`,
        )
        if (contenidoEstable === ruta.contents) {
          throw new Error(`No se pudo estabilizar la fecha de prerender de la ruta ${ruta.route}.`)
        }
        ruta.contents = contenidoEstable
      },
    },
  },
})
