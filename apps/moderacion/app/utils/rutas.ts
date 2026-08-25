/**
 * Utilidades para resolución de rutas de assets y recursos estáticos en Moderación.
 *
 * En arquitecturas SPA y aplicaciones web corporativas, la aplicación puede estar
 * desplegada en la raíz de un dominio (ej: https://votacion.concejo.gob.ar/) o bajo
 * un prefijo de ruta (ej: https://servidor/moderacion/).
 *
 * Esta función normaliza las rutas declaradas en los contratos de datos (como ruta_imagen
 * en el padrón de concejales) anteponiendo el baseURL configurado por Nuxt sin depender
 * de convenciones implícitas o URLs fijas.
 */

/**
 * Resuelve la ruta pública accesible de un asset institucional respetando el baseURL configurado.
 *
 * @param ruta Ruta interna del asset declarada en el modelo (ej: "assets/bancas/banca-01.png")
 * @returns Ruta final utilizable en atributos src de imágenes HTML
 */
export function resolverRutaAsset(ruta: string): string {
  if (!ruta) {
    return ''
  }

  // Si la ruta ya es absoluta o un esquema URI (http, https, data), se retorna intacta
  if (ruta.startsWith('http://') || ruta.startsWith('https://') || ruta.startsWith('data:')) {
    return ruta
  }

  let baseUrl = '/'
  try {
    if (typeof useRuntimeConfig === 'function') {
      const config = useRuntimeConfig()
      baseUrl = (config.app?.baseURL as string) || '/'
    }
  } catch {
    // Si se ejecuta fuera del contexto de Nuxt (ej: pruebas unitarias aisladas), usamos "/"
    baseUrl = '/'
  }

  // Normalización segura: aseguramos que la base termine en "/" y la ruta no comience con "/"
  const baseNormalizada = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const rutaNormalizada = ruta.startsWith('/') ? ruta.slice(1) : ruta

  return `${baseNormalizada}${rutaNormalizada}`
}
