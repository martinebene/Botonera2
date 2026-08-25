<script setup lang="ts">
/**
 * Diálogo modal de advertencia confirmatoria para el cierre de sesión con palabra pendiente.
 *
 * Responsabilidades:
 * 1. Presentar una advertencia clara al operador cuando intenta cerrar la sesión existiendo
 *    un concejal en uso de la palabra (orador) o pedidos registrados en la cola de espera.
 * 2. Si el operador cancela: no ejecuta ninguna acción técnica ni modifica el estado.
 * 3. Si el operador confirma: emite el evento de confirmación para que el panel envíe
 *    el comando normal de cierre de sesión al backend.
 *
 * Invariantes respetados:
 * - NO ejecuta comandos de otorgar/quitar palabra antes de cerrar.
 * - NO altera localmente la cola ni el orador.
 * - Es una salvaguarda ergonómica de UI y no una precondición obligatoria del backend.
 */

import { computed } from 'vue'
import type { EstadoPalabraModeracion } from '@botonera2/api-client'

const props = defineProps<{
  /** Estado del uso de la palabra proyectado por el backend */
  palabra: EstadoPalabraModeracion | null
  /** Indica si el diálogo se encuentra actualmente visible */
  abierto: boolean
  /** Indica si una operación de comando se encuentra en vuelo */
  enviando?: boolean
}>()

const emit = defineEmits<{
  confirmar: []
  cancelar: []
}>()

// Identidad del orador actual si existe
const oradorActual = computed(() => {
  if (!props.palabra?.orador) return null
  return `${props.palabra.orador.nombre} ${props.palabra.orador.apellido}`
})

// Cantidad de pedidos pendientes en la cola de palabra
const cantidadEnCola = computed(() => props.palabra?.cola?.length ?? 0)

function manejarConfirmar(): void {
  emit('confirmar')
}

function manejarCancelar(): void {
  emit('cancelar')
}
</script>

<template>
  <div
    v-if="abierto"
    data-testid="dialogo-confirmacion-cierre"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm select-none"
    role="dialog"
    aria-modal="true"
    aria-labelledby="titulo-dialogo-cierre"
  >
    <div
      class="w-full max-w-md rounded-xl border border-amber-600/80 bg-slate-900 p-5 shadow-2xl text-slate-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Cabecera del diálogo -->
      <div class="flex items-center gap-3 border-b border-slate-800 pb-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-950 text-amber-400 border border-amber-600"
        >
          <span class="text-xl font-bold">⚠</span>
        </div>
        <div>
          <h3 id="titulo-dialogo-cierre" class="text-base font-bold text-slate-100">
            Advertencia: Uso de la palabra activo
          </h3>
          <p class="text-xs text-amber-300">
            Existen concejales con intervención o pedido pendiente
          </p>
        </div>
      </div>

      <!-- Cuerpo explicativo -->
      <div class="space-y-3 text-xs text-slate-300">
        <p>
          Está a punto de cerrar la sesión formal mientras aún hay actividad registrada en el uso de
          la palabra:
        </p>

        <!-- Detalle de orador activo si existe -->
        <div
          v-if="oradorActual"
          data-testid="detalle-orador-pendiente"
          class="rounded-lg border border-amber-800/60 bg-amber-950/40 p-2.5"
        >
          <span class="font-bold text-amber-200 uppercase tracking-wider text-[10px]"
            >Orador en uso de palabra:</span
          >
          <p class="text-sm font-semibold text-slate-100 mt-0.5">{{ oradorActual }}</p>
        </div>

        <!-- Detalle de pedidos en cola si existen -->
        <div
          v-if="cantidadEnCola > 0"
          data-testid="detalle-cola-pendiente"
          class="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5"
        >
          <span class="font-bold text-slate-400 uppercase tracking-wider text-[10px]"
            >Pedidos en espera:</span
          >
          <p class="text-sm font-semibold text-slate-200 mt-0.5">
            {{ cantidadEnCola }}
            {{ cantidadEnCola === 1 ? 'solicitud pendiente' : 'solicitudes pendientes' }} en la cola
          </p>
        </div>

        <p class="text-slate-400 italic">
          Al confirmar el cierre, la sesión se dará por concluida formalmente en el backend sin
          requerir acciones previas sobre la palabra.
        </p>
      </div>

      <!-- Botones de acción -->
      <div class="flex items-center justify-end gap-3 border-t border-slate-800 pt-3">
        <button
          type="button"
          data-testid="btn-cancelar-cierre"
          class="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 active:bg-slate-900 transition-colors disabled:opacity-50"
          :disabled="enviando"
          @click="manejarCancelar"
        >
          Cancelar y conservar sesión
        </button>

        <button
          type="button"
          data-testid="btn-confirmar-cierre"
          class="rounded-lg border border-amber-600 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
          :disabled="enviando"
          @click="manejarConfirmar"
        >
          <span
            v-if="enviando"
            class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"
          />
          <span>{{ enviando ? 'Cerrando sesión...' : 'Confirmar cierre de sesión' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
