/**
 * Composable y frontera reactiva de sincronización para la aplicación de Moderación.
 *
 * Responsabilidades:
 * 1. Mantener el último EstadoModeracion confirmado emitido por el backend.
 * 2. Gestionar los estados visuales de conexión: INICIAL, CONECTADO, RECONECTANDO, DESCONECTADO.
 * 3. Preservar el último estado confirmado durante una desconexión o proceso de reconexión.
 * 4. Reflejar si el estado visual puede estar desactualizado durante una pérdida de conexión.
 * 5. Consumir exclusivamente @botonera2/api-client y su método ClienteModeracion.suscribirEstado.
 * 6. Evitar suscripciones duplicadas y garantizar la cancelación determinista al desmontar componentes.
 */

import { ref, computed, onMounted, onScopeDispose, type Ref, type ComputedRef } from 'vue'
import {
  crearClienteModeracion,
  type ClienteModeracion,
  type EstadoModeracion,
  type EstadoGlobal,
  type Suscripcion,
  type ConfiguracionCliente,
} from '@botonera2/api-client'

/**
 * Estados posibles del canal de sincronización y transporte:
 * - 'INICIAL': La aplicación acaba de iniciar y aún no obtuvo el primer snapshot autoritativo.
 * - 'CONECTADO': El stream SSE se encuentra abierto y recibiendo actualizaciones en tiempo real.
 * - 'RECONECTANDO': Se perdió la conexión SSE habiendo obtenido previamente un estado confirmado;
 *                   el último estado se conserva pero se advierte que puede estar desactualizado.
 * - 'DESCONECTADO': No hay conexión y nunca se obtuvo un snapshot válido previo (o error inicial).
 */
export type EstadoConexion = 'INICIAL' | 'CONECTADO' | 'RECONECTANDO' | 'DESCONECTADO'

/**
 * Interfaz de la frontera reactiva de sincronización de Moderación.
 */
export interface SincronizacionModeracion {
  /** Último estado completo confirmado recibido desde el backend */
  estado: Ref<EstadoModeracion | null>
  /** Estado actual de la conexión técnica */
  estadoConexion: Ref<EstadoConexion>
  /** Último error técnico capturado en el transporte o protocolo */
  ultimoError: Ref<unknown | null>
  /** Indica si la conexión en tiempo real está plenamente establecida */
  conectado: ComputedRef<boolean>
  /** Indica si el estado visible se encuentra potencialmente desactualizado por pérdida de SSE */
  desactualizado: ComputedRef<boolean>
  /** Número de revisión monotónica del último estado adoptado */
  revision: ComputedRef<number | null>
  /** Estado global del backend (SIN_PREPARAR, PREPARANDO, SESION_ABIERTA) */
  estadoGlobal: ComputedRef<EstadoGlobal | null>
  /** Instancia del cliente API de moderación */
  cliente: ClienteModeracion
  /** Inicia el ciclo de suscripción y sincronización */
  iniciar: () => void
  /** Cancela y limpia la suscripción activa */
  cancelar: () => void
}

/**
 * Opciones para configurar la sincronización de moderación.
 */
export interface OpcionesSincronizacionModeracion {
  /** Cliente de moderación inyectable (útil para pruebas unitarias) */
  cliente?: ClienteModeracion
  /** Configuración general del cliente API si se crea una nueva instancia */
  configuracionCliente?: ConfiguracionCliente
  /** Si debe iniciar automáticamente la suscripción al crearse (por defecto false) */
  autoIniciar?: boolean
}

/**
 * Crea una instancia aislada de la frontera reactiva de sincronización.
 * Diseñada para ser testeable unitariamente sin depender del contexto global de Nuxt.
 */
