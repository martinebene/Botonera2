/**
 * Utilidades puras de presentación temporal para el Shell de Moderación.
 *
 * Aquí no se calcula ningún dato institucional: la única fuente autoritativa de la
 * apertura formal de una sesión es `sesion.fecha_hora_apertura`, que llega desde el
 * backend. Estas funciones solamente convierten instantes y diferencias en texto
 * compacto para la cabecera, de modo que la vista no dependa del locale del sistema
 * ni de tablas ICU que podrían variar entre máquinas y entre CI.
 *
 * Todas las funciones son deterministas: reciben las fechas ya resueltas por quien
 * las llama y nunca consultan el reloj por su cuenta. Esa separación es la que permite
 * probarlas con un reloj falso.
 */

/**
 * Rellena un número con ceros a la izquierda hasta alcanzar el ancho indicado.
 *
 * @param valor Número a formatear (se asume entero no negativo).
 * @param ancho Cantidad mínima de dígitos del resultado.
 * @returns Texto con ceros a la izquierda, por ejemplo `07`.
 */
function rellenarConCeros(valor: number, ancho: number): string {
  return String(valor).padStart(ancho, '0')
}

/**
 * Formatea un instante en la hora local del puesto de Moderación.
 *
 * Se usa la hora local del equipo (y no UTC) porque la cabecera cumple la misma
 * función que el reloj de pared del recinto: orientar a quien opera. El formato es
 * el mismo que usa la interfaz en producción, `dd/mm/aaaa hh:mm:ss`, pero construido
 * de forma explícita para que el resultado sea idéntico en cualquier entorno.
 *
 * @param fecha Instante a mostrar.
 * @returns Texto compacto `dd/mm/aaaa hh:mm:ss`, o `'—'` si la fecha no es válida.
 */
export function formatearFechaHoraLocal(fecha: Date): string {
  if (Number.isNaN(fecha.getTime())) {
    return '—'
  }

  const dia = rellenarConCeros(fecha.getDate(), 2)
  const mes = rellenarConCeros(fecha.getMonth() + 1, 2)
  const anio = rellenarConCeros(fecha.getFullYear(), 4)
  const horas = rellenarConCeros(fecha.getHours(), 2)
  const minutos = rellenarConCeros(fecha.getMinutes(), 2)
  const segundos = rellenarConCeros(fecha.getSeconds(), 2)

  return `${dia}/${mes}/${anio} ${horas}:${minutos}:${segundos}`
}

/**
 * Formatea una duración en milisegundos como `hh:mm:ss`.
 *
 * Las duraciones negativas se recortan a cero: si el reloj local del puesto estuviera
 * levemente atrasado respecto del backend, la cabecera debe mostrar `00:00:00` y no
 * un tiempo negativo sin sentido institucional. Las horas no se recortan a 24 porque
 * una sesión puede, en teoría, extenderse más de un día.
 *
 * @param milisegundos Duración a formatear.
 * @returns Texto `hh:mm:ss` con al menos dos dígitos de hora.
 */
export function formatearDuracion(milisegundos: number): string {
  const totalSegundos = Math.max(0, Math.floor(milisegundos / 1000))
  const horas = Math.floor(totalSegundos / 3600)
  const minutos = Math.floor((totalSegundos % 3600) / 60)
  const segundos = totalSegundos % 60

  return `${rellenarConCeros(horas, 2)}:${rellenarConCeros(minutos, 2)}:${rellenarConCeros(segundos, 2)}`
}

/**
 * Calcula el tiempo transcurrido entre la apertura formal de la sesión y el instante actual.
 *
 * La apertura llega como texto ISO 8601 dentro de la proyección `EstadoModeracion`;
 * si todavía no existe sesión abierta, o si el texto no es interpretable, la función
 * devuelve `null` para que la cabecera simplemente omita el dato en lugar de inventarlo.
 *
 * @param fechaHoraApertura Marca ISO de `sesion.fecha_hora_apertura`, o `null` si no hay sesión.
 * @param ahora Instante actual provisto por el reloj local.
 * @returns Texto `hh:mm:ss` con el tiempo transcurrido, o `null` si no corresponde mostrarlo.
 */
export function calcularTiempoTranscurrido(
  fechaHoraApertura: string | null | undefined,
  ahora: Date,
): string | null {
  if (!fechaHoraApertura) {
    return null
  }

  const apertura = new Date(fechaHoraApertura)
  if (Number.isNaN(apertura.getTime())) {
    return null
  }

  return formatearDuracion(ahora.getTime() - apertura.getTime())
}
