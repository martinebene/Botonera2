<script setup lang="ts">
/**
 * Superficie de aviso técnico compartida por Moderación y la Pantalla del Recinto (WP-056).
 *
 * Un aviso publicado por Apoyo Técnico **reemplaza** una superficie concreta de la
 * interfaz: el cuadrante 4 completo en Moderación y la franja de votación/tema/estado en
 * el Recinto. Este componente es esa superficie de reemplazo, y es un único componente
 * compartido porque las reglas que HUMAN_GATE cerró son idénticas en las dos pantallas:
 *
 * - el aviso no tiene scroll interno ni provoca scroll de página;
 * - usa el mayor cuerpo de letra que entre en el espacio disponible;
 * - si ni el cuerpo mínimo alcanza, recorta el excedente con `…` visible.
 *
 * Deliberadamente **no** usa clases de Tailwind: se estiliza con CSS propio del
 * componente. Moderación está construida con utilidades de Tailwind y el Recinto con CSS
 * propio; un componente compartido que dependiera del escaneo de clases de una de las dos
 * aplicaciones sería frágil. Con estilos propios se ve igual en ambas sin condiciones.
 *
 * ### Cómo evita bucles de medición
 *
 * El único disparador de un nuevo cálculo es un cambio real de las tres entradas del
 * problema: el texto, el ancho útil y el alto útil de la superficie. El `ResizeObserver`
 * escucha al **contenedor**, cuyo tamaño lo fija la grilla que lo aloja y no el texto que
 * contiene; por eso cambiar el cuerpo de letra no puede volver a disparar el observador.
 * Además se recuerda la última terna medida y se descarta cualquier notificación que no
 * la modifique. La decisión se escribe una sola vez por cambio.
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ajustarTamanoAviso, lineasVisiblesAviso } from '../aviso_adaptable'

const props = withDefaults(
  defineProps<{
    /** Texto autoritativo del aviso, tal como lo publicó Apoyo Técnico. */
    texto: string
    /** Rótulo breve que identifica la superficie; no compite con el texto del aviso. */
    rotulo?: string
    /** Cuerpo mínimo legible, en píxeles, antes de recurrir al recorte con elipsis. */
    tamanoMinimo?: number
    /** Cuerpo máximo, en píxeles, aunque sobre espacio disponible. */
    tamanoMaximo?: number
    /** Identificador estable para las pruebas de DOM y de geometría. */
    dataTestid?: string
  }>(),
  {
    rotulo: 'Aviso de Apoyo Técnico',
    tamanoMinimo: 14,
    tamanoMaximo: 128,
    dataTestid: 'aviso-tecnico',
  },
)

/** Interlineado del texto del aviso. Debe coincidir con `line-height` del estilo. */
const INTERLINEADO = 1.15

const contenedor = ref<HTMLElement | null>(null)
const parrafo = ref<HTMLElement | null>(null)

const tamanoAjustado = ref(props.tamanoMinimo)
const truncado = ref(false)
const lineasVisibles = ref(1)

/** Terna ya resuelta (texto, ancho, alto); evita recalcular sin motivo. */
let ultimaMedicion: { texto: string; ancho: number; alto: number } | null = null
let observador: ResizeObserver | null = null

const estiloTexto = computed(() => ({
  fontSize: `${tamanoAjustado.value}px`,
  lineHeight: String(INTERLINEADO),
  // `-webkit-line-clamp` sigue siendo la forma soportada de recortar varias líneas con
  // elipsis. Sólo se aplica cuando el texto realmente no entra: mientras entre completo,
  // no debe existir ninguna posibilidad de recorte silencioso.
  ...(truncado.value ? { WebkitLineClamp: String(lineasVisibles.value) } : {}),
}))

/**
 * Recalcula el cuerpo de letra midiendo sobre el DOM real.
 *
 * Escribe tamaños de prueba directamente en el elemento y lee su desborde. Al terminar
 * deja el resultado en `tamanoAjustado`, y Vue vuelve a escribir el estilo definitivo a
 * través del binding; el valor de prueba nunca queda como estado final.
 */
