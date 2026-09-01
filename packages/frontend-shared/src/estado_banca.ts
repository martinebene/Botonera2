/**
 * Semántica visual común de una banca para Moderación (Q3) y Pantalla del Recinto.
 *
 * WP-045 exige que una misma combinación de datos produzca exactamente el mismo
 * estado principal, la misma etiqueta y la misma familia cromática en las dos
 * superficies. Para lograrlo sin obligar a compartir el componente Vue —que sí
 * difiere en escala y layout—, la decisión se concentra en esta función pura:
 * los componentes solo consumen su resultado y lo pintan.
 *
 * Este módulo no conoce Vue, no lee el DTO completo ni hace peticiones: recibe
 * datos primitivos ya extraídos del snapshot autoritativo del backend.
 */

/**
 * Estado principal único de una banca.
 *
 * Nunca puede haber dos estados principales a la vez: la prioridad definida por
 * HUMAN_GATE resuelve cualquier combinación simultánea. Los valores se usan
 * también como atributo `data-estado-banca`, de modo que las pruebas de DOM
 * puedan afirmar el estado sin depender del color ni del texto.
 */
export type EstadoPrincipalBanca =
  | 'NORMAL'
  | 'AUSENTE'
  | 'PALABRA'
  | 'TEST'
  | 'VOTO_EMITIDO'
  | 'RESULTADO_POSITIVO'
  | 'RESULTADO_NEGATIVO'
  | 'RESULTADO_ABSTENCION'

/** Familias cromáticas aprobadas, tomadas de la instalación en producción. */
export type FamiliaCromaticaBanca =
  'BLANCO' | 'GRIS' | 'NARANJA' | 'AZUL' | 'CIAN' | 'VERDE' | 'ROJO' | 'OCRE'

/** Datos mínimos necesarios para decidir el estado visual de una banca. */
export interface EntradaEstadoBanca {
  /** Presencia institucional proyectada por el backend. */
  presente: boolean
  /** Test físico de teclado vigente; nunca altera presencia ni quórum. */
  testActivo: boolean
  /** Verdadero solo para la banca del orador actual, derivada de `palabra.orador`. */
  esOrador: boolean
  /**
   * `estado_recepcion` de la votación relevante, o `null` si no hay votación.
   *
   * Es el interruptor del secreto: mientras vale `EN_CURSO` esta función ignora
   * por completo cualquier sentido de voto que le pasen, aunque el llamador se
   * equivoque. Así el secreto no depende de la disciplina de cada componente.
   */
  estadoRecepcion: string | null
  /** La banca figura en `bancas_voto_emitido`, es decir ya votó (sin sentido). */
  votoEmitido: boolean
  /** Sentido final (`POSITIVO`/`NEGATIVO`/`ABSTENCION`) solo tras el cierre. */
  valorVotoFinal: string | null
}

/** Resultado completo que los componentes representan sin volver a decidir. */
export interface PresentacionBanca {
  /** Estado principal único según la prioridad aprobada. */
  estado: EstadoPrincipalBanca
  /**
   * Única etiqueta textual visible, o `null` cuando no corresponde ninguna.
   *
   * `NORMAL` y `TEST` no llevan etiqueta: el primero porque no aporta nada y el
   * segundo por decisión explícita de HUMAN_GATE.
   */
  etiqueta: string | null
  /** Texto equivalente para `aria-label`; siempre presente aunque no se dibuje. */
  etiquetaAccesible: string
  /** Familia cromática del fondo principal. */
  familia: FamiliaCromaticaBanca
  /** Test activo subordinado a un estado de mayor prioridad: solo halo, sin texto. */
  haloTest: boolean
  /** Uso de palabra subordinado a un estado de mayor prioridad: solo halo. */
  haloPalabra: boolean
}

/** Datos mínimos para decidir si todavía puede pintarse un resultado individual. */
export interface EntradaVisibilidadResultadoBanca {
  /** Estado de recepción autoritativo de la votación. */
  estadoRecepcion: string | null
  /** Resultado institucional, o `null` mientras todavía no fue calculado. */
  resultado: string | null
  /** Deadline común calculado por backend para Q3 y Recinto. */
  resultadoVisibleHasta: string | null
  /** Instante actual expresado en el reloj backend calibrado por el frontend. */
  ahoraBackend: number
}

/**
 * Decide si los sentidos individuales siguen dentro del ciclo visual común.
 *
 * La función no conoce una duración en segundos: compara exclusivamente contra
 * `resultado_visible_hasta`, calculado una sola vez por backend. `EMPATADA`
 * permanece visible sin deadline mientras espera a Presidencia. Durante
 * `EN_CURSO` siempre devuelve `false`, aunque un DTO privado transporte votos por
 * otra política, y preserva así el mismo secreto visual en ambas superficies.
 */
