<script setup lang="ts">
/**
 * Componente contenedor estructural para los paneles del cuadrante de Moderación.
 *
 * Garantiza:
 * 1. Altura y dimensiones acotadas que impiden que el contenido crezca empujando a otros paneles.
 * 2. Encabezado fijo con título accesible, subtítulo opcional y badges de estado.
 * 3. Área de contenido con scroll interno independiente (overflow-y-auto + min-h-0).
 *
 * Densidad (WP-036): el encabezado y el cuerpo usan tipografía y espaciados reducidos.
 * Cada cuadrante ahorra así altura de chrome, que es la que necesita la grilla 2×2 para
 * entrar completa a 1366×768. El componente nunca fija su altura en píxeles: siempre
 * ocupa el 100 % de la celda de grilla que le asigna el shell.
 *
 * WP-037 agrega una excepción explícita para Q1: `contenidoSinScroll` cambia el
 * cuerpo a `overflow-hidden` desde el breakpoint desktop. El panel de Sesión y
 * votación debe componer todos sus estados dentro del alto disponible y sus pruebas
 * verifican además que el contenido no quede recortado (`scrollHeight <= clientHeight`).
 * En pantallas menores vuelve el scroll defensivo para preservar la adaptación.
 *
 * WP-040 suma `contenidoConScrollPropio` para paneles que necesitan mantener controles
 * fijos y desplazar solamente una colección interna. En ese modo el contenedor exterior
 * nunca scrollea: el componente hijo debe declarar de forma explícita cuál de sus áreas
 * usa `overflow-y-auto`. Esto permite que Q2 mantenga accesible la acción de quitar.
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
  /** Desactiva el scroll interno en desktop cuando el contenido debe caber completo. */
  contenidoSinScroll?: boolean
  /** Delega el scroll a una colección interna para conservar fijos los controles del cuerpo. */
  contenidoConScrollPropio?: boolean
}>()
</script>

<template>
  <section
    :data-testid="dataTestid"
    class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/90 shadow-sm"
  >
    <!-- Encabezado del panel -->
    <header
      class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-1.5 bg-slate-900"
    >
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-sm font-semibold text-slate-100">
          {{ titulo }}
        </h2>
        <p v-if="subtitulo" class="truncate text-[11px] leading-tight text-slate-400">
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
    <div
      data-testid="cuerpo-panel"
      class="flex-1 min-h-0"
      :class="
        contenidoConScrollPropio
          ? 'overflow-hidden p-2'
          : contenidoSinScroll
            ? 'overflow-y-auto p-2 lg:overflow-hidden'
            : 'overflow-y-auto p-3'
      "
    >
      <slot />
    </div>
  </section>
</template>
