/** Utilidades puras para el reloj y la duración visual de la cabecera pública. */

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

/** Deriva la duración únicamente de la apertura proyectada y el reloj local. */
export function calcularTiempoSesion(fechaHoraApertura: string | null, ahora: Date): string | null {
  if (!fechaHoraApertura) return null
  const apertura = Date.parse(fechaHoraApertura)
  if (!Number.isFinite(apertura)) return null
  return formatearDuracion(ahora.getTime() - apertura)
}