function ajustar(): void {
  const caja = contenedor.value
  const texto = parrafo.value
  if (!caja || !texto) return

  const ancho = caja.clientWidth
  const alto = caja.clientHeight

  // Sin superficie medible (montaje inicial, entorno de pruebas sin layout) no hay nada
  // que decidir todavía: se conserva el cuerpo mínimo y se espera una medida real.
  if (ancho <= 0 || alto <= 0) return

  if (
    ultimaMedicion !== null &&
    ultimaMedicion.texto === props.texto &&
    ultimaMedicion.ancho === ancho &&
    ultimaMedicion.alto === alto
  ) {
    return
  }

  const estiloPrevio = texto.style.cssText

  // Durante la medición el párrafo debe poder desbordar; si estuviera recortado, el
  // navegador informaría que "entra" en cualquier cuerpo y la búsqueda perdería sentido.
  texto.style.webkitLineClamp = ''
  texto.style.display = 'block'

  const resultado = ajustarTamanoAviso({
    tamanoMinimo: props.tamanoMinimo,
    tamanoMaximo: props.tamanoMaximo,
    entra: (tamano) => {
      texto.style.fontSize = `${tamano}px`
      return texto.scrollHeight <= alto && texto.scrollWidth <= ancho
    },
  })

  texto.style.cssText = estiloPrevio

  tamanoAjustado.value = resultado.tamano
  truncado.value = resultado.truncado
  lineasVisibles.value = resultado.truncado
    ? lineasVisiblesAviso(alto, resultado.tamano, INTERLINEADO)
    : 1
  ultimaMedicion = { texto: props.texto, ancho, alto }
}

/** Programa el ajuste después del render para medir el texto ya montado. */
async function ajustarTrasRender(): Promise<void> {
  await nextTick()
  ajustar()
}

watch(() => props.texto, ajustarTrasRender)

onMounted(() => {
  void ajustarTrasRender()

  // `ResizeObserver` puede no existir en el DOM liviano de las pruebas unitarias. Su
  // ausencia no es un error: sin cambios de tamaño alcanza con el ajuste del montaje.
  if (typeof ResizeObserver === 'undefined' || !contenedor.value) return
  observador = new ResizeObserver(() => ajustar())
  observador.observe(contenedor.value)
})

onBeforeUnmount(() => {
  observador?.disconnect()
  observador = null
})

defineExpose({ ajustar })
</script>

<template>
  <section
    ref="contenedor"
    :data-testid="dataTestid"
    :data-truncado="truncado ? 'si' : 'no'"
    class="aviso-superficie"
    role="status"
    aria-live="polite"
    :aria-label="rotulo"
  >
    <p ref="parrafo" data-testid="texto-aviso" class="texto-aviso" :style="estiloTexto">
      {{ texto }}
    </p>
  </section>
</template>

<style scoped>
/*
  La superficie ocupa exactamente la celda que le asigna la grilla anfitriona y recorta
  cualquier excedente. `overflow: hidden` —y no `auto`— es lo que materializa la decisión
  humana de que un aviso jamás tenga scroll propio.
*/
.aviso-superficie {
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  padding: clamp(0.5rem, 1.2vw, 1.4rem);
  overflow: hidden;
  border: 1px solid rgba(250, 204, 21, 0.55);
  border-radius: 14px;
  color: #fefce8;
  background: linear-gradient(155deg, rgba(69, 26, 3, 0.94), rgba(28, 25, 23, 0.96));
  box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.12);
}

/*
  El párrafo es el elemento medido. `max-width/max-height: 100%` lo obligan a competir
  contra la superficie real y `overflow-wrap: anywhere` evita que una palabra larga
  produzca desborde horizontal en lugar de reducir el cuerpo de letra.
*/
.texto-aviso {
  max-width: 100%;
  max-height: 100%;
  margin: 0;
  overflow: hidden;
  font-weight: 800;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
  text-align: center;
}

/*
  Recorte con elipsis. La cantidad de líneas la fija el estilo en línea calculado por el
  componente; acá sólo se declara el modo de caja que habilita `-webkit-line-clamp`.
*/
.aviso-superficie[data-truncado='si'] .texto-aviso {
  display: -webkit-box;
  -webkit-box-orient: vertical;
}
</style>