export function resultadoIndividualVisible(entrada: EntradaVisibilidadResultadoBanca): boolean {
  if (entrada.estadoRecepcion === 'EN_CURSO' || entrada.resultado === null) return false
  if (entrada.resultado === 'EMPATADA') return true

  const limite = entrada.resultadoVisibleHasta
    ? Date.parse(entrada.resultadoVisibleHasta)
    : Number.NaN
  return Number.isFinite(limite) && entrada.ahoraBackend < limite
}

/** Paleta de una familia cromática, aplicada como custom properties CSS. */
export interface ColoresBanca {
  /** Fondo principal de la tarjeta. */
  fondo: string
  /** Borde del mismo grupo cromático, con tono algo distinto del fondo. */
  borde: string
  /** Color de la etiqueta única, elegido para contrastar sobre `fondo`. */
  textoEtiqueta: string
  /** Fondo de la franja de etiqueta; se apoya en el fondo principal. */
  fondoEtiqueta: string
}

/**
 * Paleta compartida por ambas superficies.
 *
 * Los tonos derivan de la instalación histórica (`app.css` de la pantalla en
 * `martinebene/Botonera`), con ajustes menores de contraste para que el texto de
 * la etiqueta sea legible. Al exportarse desde un único módulo, Q3 y Recinto no
 * pueden divergir aunque cada uno tenga su propia hoja de estilos.
 */
export const PALETA_BANCAS: Record<FamiliaCromaticaBanca, ColoresBanca> = {
  // Presente normal: blanco puro, como en producción.
  BLANCO: {
    fondo: '#ffffff',
    borde: '#c7d2dd',
    textoEtiqueta: '#0f172a',
    fondoEtiqueta: 'rgba(15, 23, 42, 0.06)',
  },
  // Ausente: gris de producción, cercano a rgba(160,160,160,.5).
  GRIS: {
    fondo: '#a0a0a0',
    borde: '#7b7b7b',
    textoEtiqueta: '#1a1a1a',
    fondoEtiqueta: 'rgba(0, 0, 0, 0.16)',
  },
  // Uso de la palabra: naranja #c65a00.
  NARANJA: {
    fondo: '#c65a00',
    borde: '#8f4100',
    textoEtiqueta: '#fff4e8',
    fondoEtiqueta: 'rgba(0, 0, 0, 0.24)',
  },
  // Test de dispositivo: celeste #4aabff, sin etiqueta textual.
  AZUL: {
    fondo: '#4aabff',
    borde: '#1a7fd4',
    textoEtiqueta: '#062038',
    fondoEtiqueta: 'rgba(255, 255, 255, 0.28)',
  },
  // Voto emitido: cian suave deliberadamente distinto del azul de test.
  CIAN: {
    fondo: '#7fe3df',
    borde: '#2ca9a5',
    textoEtiqueta: '#04353a',
    fondoEtiqueta: 'rgba(255, 255, 255, 0.42)',
  },
  // Resultado positivo: verde #1b7246.
  VERDE: {
    fondo: '#1b7246',
    borde: '#0f4d2e',
    textoEtiqueta: '#e9fff3',
    fondoEtiqueta: 'rgba(0, 0, 0, 0.24)',
  },
  // Resultado negativo: rojo #882329.
  ROJO: {
    fondo: '#882329',
    borde: '#5c1418',
    textoEtiqueta: '#ffeceb',
    fondoEtiqueta: 'rgba(0, 0, 0, 0.24)',
  },
  // Abstención: amarillo/ocre #8c781e.
  OCRE: {
    fondo: '#8c781e',
    borde: '#645410',
    textoEtiqueta: '#fffbe6',
    fondoEtiqueta: 'rgba(0, 0, 0, 0.22)',
  },
}

/** Familia cromática que corresponde a cada estado principal. */
const FAMILIA_POR_ESTADO: Record<EstadoPrincipalBanca, FamiliaCromaticaBanca> = {
  NORMAL: 'BLANCO',
  AUSENTE: 'GRIS',
  PALABRA: 'NARANJA',
  TEST: 'AZUL',
  VOTO_EMITIDO: 'CIAN',
  RESULTADO_POSITIVO: 'VERDE',
  RESULTADO_NEGATIVO: 'ROJO',
  RESULTADO_ABSTENCION: 'OCRE',
}

/**
 * Etiqueta visible de cada estado.
 *
 * `null` significa "no dibujar ninguna franja de texto". Solo existe una entrada
 * por estado, lo que hace imposible por construcción mostrar dos etiquetas.
 */
