<script setup lang="ts">
/**
 * Barra indeterminada que continúa el indicador de carga después del montaje (WP-061).
 *
 * ## Qué problema resuelve
 *
 * El indicador previo a la hidratación vive en `carga_inicial.html` y lo elimina el
 * runtime de Nuxt en cuanto el árbol de Vue termina de montarse. Pero montarse no es lo
 * mismo que estar operativa: recién cuando llega el primer snapshot del backend por
 * REST/SSE la pantalla tiene datos reales que mostrar. Entre esos dos instantes la
 * interfaz ya pintó su fondo institucional, pero todavía está esperando.
 *
 * Este componente cubre exactamente esa segunda ventana. Es la misma barra, en la misma
 * posición y con la misma animación que el indicador previo, de modo que el operador ve
 * una sola señal continua desde que abre la pantalla hasta que la interfaz queda usable.
 *
 * ## Por qué está posicionado `fixed`
 *
 * WP-061 exige que el indicador desaparezca «sin dejar espacio». Al no participar del
 * flujo del documento, la barra no reserva altura: cuando el `v-if` de la aplicación la
 * quita, ningún panel se mueve. Por la misma razón no puede introducir scroll de página,
 * que es otro de los criterios de aceptación.
 *
 * ## Por qué no usa Tailwind
 *
 * Igual que `AvisoSuperficie.vue`, se estiliza con CSS propio del componente. Moderación,
 * Apoyo Técnico y el Simulador están construidos con utilidades de Tailwind y la Pantalla
 * del Recinto con CSS propio; un componente compartido que dependiera del escaneo de
 * clases de una de esas aplicaciones sería frágil.
 *
 * ## Lo que deliberadamente no hace
 *
 * No informa porcentaje alguno. El frontend no puede saber cuánto falta para que el
 * backend publique su primer snapshot, y HUMAN_GATE cerró que no se inventen avances.
 */

withDefaults(
  defineProps<{
    /** Texto que leen los lectores de pantalla mientras la espera está activa. */
    rotulo?: string
    /** Identificador estable para las pruebas de DOM y de geometría. */
    dataTestid?: string
  }>(),
  {
    rotulo: 'Esperando el primer estado del sistema',
    dataTestid: 'carga-inicial-aplicacion',
  },
)
</script>

<template>
  <div
    class="indicador-carga-inicial"
    role="status"
    aria-live="polite"
    :aria-label="rotulo"
    :data-testid="dataTestid"
  >
    <div class="indicador-carga-inicial__avance" />
  </div>
</template>

<style scoped>
/*
  Mismas medidas y colores que el riel de `carga_inicial.html`: el relevo entre los dos
  indicadores tiene que ser imperceptible. Si alguna vez cambia uno, debe cambiar el otro.
*/
.indicador-carga-inicial {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 60;
  height: 4px;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.22);
  pointer-events: none;
}

.indicador-carga-inicial__avance {
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, rgba(56, 189, 248, 0), #38bdf8, rgba(56, 189, 248, 0));
  animation: indicador-carga-inicial-avance 1.4s ease-in-out infinite;
}

@keyframes indicador-carga-inicial-avance {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}

/* Misma consideración de accesibilidad que el indicador previo a la hidratación. */
@media (prefers-reduced-motion: reduce) {
  .indicador-carga-inicial__avance {
    width: 100%;
    animation: indicador-carga-inicial-latido 2s ease-in-out infinite;
  }

  @keyframes indicador-carga-inicial-latido {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }
}
</style>
