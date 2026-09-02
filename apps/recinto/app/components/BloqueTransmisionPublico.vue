<script setup lang="ts">
/**
 * Indicador público de transmisión (WP-056).
 *
 * Ocupa el quinto superior de la columna derecha del Recinto y representa los tres
 * estados que decide el backend, sin decidir ninguna transición por su cuenta:
 *
 * - `APAGADO`: presencia discreta. No se oculta el bloque porque su altura está
 *   reservada por la grilla; si desapareciera, los pedidos de palabra se moverían cada
 *   vez que Apoyo Técnico enciende o apaga la transmisión. Es la misma razón por la que
 *   la franja de votación conserva su alto aunque no haya votación.
 * - `CUENTA_REGRESIVA`: número grande, legible desde el fondo de la sala.
 * - `EN_VIVO`: rótulo `● EN VIVO` claramente visible.
 *
 * El número que baja lo calcula `usePresentacionTransmision` a partir de la frontera
 * absoluta `en_vivo_desde`; este componente sólo lo dibuja. Cuando la cuenta termina, el
 * backend republica y el estado pasa a `EN_VIVO`: la pantalla nunca hace esa transición
 * por sí misma, ni siquiera cuando el contador visual llega a cero.
 */

import type { TransmisionProyectada } from '@botonera2/api-client'

defineProps<{
  /** Estado autoritativo de la transmisión proyectado por el backend. */
  transmision: TransmisionProyectada | null
  /** Segundos que faltan para EN VIVO, derivados del reloj local calibrado. */
  segundosRestantes: number | null
}>()
</script>

<template>
  <section
    data-testid="bloque-transmision"
    class="bloque-transmision"
    :data-estado-transmision="transmision?.estado ?? 'APAGADO'"
    role="status"
    aria-live="polite"
  >
    <template v-if="transmision?.estado === 'CUENTA_REGRESIVA'">
      <span class="rotulo-transmision">Sale al aire en</span>
      <strong data-testid="cuenta-regresiva-transmision" class="cuenta-transmision">
        {{ segundosRestantes ?? 0 }}
      </strong>
    </template>

    <strong v-else-if="transmision?.estado === 'EN_VIVO'" data-testid="en-vivo" class="en-vivo">
      <span aria-hidden="true">●</span> EN VIVO
    </strong>

    <span v-else data-testid="transmision-apagada" class="transmision-apagada">
      Transmisión apagada
    </span>
  </section>
</template>

<style scoped>
/*
  El bloque llena la celda que le asigna la columna derecha y recorta cualquier
  excedente: nunca puede empujar hacia abajo a los pedidos de palabra.
*/
.bloque-transmision {
  min-width: 0;
  min-height: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.1rem;
  padding: clamp(0.3rem, 0.6vw, 0.6rem);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.78);
  text-align: center;
}

/* En vivo: el borde también comunica el estado a quien mira de lejos. */
.bloque-transmision[data-estado-transmision='EN_VIVO'] {
  border-color: rgba(248, 113, 113, 0.65);
  background: rgba(69, 10, 10, 0.55);
}

.bloque-transmision[data-estado-transmision='CUENTA_REGRESIVA'] {
  border-color: rgba(125, 211, 252, 0.55);
  background: rgba(8, 47, 73, 0.5);
}

.rotulo-transmision {
  color: #bae6fd;
  font-size: clamp(0.52rem, 0.66vw, 0.72rem);
  font-weight: 900;
  letter-spacing: 0.14em;
  line-height: 1.1;
  text-transform: uppercase;
}

/*
  La cuenta usa el mayor cuerpo que admite un quinto de la columna derecha. El límite
  superior del `clamp` está calibrado contra ese alto disponible para que el número no
  quede recortado en Full HD.
*/
.cuenta-transmision {
  color: #f8fafc;
  font-size: clamp(1.8rem, 4.2vh, 3.4rem);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-shadow: 0 0 24px rgba(56, 189, 248, 0.45);
}

.en-vivo {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  overflow: hidden;
  color: #fecaca;
  font-size: clamp(0.95rem, 1.6vh, 1.6rem);
  font-weight: 900;
  letter-spacing: 0.12em;
  line-height: 1.1;
  white-space: nowrap;
}

.en-vivo span {
  color: #f87171;
}

/*
  Apagado: deliberadamente discreto. Comunica que el indicador existe y funciona, sin
  competir con los pedidos de palabra que ocupan los cuatro quintos inferiores.
*/
.transmision-apagada {
  overflow: hidden;
  color: #64748b;
  font-size: clamp(0.56rem, 0.72vw, 0.78rem);
  font-weight: 700;
  letter-spacing: 0.1em;
  line-height: 1.1;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}
</style>
