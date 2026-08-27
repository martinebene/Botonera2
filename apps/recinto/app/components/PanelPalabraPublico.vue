<script setup lang="ts">
/** Orador y cola FIFO pública, presentados exactamente en el orden del backend. */

import type { EstadoPalabraPublico } from '@botonera2/api-client'

defineProps<{ palabra: EstadoPalabraPublico | null }>()
</script>

<template>
  <section data-testid="panel-palabra" class="panel-palabra">
    <p class="rotulo-panel">Uso de la palabra</p>

    <div v-if="palabra?.orador" data-testid="orador-actual" class="orador-actual">
      <span>En este momento</span>
      <strong>{{ palabra.orador.nombre }} {{ palabra.orador.apellido }}</strong>
      <small>Banca {{ palabra.orador.banca }}</small>
    </div>
    <p v-else class="sin-orador">Sin orador en este momento</p>

    <div class="encabezado-cola">
      <span>Pedidos</span>
      <b>{{ palabra?.cola.length ?? 0 }}</b>
    </div>
    <ol v-if="palabra?.cola.length" data-testid="cola-palabra" class="cola-palabra">
      <li v-for="(persona, indice) in palabra.cola" :key="`${persona.banca}-${indice}`">
        <span class="orden-cola">{{ indice + 1 }}</span>
        <span class="persona-cola">
          <strong>{{ persona.nombre }} {{ persona.apellido }}</strong>
          <small>Banca {{ persona.banca }}</small>
        </span>
      </li>
    </ol>
    <p v-else class="cola-vacia">No hay pedidos en espera</p>
  </section>
</template>

<style scoped>
.panel-palabra {
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: clamp(0.85rem, 1.4vw, 1.25rem);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.78);
}

.rotulo-panel,
.encabezado-cola {
  color: #94a3b8;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.rotulo-panel {
  margin: 0 0 0.7rem;
}

.orador-actual {
  padding: 0.85rem;
  border: 1px solid rgba(56, 189, 248, 0.55);
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(7, 89, 133, 0.65), rgba(8, 47, 73, 0.78));
}

.orador-actual span,
.orador-actual strong,
.orador-actual small {
  display: block;
}

.orador-actual span {
  color: #7dd3fc;
  font-size: 0.62rem;
  font-weight: 900;
  text-transform: uppercase;
}

.orador-actual strong {
  margin-top: 0.25rem;
  font-size: clamp(0.9rem, 1.6vw, 1.2rem);
  line-height: 1.1;
}

.orador-actual small {
  margin-top: 0.3rem;
  color: #bae6fd;
}

.sin-orador,
.cola-vacia {
  margin: 0;
  color: #64748b;
  font-size: 0.76rem;
}

.sin-orador {
  padding: 0.75rem;
  border: 1px dashed rgba(100, 116, 139, 0.45);
  border-radius: 12px;
}

.encabezado-cola {
  display: flex;
  justify-content: space-between;
  margin: 1rem 0 0.5rem;
}

.encabezado-cola b {
  color: #e2e8f0;
}

.cola-palabra {
  min-height: 0;
  margin: 0;
  padding: 0 0.15rem 0 0;
  overflow-y: auto;
  list-style: none;
}

.cola-palabra li {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0;
  border-top: 1px solid rgba(148, 163, 184, 0.13);
}

.orden-cola {
  display: grid;
  place-items: center;
  width: 1.65rem;
  height: 1.65rem;
  flex: 0 0 auto;
  border-radius: 50%;
  color: #0c4a6e;
  background: #bae6fd;
  font-size: 0.7rem;
  font-weight: 900;
}

.persona-cola {
  min-width: 0;
}

.persona-cola strong,
.persona-cola small {
  display: block;
}

.persona-cola strong {
  overflow: hidden;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.persona-cola small {
  margin-top: 0.15rem;
  color: #94a3b8;
  font-size: 0.65rem;
}
</style>
