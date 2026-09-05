/**
 * Frontera reactiva de sincronización del puesto de Apoyo Técnico (WP-056, ampliada por
 * WP-071).
 *
 * El puesto técnico observa **tres** proyecciones autoritativas ya existentes y no inventa
 * ninguna cuarta:
 *
 * 1. `EstadoTecnico` (`/api/v1/estado/tecnico` + su stream SSE) trae transmisión, los
 *    avisos vigentes de ambos destinos, la biblioteca de mensajes precargados y la misma
 *    franja segura de eventos L1/L2/L3 que ve Moderación.
 * 2. `EstadoModeracion` (`/api/v1/estado/moderacion` + su stream SSE) trae el padrón, las
 *    capacidades y la operación de remapeo en curso.
 * 3. `EstadoRecinto` (`/api/v1/estado/recinto` + su stream SSE) trae, desde WP-071, lo
 *    único que faltaba para sonorizar: la proyección **pública** completa del recinto y su
 *    configuración de sonidos.
 *
 * ¿Por qué tres y no una sola ampliada?
 *
 * El remapeo ya existe como contrato completo en la superficie de Moderación y WP-056
 * exige reutilizar "la semántica y API vigentes". La sonorización, por su parte, se deduce
 * comparando dos `EstadoRecinto` consecutivos: los quince eventos de WP-065 están
 * definidos sobre esa proyección y sobre ninguna otra. Agregar esos campos a
 * `EstadoTecnico` habría significado tocar el backend y crear una segunda proyección de la
 * misma verdad, que es exactamente lo que los WP prohíben. Con tres suscripciones el
 * backend sigue siendo la única autoridad y el sonido del puesto técnico es, por
 * construcción, el mismo que el del recinto.
 *
 * Ninguna de las tres suscripciones agrega polling: las tres son snapshot REST inicial +
 * SSE + reconexión con retroceso, resueltas dentro de `@botonera2/api-client`. La cuenta
 * regresiva tampoco lo agrega: su número lo deriva localmente `usePresentacionTecnica`.
 *
 * Sobre el secreto de voto: esta pantalla nunca representa votos ni resultados. Del
 * snapshot de Moderación consume exclusivamente `remapeo`, `concejales` y `capacidades`;
 * los eventos los toma de la proyección técnica, que aplica la misma frontera de WP-052
 * resuelta en el servidor; y de `EstadoRecinto` consume la misma proyección pública que ya
 * ve cualquiera que mire la pantalla del salón, donde el secreto temporal del voto lo
 * garantiza el backend. Ninguna de las tres le da acceso a información que no fuera ya
 * legítimamente suya.
 */

import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  type ComputedRef,
  type Ref,
  shallowRef,
} from 'vue'
import {
  crearClienteApoyoTecnico,
  crearClienteModeracion,
  crearClienteRecinto,
  type ClienteApoyoTecnico,
  type ClienteModeracion,
  type ClienteRecinto,
  type ConfiguracionCliente,
  type EstadoModeracion,
  type EstadoRecinto,
  type EstadoTecnico,
  type Suscripcion,
} from '@botonera2/api-client'

/**
 * Estados visibles del canal de sincronización, con el mismo vocabulario que usan
 * Moderación y Recinto para que el operador lea siempre lo mismo.
 */
export type EstadoConexionTecnico = 'INICIAL' | 'CONECTADO' | 'RECONECTANDO' | 'DESCONECTADO'

