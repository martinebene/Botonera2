/** Resuelve una ruta interna del padrón contra el base URL público de Nuxt. */
export function resolverRutaAsset(ruta: string): string {
  if (!ruta) return ''
  if (/^(?:https?:|data:)/.test(ruta)) return ruta

  let baseUrl = '/'
  try {
    baseUrl = useRuntimeConfig().app.baseURL || '/'
  } catch {
    // Los tests de componentes no levantan una aplicación Nuxt completa.
  }

  const baseNormalizada = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${baseNormalizada}${ruta.replace(/^\//, '')}`
}