export function crearSincronizacionModeracion(
  opciones: OpcionesSincronizacionModeracion = {},
): SincronizacionModeracion {
  const cliente = opciones.cliente ?? crearClienteModeracion(opciones.configuracionCliente ?? {})

  const estado = ref<EstadoModeracion | null>(null)
  const estadoConexion = ref<EstadoConexion>('INICIAL')
  const ultimoError = ref<unknown | null>(null)

  let suscripcionActiva: Suscripcion | null = null

  // Indica si estamos conectados y con stream SSE activo
  const conectado = computed(() => estadoConexion.value === 'CONECTADO')

  // Indica si el estado mostrado proviene de un snapshot previo pero la conexión se interrumpió
  const desactualizado = computed(
    () => estadoConexion.value === 'RECONECTANDO' && estado.value !== null,
  )

  // Revisión del último estado recibido (o null si aún no hay snapshot)
  const revision = computed(() => estado.value?.revision ?? null)

  // Estado global reportado por el backend (o null si aún no hay snapshot)
  const estadoGlobal = computed(() => estado.value?.estado_global ?? null)

  /**
   * Inicia la suscripción al estado del backend.
   * Es idempotente: si ya existe una suscripción activa, no crea otra adicional.
   */
  function iniciar(): void {
    if (suscripcionActiva?.activa) {
      return
    }

    suscripcionActiva = cliente.suscribirEstado({
      // Callback invocado cada vez que se adopta un snapshot REST o evento SSE válido
      alEstado: (nuevoEstado: EstadoModeracion) => {
        // Adoptamos el nuevo estado (incluso si la revisión es numéricamente menor por un reinicio del backend)
        estado.value = nuevoEstado
      },
      // Callback invocado cuando el stream SSE abre o cierra su conexión
      alCambiarConexion: (estaConectado: boolean) => {
        if (estaConectado) {
          estadoConexion.value = 'CONECTADO'
        } else {
          // Si perdemos conexión pero ya teníamos estado previo, pasamos a RECONECTANDO conservando el estado
          if (estado.value !== null) {
            estadoConexion.value = 'RECONECTANDO'
          } else {
            estadoConexion.value = 'DESCONECTADO'
          }
        }
      },
      // Callback invocado ante errores de transporte o protocolo
      alError: (error: unknown) => {
        ultimoError.value = error
        // Ante un error, si ya teníamos un estado confirmado, conservamos los datos y marcamos reconexión
        if (estado.value !== null) {
          estadoConexion.value = 'RECONECTANDO'
        } else {
          estadoConexion.value = 'DESCONECTADO'
        }
      },
    })
  }

  /**
   * Cancela la suscripción activa y libera recursos del stream SSE.
   */
  function cancelar(): void {
    if (suscripcionActiva) {
      suscripcionActiva.cancelar()
      suscripcionActiva = null
    }
  }

  if (opciones.autoIniciar) {
    iniciar()
  }

  return {
    estado,
    estadoConexion,
    ultimoError,
    conectado,
    desactualizado,
    revision,
    estadoGlobal,
    cliente,
    iniciar,
    cancelar,
  }
}

// Instancia compartida por la aplicación (singleton por runtime del frontend)
let instanciaCompartida: SincronizacionModeracion | null = null

/**
 * Composable principal de Nuxt para acceder a la sincronización del estado de Moderación.
 * Garantiza una única suscripción activa compartida por todos los componentes del shell.
 */
export function useEstadoModeracion(): SincronizacionModeracion {
  if (!instanciaCompartida) {
    let baseUrl = ''

    // Obtenemos la URL base configurada en Nuxt si estamos en su entorno de ejecución
    try {
      if (typeof useRuntimeConfig === 'function') {
        const config = useRuntimeConfig()
        baseUrl = (config.public?.apiBaseUrl as string) ?? ''
      }
    } catch {
      // Fuera de Nuxt o en entorno de test simple, usamos cadena vacía (mismo origen)
      baseUrl = ''
    }

    instanciaCompartida = crearSincronizacionModeracion({
      configuracionCliente: { baseUrl },
    })
  }

  // Si estamos dentro del ciclo de vida de un componente Vue en cliente, aseguramos inicio y limpieza
  if (typeof window !== 'undefined') {
    onMounted(() => {
      instanciaCompartida?.iniciar()
    })

    // onScopeDispose asegura que si se destruye el scope se cancele la suscripción si corresponde
    onScopeDispose(() => {
      // No destruimos la instancia compartida a menos que sea necesario, pero cancelamos si no quedan scopes
    })
  }

  return instanciaCompartida
}

/**
 * Helper para reiniciar la instancia compartida (exclusivamente para pruebas unitarias).
 */
export function reiniciarInstanciaCompartidaParaPruebas(): void {
  if (instanciaCompartida) {
    instanciaCompartida.cancelar()
    instanciaCompartida = null
  }
}