/** Superficie reactiva que consume la SPA técnica. */
export interface SincronizacionTecnica {
  /** Último `EstadoTecnico` confirmado, o `null` antes del primer snapshot. */
  estado: Ref<EstadoTecnico | null>
  /** Último `EstadoModeracion` confirmado; sólo alimenta el remapeo. */
  estadoModeracion: Ref<EstadoModeracion | null>
  /** Último `EstadoRecinto` confirmado; sólo alimenta la sonorización (WP-071). */
  estadoRecinto: Ref<EstadoRecinto | null>
  /** Estado técnico del stream principal (el del plano técnico). */
  estadoConexion: Ref<EstadoConexionTecnico>
  /**
   * Estado del stream público, que la sonorización necesita por separado (WP-071).
   *
   * No gobierna ningún indicador visible. Su único uso es distinguir un hecho nuevo de una
   * baseline: un `EstadoRecinto` adoptado sin el stream abierto describe historia y no debe
   * reproducirse. Por eso importa el estado de **ese** canal y no el del canal técnico.
   */
  estadoConexionRecinto: Ref<EstadoConexionTecnico>
  /** Último error de transporte observado en cualquiera de los tres canales. */
  ultimoError: Ref<unknown | null>
  /** `true` sólo con el stream técnico plenamente abierto. */
  conectado: ComputedRef<boolean>
  /** `true` cuando se conserva un estado previo pero la conexión se interrumpió. */
  desactualizado: ComputedRef<boolean>
  /** Revisión monotónica del último `EstadoTecnico` adoptado. */
  revision: ComputedRef<number | null>
  /** Cliente de comandos del plano técnico. */
  cliente: ClienteApoyoTecnico
  /** Cliente de Moderación, usado exclusivamente por el remapeo compartido. */
  clienteModeracion: ClienteModeracion
  /** Cliente público del Recinto, de solo lectura, usado exclusivamente por el sonido. */
  clienteRecinto: ClienteRecinto
  /** Abre las tres suscripciones. Es idempotente. */
  iniciar: () => void
  /** Cierra las tres suscripciones sin borrar el último estado confirmado. */
  cancelar: () => void
}

/** Opciones de construcción; los clientes inyectables mantienen las pruebas deterministas. */
export interface OpcionesSincronizacionTecnica {
  cliente?: ClienteApoyoTecnico
  clienteModeracion?: ClienteModeracion
  clienteRecinto?: ClienteRecinto
  configuracionCliente?: ConfiguracionCliente
  autoIniciar?: boolean
}

/**
 * Crea una sincronización técnica aislada, testeable fuera del runtime de Nuxt.
 *
 * El último snapshot nunca se borra por un error de red: se conserva y se marca como
 * potencialmente desactualizado, igual que en las otras dos pantallas. Cuando llega otra
 * baseline —incluso con revisión menor tras reiniciar FastAPI— se reemplaza por completo.
 */
