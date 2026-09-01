/**
 * Aviso efímero (toast) reutilizable de Moderación.
 *
 * ¿Por qué existe este composable?
 * ---------------------------------
 * WP-051 fija una política única de feedback para Moderación con tres categorías:
 *
 * 1. **Acuse puramente técnico** (por ejemplo "Apertura enviada. Esperando confirmación"):
 *    no se muestra. El backend ya audita la mutación en los CSV L1/L2/L3 y el propio
 *    snapshot autoritativo confirma el efecto en pantalla. Mostrarlo además como aviso
 *    ocupaba espacio permanentemente sin agregar información.
 * 2. **Error o advertencia accionable**: permanece visible hasta que el operador lo
 *    resuelve o lo cierra. No usa este composable.
 * 3. **Confirmación humana útil pero no crítica** (por ejemplo "Datos de preparación
 *    guardados"): se muestra un instante y desaparece sola. Ese es exactamente el caso
 *    que resuelve este composable.
 *
 * Antes de WP-051 la única caducidad automática vivía escrita a mano dentro de
 * `PanelOrdenDelDia.vue`. Concentrar acá el temporizador evita repetir esa mecánica en
 * cada cuadrante y garantiza que todos los avisos efímeros se comporten igual: uno solo
 * por vez, reemplazable y siempre cancelado cuando el componente desaparece.
 *
 * Este composable es puramente presentacional: no confirma ni decide nada institucional.
 * La autoridad sigue siendo el backend a través de `EstadoModeracion`.
 */

import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

/**
 * Duración por defecto de una confirmación de comando institucional.
 *
 * Es más larga que el acuse de copia asistencial del Orden del Día (1 s) porque acá el
 * operador acaba de ejecutar una mutación real y necesita alcanzar a leerla; pero sigue
 * siendo breve, porque el estado autoritativo es la verdadera confirmación.
 */
export const DURACION_AVISO_EFIMERO_MS = 2500

/** Contrato devuelto por `useAvisoEfimero`, pensado para consumirse desde un `<template>`. */
export interface AvisoEfimero {
  /** Texto visible del aviso; `null` significa que no hay ningún aviso en pantalla. */
  mensaje: Ref<string | null>
  /** Muestra (o reemplaza) el aviso y programa su desaparición automática. */
  mostrar: (texto: string) => void
  /** Oculta el aviso inmediatamente y cancela el temporizador pendiente. */
  limpiar: () => void
}

/**
 * Crea un aviso efímero con caducidad automática.
 *
 * @param duracionMs Milisegundos que el aviso permanece visible. Debe ser un número
 *   positivo; se usa tal cual para programar el `setTimeout`.
 * @returns El texto reactivo del aviso y las dos acciones para mostrarlo o limpiarlo.
 *
 * Detalles de implementación que conviene entender:
 *
 * - Siempre vive **un solo temporizador**. Mostrar un aviso nuevo cancela primero el
 *   anterior; si no lo hiciera, el timer viejo apagaría el mensaje nuevo antes de tiempo.
 * - `onScopeDispose` cancela el temporizador cuando el componente que llamó al composable
 *   se desmonta. Un `setTimeout` sobreviviente escribiría sobre un `ref` ya muerto.
 * - La registración del hook se protege con `getCurrentScope()` para poder usar el
 *   composable directamente desde una prueba unitaria, fuera de un componente, sin
 *   generar advertencias de Vue.
 */
export function useAvisoEfimero(duracionMs: number = DURACION_AVISO_EFIMERO_MS): AvisoEfimero {
  const mensaje = ref<string | null>(null)
  let temporizador: ReturnType<typeof setTimeout> | null = null

  function cancelarTemporizador(): void {
    if (temporizador !== null) {
      clearTimeout(temporizador)
      temporizador = null
    }
  }

  function mostrar(texto: string): void {
    cancelarTemporizador()
    mensaje.value = texto
    temporizador = setTimeout(() => {
      mensaje.value = null
      temporizador = null
    }, duracionMs)
  }

  function limpiar(): void {
    cancelarTemporizador()
    mensaje.value = null
  }

  if (getCurrentScope()) {
    onScopeDispose(cancelarTemporizador)
  }

  return { mensaje, mostrar, limpiar }
}
