/**
 * Operaciones temporales que deben significar exactamente lo mismo en ambos frontends.
 *
 * Moderación y Recinto reciben timestamps generados por el backend. Algunas marcas son
 * locales y no incluyen zona horaria; interpretarlas con `Date.parse()` haría que cada
 * navegador les aplique su propia zona. Este módulo evita esa divergencia y concentra la
 * resta backend-backend que ambas cabeceras usan como ancla de la duración de sesión.
 */

const MARCA_BACKEND_SIN_ZONA =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/

/** Rellena un número con ceros a la izquierda hasta alcanzar el ancho pedido. */
function rellenarConCeros(valor: number, ancho: number): string {
  return String(valor).padStart(ancho, '0')
}

/**
 * Formatea una duración como `hh:mm:ss`, sin limitar las horas a un ciclo de 24.
 *
 * Las diferencias negativas se recortan a cero porque una baseline inconsistente no
 * debe producir un valor visual negativo. El cálculo conserva horas mayores a 24 para
 * no imponer una duración máxima inexistente a una sesión institucional.
 */
export function formatearDuracion(milisegundos: number): string {
  const totalSegundos = Math.max(0, Math.floor(milisegundos / 1000))
  const horas = Math.floor(totalSegundos / 3600)
  const minutos = Math.floor((totalSegundos % 3600) / 60)
  const segundos = totalSegundos % 60

  return `${rellenarConCeros(horas, 2)}:${rellenarConCeros(minutos, 2)}:${rellenarConCeros(segundos, 2)}`
}

/**
 * Convierte una marca backend a una escala numérica que puede compararse con otra.
 *
 * Para marcas sin zona se leen los componentes como una escala UTC ficticia. No se
 * intenta descubrir el instante universal: solo se permite restar dos lecturas del
 * mismo reloj backend sin incorporar la zona local del navegador. Las marcas que sí
 * traen offset o `Z` conservan la semántica ISO habitual mediante `Date.parse()`.
 *
 * @param timestamp Marca temporal emitida por el backend.
 * @returns Milisegundos comparables, o `null` si la marca no representa una fecha válida.
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
 * Calcula la duración confirmada por un snapshot con dos marcas del mismo reloj backend.
 *
 * @param generadoEn Momento en el que el backend construyó el snapshot.
 * @param fechaHoraApertura Apertura formal de la sesión incluida en ese snapshot.
 * @returns Diferencia no negativa en milisegundos, o `null` ante marcas inválidas.
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
