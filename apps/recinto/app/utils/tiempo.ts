/** Utilidades puras para el reloj y la duración visual de la cabecera pública. */

const MARCA_BACKEND_SIN_ZONA =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/

function rellenarConCeros(valor: number, ancho: number): string {
  return String(valor).padStart(ancho, '0')
}

/** Formatea el reloj del monitor como fecha y hora local con segundos. */
export function formatearFechaHoraLocal(fecha: Date): string {
  if (Number.isNaN(fecha.getTime())) return '—'
  return [
    `${rellenarConCeros(fecha.getDate(), 2)}/${rellenarConCeros(fecha.getMonth() + 1, 2)}/${rellenarConCeros(fecha.getFullYear(), 4)}`,
    `${rellenarConCeros(fecha.getHours(), 2)}:${rellenarConCeros(fecha.getMinutes(), 2)}:${rellenarConCeros(fecha.getSeconds(), 2)}`,
  ].join(' ')
}

/**
 * Formatea una duración con horas no limitadas a 24.
 * Un reloj local atrasado se recorta a cero en vez de mostrar valores negativos.
 */
export function formatearDuracion(milisegundos: number): string {
  const totalSegundos = Math.max(0, Math.floor(milisegundos / 1000))
  const horas = Math.floor(totalSegundos / 3600)
  const minutos = Math.floor((totalSegundos % 3600) / 60)
  const segundos = totalSegundos % 60
  return `${rellenarConCeros(horas, 2)}:${rellenarConCeros(minutos, 2)}:${rellenarConCeros(segundos, 2)}`
}

/**
 * Convierte una marca backend a una escala numérica comparable.
 *
 * FastAPI serializa los `datetime` locales del sistema sin sufijo de zona. El
 * navegador interpretaría una marca así en SU propia zona si usáramos
 * `Date.parse`, que fue la causa del reloj clavado en cero. Para marcas naive
 * se leen los componentes como una escala UTC ficticia: no pretende descubrir
 * un instante universal, solo permite restar dos lecturas del mismo reloj
 * backend sin incorporar la zona del monitor. Las marcas con zona explícita sí
 * conservan la semántica ISO normal.
 */
export function convertirMarcaBackend(timestamp: string): number | null {
  const coincidencia = MARCA_BACKEND_SIN_ZONA.exec(timestamp)
  if (!coincidencia) {
    const instante = Date.parse(timestamp)
    return Number.isFinite(instante) ? instante : null
  }

  const [, anio, mes, dia, hora, minuto, segundo, fraccion = ''] = coincidencia
  const componentes = [anio, mes, dia, hora, minuto, segundo].map(Number)
  if (componentes.some((valor) => !Number.isInteger(valor))) return null

  const [valorAnio, valorMes, valorDia, valorHora, valorMinuto, valorSegundo] = componentes
  const milisegundo = Number(fraccion.padEnd(3, '0').slice(0, 3))
  const instante = Date.UTC(
    valorAnio!,
    valorMes! - 1,
    valorDia,
    valorHora,
    valorMinuto,
    valorSegundo,
    milisegundo,
  )
  const verificacion = new Date(instante)
  const esValida =
    verificacion.getUTCFullYear() === valorAnio &&
    verificacion.getUTCMonth() === valorMes! - 1 &&
    verificacion.getUTCDate() === valorDia &&
    verificacion.getUTCHours() === valorHora &&
    verificacion.getUTCMinutes() === valorMinuto &&
    verificacion.getUTCSeconds() === valorSegundo
  return esValida ? instante : null
}

/**
 * Calcula la duración confirmada por un snapshot usando dos marcas backend.
 *
 * Una apertura futura o una pareja inconsistente se recorta a cero. Un valor
 * no parseable devuelve `null`, para que la UI no invente una duración.
 */
export function calcularDuracionEnSnapshot(
  generadoEn: string,
  fechaHoraApertura: string,
): number | null {
  const generado = convertirMarcaBackend(generadoEn)
  const apertura = convertirMarcaBackend(fechaHoraApertura)
  if (generado === null || apertura === null) return null
  return Math.max(0, generado - apertura)
}
