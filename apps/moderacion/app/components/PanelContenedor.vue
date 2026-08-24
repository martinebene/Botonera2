<script setup lang="ts">
/**
 * Componente contenedor estructural para los paneles del cuadrante de Moderación.
 *
 * Garantiza:
 * 1. Altura y dimensiones acotadas que impiden que el contenido crezca empujando a otros paneles.
 * 2. Encabezado fijo con título accesible, subtítulo opcional y badges de estado.
 * 3. Área de contenido con scroll interno independiente (overflow-y-auto + min-h-0).
 */

defineProps<{
  /** Título principal del área operativa */
  titulo: string
  /** Subtítulo descriptivo u operativo */
  subtitulo?: string
  /** Texto del badge informativo o de estado */
  badge?: string
  /** Clases CSS adicionales para el badge */
  claseBadge?: string
  /** Identificador de pruebas para Playwright / Vitest */
  dataTestid?: string
}>()
</script>

<template>
  <section
    :data-testid="dataTestid"
    class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/90 shadow-sm"
  >
    <!-- Encabezado del panel -->
    <header
      class="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-900"
    >
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-base font-semibold text-slate-100">
          {{ titulo }}
        </h2>
        <p v-if="subtitulo" class="truncate text-xs text-slate-400">
          {{ subtitulo }}
        </p>
      </div>

      <!-- Badge o acciones opcionales de cabecera -->
      <div v-if="badge || $slots.acciones" class="flex shrink-0 items-center gap-2">
        <span
          v-if="badge"
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          :class="claseBadge || 'bg-slate-800 text-slate-300 border border-slate-700'"
        >
          {{ badge }}
        </span>
        <slot name="acciones" />
      </div>
    </header>

    <!-- Cuerpo del panel con scroll vertical interno aislado -->
    <div class="flex-1 min-h-0 overflow-y-auto p-4">
      <slot />
    </div>
  </section>
</template>
