<script setup lang="ts">
/**
 * Cabecera superior del Simulador Web de Dispositivos Lógicos.
 *
 * Muestra el título institucional, el distintivo inequívoco de que se trata
 * de un SIMULADOR que emite pulsaciones reales al backend, y la aclaración
 * arquitectónica de que opera directamente con FastAPI sin pasar por el device-bridge.
 */
</script>

<template>
  <header
    data-testid="cabecera-simulador"
    class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-4 py-2 text-slate-200 shrink-0"
  >
    <div class="flex items-center gap-3">
      <h1 class="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
        <span class="text-sky-400">Botonera2</span>
        <span class="text-slate-500">·</span>
        <span>Simulador de Dispositivos Lógicos</span>
      </h1>
      <span
        data-testid="badge-simulador"
        class="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/40 uppercase tracking-wider"
      >
        <span>⚠️</span>
        <span>Simulador · Entradas reales a FastAPI</span>
      </span>
    </div>
    <div class="text-xs text-slate-400 font-mono flex items-center gap-2">
      <span class="hidden md:inline text-slate-500">Arquitectura:</span>
      <span class="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-sky-300">
        /simulador/ &rarr; FastAPI (POST /api/v1/entradas/tecla) [sin device-bridge]
      </span>
    </div>
  </header>
</template>
