/**
 * Reloj local reactivo para la cabecera de Moderación.
 *
 * ¿Por qué un reloj propio y no un dato del backend?
 * La fecha y hora que ve quien opera cumple una función de orientación, igual que el
 * reloj de pared del recinto. No es estado institucional: no se audita, no decide
 * reglas y no debe generar tráfico. Por eso este composable NO agrega polling ni
 * consulta ningún endpoint; se limita a leer el reloj del propio equipo con un
 * temporizador del navegador.
 *
 * El único dato autoritativo asociado al paso del tiempo sigue siendo
 * `sesion.fecha_hora_apertura`, que llega por REST/SSE dentro de `EstadoModeracion`.
 * El tiempo transcurrido de sesión se deriva de esa marca y de este reloj.
 *
 * Detalle importante del ciclo de vida: el temporizador se crea recién en `onMounted`
 * y se cancela en `onScopeDispose`. De esa forma un render de servidor o una prueba
 * de renderizado a texto nunca dejan un `setInterval` colgado, y cada componente que
 * usa el reloj libera su temporizador al desmontarse.
 */

import { ref, onMounted, onScopeDispose, getCurrentScope, type Ref } from 'vue'

/** Opciones de configuración del reloj local. */
export interface OpcionesRelojLocal {
  /** Período de actualización en milisegundos (por defecto 1000, es decir un tick por segundo). */
  intervaloMs?: number
  /** Fuente de tiempo inyectable; permite fijar el instante en pruebas deterministas. */
  obtenerAhora?: () => Date
}

/** Superficie reactiva devuelta por el reloj local. */
export interface RelojLocal {
  /** Instante actual, revalidado en cada tick del temporizador. */
  ahora: Ref<Date>
  /** Fuerza una actualización inmediata sin esperar al siguiente tick. */
  actualizar: () => void
}

/**
 * Crea un reloj local reactivo asociado al scope del componente que lo invoca.
 *
 * @param opciones Período de actualización y fuente de tiempo inyectable.
 * @returns Referencia reactiva al instante actual y su función de actualización manual.
 */
export function useRelojLocal(opciones: OpcionesRelojLocal = {}): RelojLocal {
  const intervaloMs = opciones.intervaloMs ?? 1000
  const obtenerAhora = opciones.obtenerAhora ?? (() => new Date())

  // El valor inicial se toma de inmediato para que el primer render ya muestre una hora
  // coherente y no un hueco visual hasta el primer tick.
  const ahora = ref<Date>(obtenerAhora())

  let identificadorIntervalo: ReturnType<typeof setInterval> | null = null

  function actualizar(): void {
    ahora.value = obtenerAhora()
  }

  // Sin scope reactivo activo (por ejemplo, si alguien llamara a esta función fuera de
  // un componente) no hay nada que registrar ni que limpiar después.
  if (getCurrentScope()) {
    onMounted(() => {
      // Al montar volvemos a leer el reloj: entre setup() y mounted pudo pasar tiempo.
      actualizar()
      identificadorIntervalo = setInterval(actualizar, intervaloMs)
    })

    onScopeDispose(() => {
      if (identificadorIntervalo !== null) {
        clearInterval(identificadorIntervalo)
        identificadorIntervalo = null
      }
    })
  }

  return { ahora, actualizar }
}
