import tailwindcss from '@tailwindcss/vite'

const shaConstruccion = process.env.BOTONERA2_SHA_CONSTRUCCION
const instanteConstruccion = Number(process.env.BOTONERA2_INSTANTE_CONSTRUCCION ?? Date.now())
const patronInstantePrerender = /(\[\{"prerenderedAt":\d+,"serverRendered":\d+\},)\d+(,false\])/g

export default defineNuxtConfig({
  // Estas opciones fuerzan una SPA generable como archivos estáticos. En
  // producción Nginx servirá el resultado y no habrá un proceso Node/Nitro.
  ssr: false,
  // El lanzador productivo usa el SHA Git exacto. Nuxt acepta oficialmente un
  // hash del estado del proyecto como buildId; en desarrollo conserva su valor
  // automático porque la variable sólo existe durante el build raíz.
  buildId: shaConstruccion,
  experimental: {
    // Estas SPA no usan route rules del lado cliente. Omitir el app manifest
    // evita UUID/timestamps volátiles y también su polling de builds obsoletos.
    appManifest: false,
  },
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
