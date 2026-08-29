<script setup lang="ts">
/**
 * Modal compacto para editar las autoridades de una sesión ya abierta.
 *
 * El componente es deliberadamente presentacional: recibe los borradores desde
 * `PanelSesionVotacion` y emite cada cambio. De ese modo, el panel conserva en un
 * solo lugar el dirty tracking que protege la escritura del operador frente a
 * snapshots SSE ajenos. Guardar tampoco modifica el estado institucional de forma
 * optimista; solamente solicita al panel que use el cliente REST vigente.
 */

import { nextTick, ref, watch } from 'vue'

const props = defineProps<{
  abierto: boolean
  presidencia: string
  secretaria: string
  puedeGuardar: boolean
  enviando: boolean
  mensajeError?: string | null
}>()

const emit = defineEmits<{
  actualizarPresidencia: [valor: string]
  actualizarSecretaria: [valor: string]
  guardar: []
  cancelar: []
}>()

const botonCancelar = ref<HTMLButtonElement | null>(null)
const elementoOrigen = ref<HTMLElement | null>(null)

watch(
  () => props.abierto,
  async (abierto) => {
    if (abierto) {
      elementoOrigen.value =
        typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)
      await nextTick()
      botonCancelar.value?.focus()
      return
    }

    await nextTick()
    elementoOrigen.value?.focus()
    elementoOrigen.value = null
  },
)

function valorDeEntrada(evento: Event): string {
  return (evento.target as HTMLInputElement | null)?.value ?? ''
}

function cancelar(): void {
  if (!props.enviando) emit('cancelar')
}

function guardar(): void {
  if (props.puedeGuardar && !props.enviando) emit('guardar')
}

function manejarTeclado(evento: KeyboardEvent): void {
  if (evento.key !== 'Escape') return
  evento.preventDefault()
  cancelar()
}
</script>

<template>
  <div
    v-if="abierto"
    data-testid="dialogo-edicion-autoridades"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="titulo-dialogo-autoridades"
    aria-describedby="descripcion-dialogo-autoridades"
    @keydown="manejarTeclado"
  >
    <form
      class="w-full max-w-lg space-y-3 rounded-xl border border-emerald-700 bg-slate-900 p-4 shadow-2xl"
      @submit.prevent="guardar"
    >
      <div class="border-b border-slate-800 pb-2">
        <h3 id="titulo-dialogo-autoridades" class="font-bold text-slate-100">Editar autoridades</h3>
        <p id="descripcion-dialogo-autoridades" class="mt-0.5 text-xs text-slate-400">
          Los cambios se confirman mediante el estado autoritativo del backend.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="text-xs font-semibold text-slate-300">
          Presidencia
          <input
            :value="presidencia"
            data-testid="input-presidencia-modal"
            type="text"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            :disabled="enviando"
            @input="emit('actualizarPresidencia', valorDeEntrada($event))"
          />
        </label>

        <label class="text-xs font-semibold text-slate-300">
          Secretaría Legislativa
          <input
            :value="secretaria"
            data-testid="input-secretaria-modal"
            type="text"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            :disabled="enviando"
            @input="emit('actualizarSecretaria', valorDeEntrada($event))"
          />
        </label>
      </div>

      <p
        v-if="mensajeError"
        data-testid="error-autoridades-modal"
        class="rounded border border-rose-700 bg-rose-950/70 p-2 text-xs text-rose-200"
        role="alert"
      >
        {{ mensajeError }}
      </p>

      <div class="flex justify-end gap-2 border-t border-slate-800 pt-3">
        <button
          ref="botonCancelar"
          type="button"
          data-testid="btn-cancelar-autoridades"
          class="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"
          :disabled="enviando"
          @click="cancelar"
        >
          Cancelar
        </button>
        <button
          type="button"
          data-testid="btn-guardar-autoridades"
          class="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"
          :disabled="!puedeGuardar || enviando"
          @click="guardar"
        >
          {{ enviando ? 'Guardando...' : 'Guardar autoridades' }}
        </button>
      </div>
    </form>
  </div>
</template>
