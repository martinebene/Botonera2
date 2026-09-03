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
 *
 * ### Qué corrigió WP-060
 *
 * El "espacio disponible" es la **caja de contenido** de la superficie: lo que queda tras
 * descontar borde y relleno. Medir contra la caja exterior le regalaba al texto los dos
 * rellenos, y el sobrante terminaba recortado contra el borde inferior sin que nadie lo
 * declarara. `medirCajaUtil` es el lugar único donde se responde esa pregunta.
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
 * Mide el área donde el texto realmente puede dibujarse: la *caja de contenido*.
 *
 * Es el corazón de la corrección de WP-060. `clientWidth`/`clientHeight` de un elemento
 * **incluyen su relleno interior** y sólo excluyen el borde. Como esta superficie tiene
 * un `padding` propio, medir contra `clientHeight` regalaba al texto los dos rellenos
 * —arriba y abajo— como si fueran espacio escribible. El párrafo, en cambio, vive dentro
 * de la caja de contenido y está limitado por `max-height: 100%` más `overflow: hidden`,
 * así que ese excedente no se veía: se recortaba en silencio y la última línea aparecía
 * cortada aunque el componente informara `data-truncado="no"`.
 *
 * Por eso acá se descuentan explícitamente los cuatro rellenos computados. Se parte de
 * `clientWidth`/`clientHeight` —y no de `getBoundingClientRect()`— porque esas dos
 * propiedades ya excluyen el borde y cualquier barra de desplazamiento, y porque no las
 * altera una transformación CSS de un ancestro, que sí deformaría el rectángulo medido y
 * llevaría a elegir un cuerpo de letra que no corresponde a los píxeles reales.
 *
 * @param caja Superficie del aviso, ya montada en el documento.
 * @returns Ancho y alto útiles en píxeles CSS; pueden ser fraccionarios.
 */
function medirCajaUtil(caja: HTMLElement): { ancho: number; alto: number } {
  // Sin caja exterior no hay nada que descontar. Es lo que ocurre en el montaje inicial y
  // en el DOM liviano de las pruebas unitarias, que no calcula layout y puede ni siquiera
  // definir estas propiedades; por eso se exige un número y no sólo un valor positivo.
  const anchoExterior = caja.clientWidth
  const altoExterior = caja.clientHeight
  if (!Number.isFinite(anchoExterior) || anchoExterior <= 0) return { ancho: 0, alto: 0 }
  if (!Number.isFinite(altoExterior) || altoExterior <= 0) return { ancho: 0, alto: 0 }

  // El estilo computado se pide a la ventana dueña del elemento en lugar del `window`
  // global: así el componente sigue siendo utilizable en entornos donde ese global no
  // existe, y allí simplemente informa que todavía no hay superficie medible.
  const vista = caja.ownerDocument?.defaultView ?? null
  if (vista === null || typeof vista.getComputedStyle !== 'function') {
    return { ancho: 0, alto: 0 }
  }

  const estilo = vista.getComputedStyle(caja)
  const aPixeles = (valor: string): number => {
    const numero = Number.parseFloat(valor)
    return Number.isFinite(numero) ? numero : 0
  }
  return {
    ancho: anchoExterior - aPixeles(estilo.paddingLeft) - aPixeles(estilo.paddingRight),
    alto: altoExterior - aPixeles(estilo.paddingTop) - aPixeles(estilo.paddingBottom),
  }
}

/**
 * Recalcula el cuerpo de letra midiendo sobre el DOM real.
 *
 * Escribe tamaños de prueba directamente en el elemento y lee su desborde. Al terminar
 * deja el resultado en `tamanoAjustado`, y Vue vuelve a escribir el estilo definitivo a
 * través del binding; el valor de prueba nunca queda como estado final.
 *
 * La pregunta "¿entra?" se responde siempre contra la caja de contenido calculada por
 * `medirCajaUtil`, nunca contra la caja exterior. Así el relleno queda reservado para el
 * relleno: el texto elegido no lo invade, el centrado de la grilla reparte lo que sobra
 * en partes iguales arriba y abajo, y la elipsis sólo aparece cuando el texto de verdad
 * no entra ni con el cuerpo mínimo.
 */
function ajustar(): void {
  const caja = contenedor.value
  const texto = parrafo.value
  if (!caja || !texto) return

  const util = medirCajaUtil(caja)

  // Sin superficie medible (montaje inicial, entorno de pruebas sin layout) no hay nada
  // que decidir todavía: se conserva el cuerpo mínimo y se espera una medida real.
  if (util.ancho <= 0 || util.alto <= 0) return

  if (
    ultimaMedicion !== null &&
    ultimaMedicion.texto === props.texto &&
    ultimaMedicion.ancho === util.ancho &&
    ultimaMedicion.alto === util.alto
  ) {
    return
  }

  // `scrollWidth`/`scrollHeight` son enteros redondeados, mientras que el área útil puede
  // ser fraccionaria porque el relleno se declara con `clamp()` en unidades de viewport.
  // Se compara contra el entero inferior del área útil: perder esa fracción de píxel es
  // invisible, y garantiza que el redondeo nunca autorice un cuerpo que después se corte.
  const anchoUtil = Math.floor(util.ancho)
  const altoUtil = Math.floor(util.alto)

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
      return texto.scrollHeight <= altoUtil && texto.scrollWidth <= anchoUtil
    },
  })

  texto.style.cssText = estiloPrevio

  tamanoAjustado.value = resultado.tamano
  truncado.value = resultado.truncado
  lineasVisibles.value = resultado.truncado
    ? lineasVisiblesAviso(altoUtil, resultado.tamano, INTERLINEADO)
    : 1
  ultimaMedicion = { texto: props.texto, ancho: util.ancho, alto: util.alto }
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