const ETIQUETA_VISIBLE: Record<EstadoPrincipalBanca, string | null> = {
  NORMAL: null,
  AUSENTE: 'Ausente',
  PALABRA: 'En uso de la palabra',
  TEST: null,
  VOTO_EMITIDO: 'Voto emitido',
  RESULTADO_POSITIVO: 'Positivo',
  RESULTADO_NEGATIVO: 'Negativo',
  RESULTADO_ABSTENCION: 'Abstención',
}

/** Texto para lectores de pantalla; incluye los estados que no se dibujan. */
const ETIQUETA_ACCESIBLE: Record<EstadoPrincipalBanca, string> = {
  NORMAL: 'presente',
  AUSENTE: 'ausente',
  PALABRA: 'en uso de la palabra',
  TEST: 'test de dispositivo activo',
  VOTO_EMITIDO: 'voto emitido',
  RESULTADO_POSITIVO: 'voto positivo',
  RESULTADO_NEGATIVO: 'voto negativo',
  RESULTADO_ABSTENCION: 'abstención',
}

/** Sentidos finales aceptados y su estado principal asociado. */
const ESTADO_POR_VALOR_FINAL: Record<string, EstadoPrincipalBanca> = {
  POSITIVO: 'RESULTADO_POSITIVO',
  NEGATIVO: 'RESULTADO_NEGATIVO',
  ABSTENCION: 'RESULTADO_ABSTENCION',
}

/**
 * Calcula el estado visual único de una banca.
 *
 * Prioridad aprobada por HUMAN_GATE, de mayor a menor:
 *
 * 1. resultado individual final ya publicado;
 * 2. `Voto emitido` mientras la recepción sigue `EN_CURSO`;
 * 3. test de dispositivo activo;
 * 4. uso de la palabra;
 * 5. ausencia;
 * 6. presente normal.
 *
 * Los estados de menor prioridad que siguen siendo ciertos no desaparecen del
 * todo: test y palabra se conservan como halo (`haloTest`/`haloPalabra`), que es
 * una señal no textual y por lo tanto no viola el máximo de una etiqueta.
 *
 * @param entrada Datos primitivos ya extraídos del snapshot del backend.
 * @returns Estado principal, etiqueta, familia cromática y halos secundarios.
 */
export function calcularPresentacionBanca(entrada: EntradaEstadoBanca): PresentacionBanca {
  const enCurso = entrada.estadoRecepcion === 'EN_CURSO'

  // Gate de secreto: mientras la recepción está abierta el sentido se descarta
  // acá, antes de cualquier otra decisión. Ningún componente puede saltearlo.
  const valorFinal = enCurso ? null : entrada.valorVotoFinal
  const estadoResultado = valorFinal !== null ? ESTADO_POR_VALOR_FINAL[valorFinal] : undefined

  let estado: EstadoPrincipalBanca
  if (estadoResultado !== undefined) {
    estado = estadoResultado
  } else if (enCurso && entrada.votoEmitido) {
    estado = 'VOTO_EMITIDO'
  } else if (entrada.testActivo) {
    estado = 'TEST'
  } else if (entrada.esOrador) {
    estado = 'PALABRA'
  } else if (!entrada.presente) {
    estado = 'AUSENTE'
  } else {
    estado = 'NORMAL'
  }

  return {
    estado,
    etiqueta: ETIQUETA_VISIBLE[estado],
    etiquetaAccesible: ETIQUETA_ACCESIBLE[estado],
    familia: FAMILIA_POR_ESTADO[estado],
    haloTest: entrada.testActivo && estado !== 'TEST',
    haloPalabra: entrada.esOrador && estado !== 'PALABRA',
  }
}

/**
 * Traduce una presentación en las custom properties CSS que usan ambas apps.
 *
 * Devolver un objeto de estilos en lugar de clases evita duplicar la paleta en
 * dos hojas de estilo distintas, que es justamente la divergencia que WP-045
 * quiere impedir.
 *
 * @param presentacion Resultado de {@link calcularPresentacionBanca}.
 * @returns Diccionario apto para el binding `:style` de Vue.
 */
export function estilosBanca(presentacion: PresentacionBanca): Record<string, string> {
  const colores = PALETA_BANCAS[presentacion.familia]
  return {
    '--fondo-banca': colores.fondo,
    '--borde-banca': colores.borde,
    '--texto-etiqueta-banca': colores.textoEtiqueta,
    '--fondo-etiqueta-banca': colores.fondoEtiqueta,
    '--halo-banca': presentacion.haloTest
      ? PALETA_BANCAS.AZUL.fondo
      : presentacion.haloPalabra
        ? PALETA_BANCAS.NARANJA.fondo
        : 'transparent',
  }
}
