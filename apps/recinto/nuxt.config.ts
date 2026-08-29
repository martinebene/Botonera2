import tailwindcss from '@tailwindcss/vite'

const shaConstruccion = process.env.BOTONERA2_SHA_CONSTRUCCION
const instanteConstruccion = Number(process.env.BOTONERA2_INSTANTE_CONSTRUCCION ?? Date.now())
const patronInstantePrerender = /(\[\{"prerenderedAt":\d+,"serverRendered":\d+\},)\d+(,false\])/g

export default defineNuxtConfig({
  // Recinto comparte la estrategia de despliegue estático de Moderación, pero
  // conserva una aplicación separada para no mezclar responsabilidades.
  ssr: false,
  // El lanzador productivo usa el SHA Git exacto. Nuxt acepta oficialmente un
  // hash del estado del proyecto como buildId; en desarrollo conserva su valor
  // automático porque la variable sólo existe durante el build raíz.
  buildId: shaConstruccion,
  experimental: {
    // Recinto tampoco usa route rules del lado cliente. Sin app manifest no se
    // generan UUID/timestamps ni se activa el polling de builds obsoletos.
    appManifest: false,
  },
  app: {
    // El build queda listo para que Nginx o el harness lo sirvan en la
    // subruta pública acordada, sin fijar un host absoluto.
    // En desarrollo interactivo con `dev:stack:hot`, Vite HMR se conecta automáticamente
    // al host y puerto de origen visible (@vite/client), atravesando el proxy unificado
    // y los túneles SSH de forma transparente.
    baseURL: '/recinto/',
  },
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
  nitro: {
    hooks: {
      /**
       * Reemplaza la hora de ejecución que Nuxt agrega al payload de cada SPA.
       * El hook oficial de Nitro actúa sobre el HTML ya generado, justo antes
       * de escribirlo, y usa la fecha estable del commit como equivalente.
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
