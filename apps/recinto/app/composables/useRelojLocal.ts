/**
 * Reloj visual de la Pantalla del Recinto.
 *
 * La fecha/hora del monitor y la duración visible de una sesión no son estado
 * institucional. Este composable actualiza una referencia local una vez por
 * segundo, sin polling ni llamadas de red, y libera el intervalo al desmontar
 * el componente que lo usa.
 */

import { onMounted, onScopeDispose, ref, type Ref } from 'vue'

export interface RelojLocal {
  /** Instante local vigente para las presentaciones de cabecera. */
  ahora: Ref<Date>
}

/** Crea un reloj cancelable asociado al ciclo de vida del componente. */
export function useRelojLocal(): RelojLocal {
  const ahora = ref(new Date())
  let intervalo: ReturnType<typeof setInterval> | null = null

  function actualizar(): void {
    ahora.value = new Date()
  }

  onMounted(() => {
    actualizar()
    intervalo = setInterval(actualizar, 1000)
  })

  onScopeDispose(() => {
    if (intervalo !== null) clearInterval(intervalo)
    intervalo = null
  })

  return { ahora }
}