export function crearSincronizacionTecnica(
  opciones: OpcionesSincronizacionTecnica = {},
): SincronizacionTecnica {
  const configuracion = opciones.configuracionCliente ?? {}
  const cliente = opciones.cliente ?? crearClienteApoyoTecnico(configuracion)
  const clienteModeracion = opciones.clienteModeracion ?? crearClienteModeracion(configuracion)
  const clienteRecinto = opciones.clienteRecinto ?? crearClienteRecinto(configuracion)

  // `shallowRef` alcanza porque cada snapshot se reemplaza entero y nunca se muta por
  // dentro: evita que Vue recorra en profundidad un objeto grande en cada revisión.
  const estado = shallowRef<EstadoTecnico | null>(null)
  const estadoModeracion = shallowRef<EstadoModeracion | null>(null)
  const estadoRecinto = shallowRef<EstadoRecinto | null>(null)
  const estadoConexion = ref<EstadoConexionTecnico>('INICIAL')
  const estadoConexionRecinto = ref<EstadoConexionTecnico>('INICIAL')
  const ultimoError = ref<unknown | null>(null)

  let suscripcionTecnica: Suscripcion | null = null
  let suscripcionModeracion: Suscripcion | null = null
  let suscripcionRecinto: Suscripcion | null = null

  const conectado = computed(() => estadoConexion.value === 'CONECTADO')
  const desactualizado = computed(
    () => estadoConexion.value === 'RECONECTANDO' && estado.value !== null,
  )
  const revision = computed(() => estado.value?.revision ?? null)

  /**
   * El indicador de conexión refleja el canal técnico, que es el que habilita los
   * comandos de esta pantalla. Se distingue "sin conexión" de "reconectando" según haya
   * o no un estado previo que el operador siga viendo.
   */
  function marcarDesconexion(): void {
    estadoConexion.value = estado.value === null ? 'DESCONECTADO' : 'RECONECTANDO'
  }

  /**
   * Mismo criterio para el canal público, con su propio estado previo.
   *
   * Se mantiene separado a propósito: la sonorización necesita saber si **ese** stream
   * estaba abierto cuando llegó el estado, y mezclarlo con el canal técnico haría sonar
   * historia después de una reconexión pública que el canal técnico nunca vio.
   */
  function marcarDesconexionRecinto(): void {
    estadoConexionRecinto.value = estadoRecinto.value === null ? 'DESCONECTADO' : 'RECONECTANDO'
  }

  function iniciar(): void {
    if (suscripcionTecnica?.activa !== true) {
      suscripcionTecnica = cliente.suscribirEstado({
        alEstado: (nuevoEstado) => {
          estado.value = nuevoEstado
        },
        alCambiarConexion: (estaConectado) => {
          if (estaConectado) {
            estadoConexion.value = 'CONECTADO'
            ultimoError.value = null
          } else {
            marcarDesconexion()
          }
        },
        alError: (error) => {
          ultimoError.value = error
          marcarDesconexion()
        },
      })
    }

    if (suscripcionModeracion?.activa !== true) {
      suscripcionModeracion = clienteModeracion.suscribirEstado({
        alEstado: (nuevoEstado) => {
          estadoModeracion.value = nuevoEstado
        },
        // El canal de Moderación no gobierna el indicador de conexión de esta pantalla:
        // si lo hiciera, un corte de ese único stream apagaría también los controles de
        // transmisión y avisos, que dependen del canal técnico y podrían seguir vivos.
        alError: (error) => {
          ultimoError.value = error
        },
      })
    }

    if (suscripcionRecinto?.activa !== true) {
      suscripcionRecinto = clienteRecinto.suscribirEstado({
        alEstado: (nuevoEstado) => {
          estadoRecinto.value = nuevoEstado
        },
        // El canal público tampoco gobierna el indicador visible de esta pantalla: si la
        // proyección del recinto se cortara, el puesto técnico seguiría operando avisos y
        // transmisión con normalidad; sólo se quedaría sin sonido hasta reconectar.
        alCambiarConexion: (estaConectado) => {
          if (estaConectado) {
            estadoConexionRecinto.value = 'CONECTADO'
          } else {
            marcarDesconexionRecinto()
          }
        },
        alError: (error) => {
          ultimoError.value = error
          marcarDesconexionRecinto()
        },
      })
    }
  }

  function cancelar(): void {
    suscripcionTecnica?.cancelar()
    suscripcionTecnica = null
    suscripcionModeracion?.cancelar()
    suscripcionModeracion = null
    suscripcionRecinto?.cancelar()
    suscripcionRecinto = null
    estadoConexion.value = 'DESCONECTADO'
    estadoConexionRecinto.value = 'DESCONECTADO'
  }

  if (opciones.autoIniciar) iniciar()

  return {
    estado,
    estadoModeracion,
    estadoRecinto,
    estadoConexion,
    estadoConexionRecinto,
    ultimoError,
    conectado,
    desactualizado,
    revision,
    cliente,
    clienteModeracion,
    clienteRecinto,
    iniciar,
    cancelar,
  }
}

/**
 * Integra la sincronización con el ciclo de vida del shell técnico.
 *
 * `onScopeDispose` también cubre un desmontaje de prueba, de modo que ninguna suite deje
 * conexiones SSE abiertas contra el backend.
 */
export function useEstadoTecnico(
  clientes: Pick<
    OpcionesSincronizacionTecnica,
    'cliente' | 'clienteModeracion' | 'clienteRecinto'
  > = {},
): SincronizacionTecnica {
  let baseUrl = ''
  if (!clientes.cliente || !clientes.clienteModeracion || !clientes.clienteRecinto) {
    baseUrl = useRuntimeConfig().public.apiBaseUrl
  }

  const sincronizacion = crearSincronizacionTecnica({
    ...clientes,
    configuracionCliente: { baseUrl },
  })

  onMounted(sincronizacion.iniciar)
  onScopeDispose(sincronizacion.cancelar)
  return sincronizacion
}
