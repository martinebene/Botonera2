import tailwindcss from '@tailwindcss/vite'

const shaConstruccion = process.env.BOTONERA2_SHA_CONSTRUCCION
const instanteConstruccion = Number(process.env.BOTONERA2_INSTANTE_CONSTRUCCION ?? Date.now())
const patronInstantePrerender = /(\[\{"prerenderedAt":\d+,"serverRendered":\d+\},)\d+(,false\])/g

export default defineNuxtConfig({
  // El puesto de Apoyo Técnico comparte la estrategia de despliegue estático del resto
  // de las SPA: en producción Nginx sirve archivos estáticos y no hay proceso Node runtime.
  // Se accede desde otro equipo de la LAN sin autenticación adicional (decisión WP-056),
  // así que su ruta no lleva la restricción a loopback del simulador de dispositivos.
  ssr: false,
  // El lanzador productivo usa el SHA Git exacto para garantizar compilaciones reproducibles.
  buildId: shaConstruccion,
  experimental: {
    // Sin app manifest no se generan UUIDs/timestamps volátiles ni polling en el cliente.
    appManifest: false,
  },
  app: {
    // Prefijo canónico de la subruta técnica bajo el contrato de mismo origen.
    // En desarrollo interactivo con `dev:stack:hot`, HMR se transporta sobre WebSocket
    // en la misma URL base y puerto unificado del proxy sin requerir configuración adicional.
    baseURL: '/tecnico/',
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
