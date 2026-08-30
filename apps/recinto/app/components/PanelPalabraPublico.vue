<script setup lang="ts">
/** Cola FIFO pública; el orador se comunica exclusivamente en su banca resaltada. */

import type { EstadoPalabraPublico } from '@botonera2/api-client'

defineProps<{ palabra: EstadoPalabraPublico | null }>()
</script>

<template>
  <section data-testid="panel-palabra" class="panel-palabra">
    <div class="encabezado-cola">
      <span>Pedidos de uso de la palabra</span>
      <b data-testid="cantidad-pedidos-palabra">{{ palabra?.cola.length ?? 0 }}</b>
    </div>

    <!-- La lista conserva el orden recibido; no consulta ni reordena al orador. -->
    <ol
      v-if="palabra?.cola.length"
      data-testid="cola-palabra"
      class="cola-palabra"
      aria-label="Pedidos de uso de la palabra en orden FIFO"
    >
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
  padding: clamp(0.65rem, 1vw, 0.9rem);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.78);
}

.encabezado-cola {
  display: flex;
  flex: 0 0 auto;
  justify-content: space-between;
  gap: 0.6rem;
  margin: 0 0 0.55rem;
  color: #94a3b8;
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.encabezado-cola b {
  min-width: 1.5rem;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  color: #e2e8f0;
  background: rgba(14, 116, 144, 0.38);
  text-align: center;
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
  padding: 0.52rem 0;
  border-top: 1px solid rgba(148, 163, 184, 0.13);
}

.orden-cola {
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  flex: 0 0 auto;
  border-radius: 50%;
  color: #0c4a6e;
  background: #bae6fd;
  font-size: 0.68rem;
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
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.persona-cola small {
  margin-top: 0.12rem;
  color: #94a3b8;
  font-size: 0.63rem;
}

.cola-vacia {
  min-height: 0;
  display: grid;
  flex: 1;
  place-items: center;
  margin: 0;
  color: #64748b;
  font-size: 0.76rem;
  text-align: center;
}
</style>
