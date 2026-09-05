/**
 * Resolución de rutas de assets estáticos del puesto de Apoyo Técnico (WP-071).
 *
 * Sigue el mismo patrón que ya usan Moderación y la Pantalla del Recinto: el backend
 * declara rutas **relativas** a la raíz pública de la aplicación (por ejemplo
 * `assets/sonidos/sesion-abierta.wav`) y cada SPA les antepone su propio prefijo de
 * despliegue, que Nuxt publica en `app.baseURL`. Para Apoyo Técnico ese prefijo es
 * `/tecnico/`.
 *
 * ### Por qué Apoyo Técnico necesita esto ahora
 *
 * Hasta WP-071 esta pantalla no consumía ningún asset declarado por el backend: sus dos
 * imágenes de marca están escritas en `nuxt.config.ts`. Desde WP-071 reproduce los quince
 * sonidos del recinto, cuyas rutas llegan dentro de `EstadoRecinto.sonidos`, así que
 * necesita la misma traducción de ruta a URL.
 *
 * Los archivos de sonido siguen versionados en un único lugar,
 * `apps/recinto/public/assets/sonidos/`. Apoyo Técnico los publica bajo su propio prefijo
 * porque su `nuxt.config.ts` los agrega como directorio público adicional en tiempo de
 * construcción; no hay una segunda copia en el repositorio que pueda divergir.
 */

/**
 * Resuelve la ruta pública de un asset respetando el `baseURL` configurado.
 *
 * @param ruta Ruta interna declarada por el backend, por ejemplo
 *   `assets/sonidos/votacion-abierta.wav`. Una cadena vacía devuelve cadena vacía.
 * @returns URL utilizable por el navegador, por ejemplo
 *   `/tecnico/assets/sonidos/votacion-abierta.wav`. Las URLs absolutas y los `data:` se
 *   devuelven intactos, porque ya son direcciones completas.
 *
 * No tiene efectos laterales. Fuera del runtime de Nuxt —una prueba unitaria aislada— cae
 * a la raíz `/` en lugar de fallar, de modo que ninguna suite necesite levantar la
 * aplicación completa para ejercitar un componente.
 */
export function resolverRutaAsset(ruta: string): string {
  if (!ruta) return ''
  if (/^(?:https?:|data:)/.test(ruta)) return ruta

  let baseUrl = '/'
  try {
    baseUrl = useRuntimeConfig().app.baseURL || '/'
  } catch {
    // Las pruebas de componentes no levantan una aplicación Nuxt completa.
  }

  const baseNormalizada = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${baseNormalizada}${ruta.replace(/^\//, '')}`
}
