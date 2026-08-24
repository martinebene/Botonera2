/**
 * Motor de sincronización reactivo que implementa el ciclo canónico:
 * Snapshot REST -> Stream SSE -> Control de revisión -> Reconexión con recuperación.
 *
 * Principios fundamentales de diseño (DEC-013 / DEC-014):
 * 1. El snapshot REST siempre precede a la apertura del stream SSE.
 * 2. Cada snapshot obtenido establece una NUEVA baseline, permitiendo que tras un
 *    reinicio del backend una revisión menor (ej. 0 < 142) sea aceptada válidamente.
 * 3. Dentro de una misma baseline/conexión, se descartan revisiones duplicadas o menores,
 *    se toleran saltos (ej. 10 -> 15) y se actualiza ante revisiones mayores.
 * 4. Ante cualquier fallo del stream SSE, se cierra la instancia inmediatamente para
 *    evitar la reconexión nativa que omitiría el snapshot de recuperación.
 * 5. La reconexión aplica un backoff acotado y cancelable antes de pedir el snapshot.
 */

import { EstrategiaBackoff } from './backoff'
import { ErrorCancelacion, ErrorProtocolo, ErrorTransporte, normalizarError } from './errores'
import { crearFabricaEventSourcePredeterminada } from './event_source'
import type {
  ConfiguracionCliente,
  FabricaEventSource,
  InterfazEventSource,
  OpcionesSuscripcion,
  Suscripcion,
} from './tipos'

/**
 * Parámetros internos para instanciar el sincronizador de estado.
 */
export interface ParametrosSincronizador<T extends { revision: number }> {
  /** Función para obtener el snapshot REST completo */
  obtenerSnapshot: (signal?: AbortSignal) => Promise<T>
  /** URL completa para la conexión SSE */
  urlStream: string
  /** Opciones con los callbacks provistos por el consumidor */
  opciones: OpcionesSuscripcion<T>
  /** Configuración general del cliente (fábrica SSE, backoff, etc.) */
  configuracion?: ConfiguracionCliente
}

/**
 * Gestiona el ciclo de vida de la sincronización reactiva de estado.
 */
export class SincronizadorEstado<T extends { revision: number }> implements Suscripcion {
  private readonly obtenerSnapshot: (signal?: AbortSignal) => Promise<T>
  private readonly urlStream: string
  private readonly opciones: OpcionesSuscripcion<T>
  private readonly fabricaEventSource: FabricaEventSource
  private readonly backoff: EstrategiaBackoff

  private _activa = true
  private revisionActual = -1
  private estadoActual: T | null = null
  private eventSourceActivo: InterfazEventSource | null = null
  private abortControllerCiclo: AbortController | null = null
  private intentoReconexion = 0
  private sincronizacionEnCurso = false

  constructor(parametros: ParametrosSincronizador<T>) {
    this.obtenerSnapshot = parametros.obtenerSnapshot
    this.urlStream = parametros.urlStream
    this.opciones = parametros.opciones
    this.fabricaEventSource =
      parametros.configuracion?.fabricaEventSource ?? crearFabricaEventSourcePredeterminada()
    this.backoff = new EstrategiaBackoff(parametros.configuracion?.backoff)
  }

  /**
   * Indica si la suscripción continúa activa.
   */
  get activa(): boolean {
    return this._activa
  }

  /**
   * Obtiene el último estado completo adoptado, o null si aún no se recibió el primer snapshot.
   */
  get ultimoEstado(): T | null {
    return this.estadoActual
  }

  /**
   * Inicia el bucle asíncrono de sincronización y reconexión.
   */
  iniciar(): this {
    if (this.sincronizacionEnCurso) {
      return this
    }
    this.sincronizacionEnCurso = true
    void this.ejecutarBucleSincronizacion()
    return this
  }

  /**
   * Detiene de forma determinista e idempotente la sincronización.
   */
  cancelar(): void {
    if (!this._activa) {
      return
    }
    this._activa = false

    // Abortamos cualquier operación REST o espera de timer en curso
    if (this.abortControllerCiclo) {
      this.abortControllerCiclo.abort()
      this.abortControllerCiclo = null
    }

    // Cerramos el EventSource activo si existe
    if (this.eventSourceActivo) {
      this.eventSourceActivo.close()
      this.eventSourceActivo = null
      this.notificarCambioConexion(false)
    }
  }

  /**
   * Bucle principal de sincronización.
   *
   * Ejecuta indefinidamente mientras esté activa:
   * 1. Snapshot REST -> nueva baseline
   * 2. Apertura de EventSource nuevo
   * 3. Si ocurre un fallo -> cierre de EventSource -> espera backoff -> repetir
   */
  private async ejecutarBucleSincronizacion(): Promise<void> {
    while (this._activa) {
      this.abortControllerCiclo = new AbortController()
      const signal = this.abortControllerCiclo.signal

      try {
        // PASO 1: Obtener snapshot REST inicial o de recuperación
        const snapshot = await this.obtenerSnapshot(signal)

        if (!this._activa) {
          return
        }

        // Al recuperarse un snapshot, se reinicia el contador de reintentos
        this.intentoReconexion = 0

        // PASO 2: Establecer snapshot como NUEVA baseline (admite revisiones menores post-restart)
        this.adoptarNuevaBaseline(snapshot)

        // PASO 3: Abrir stream SSE y esperar hasta que se cierre o falle
        await this.conectarStream(signal)
      } catch (error) {
        if (!this._activa) {
          return
        }

        // Si fue una cancelación interna por dispose, terminamos
        if (error instanceof ErrorCancelacion || signal.aborted) {
          return
        }

        // Notificamos el error al consumidor sin romper el ciclo
        const errorNormalizado = normalizarError(error)
        this.notificarError(errorNormalizado)

        // PASO 4: Espera con retroceso acotado antes del próximo snapshot de recuperación
        try {
          const esperaMs = this.backoff.calcularEspera(this.intentoReconexion++)
          await this.backoff.esperar(esperaMs, signal)
        } catch {
          // Si se canceló durante el backoff, simplemente salimos
          if (!this._activa) {
            return
          }
        }
      } finally {
        if (this.abortControllerCiclo?.signal === signal) {
          this.abortControllerCiclo = null
        }
      }
    }
  }

  /**
   * Abre una conexión EventSource y maneja sus eventos.
   * La promesa se resuelve o rechaza cuando el stream se interrumpe o falla.
   */
  private conectarStream(signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this._activa || signal.aborted) {
        return resolve()
      }

      let eventSource: InterfazEventSource
      try {
        eventSource = this.fabricaEventSource(this.urlStream)
      } catch (error) {
        return reject(new ErrorTransporte('No se pudo instanciar EventSource', error))
      }

      this.eventSourceActivo = eventSource

      // Listener para abortar si se cancela la suscripción externamente
      const onAbort = () => {
        limpiarYTerminar()
        resolve()
      }
      signal.addEventListener('abort', onAbort, { once: true })

      const limpiarYTerminar = () => {
        signal.removeEventListener('abort', onAbort)
        if (this.eventSourceActivo === eventSource) {
          this.eventSourceActivo = null
        }
        eventSource.close()
        this.notificarCambioConexion(false)
      }

      // Handler para evento de apertura de conexión
      eventSource.onopen = () => {
        if (!this._activa || signal.aborted) {
          limpiarYTerminar()
          return resolve()
        }
        this.notificarCambioConexion(true)
      }

      // Handler para el evento funcional "estado"
      const listenerEstado = (evento: MessageEvent) => {
        if (!this._activa || signal.aborted) {
          limpiarYTerminar()
          return resolve()
        }

        try {
          if (typeof evento.data !== 'string') {
            throw new ErrorProtocolo('Payload SSE sin datos de texto')
          }

          const payload = JSON.parse(evento.data) as T

          if (!payload || typeof payload !== 'object' || typeof payload.revision !== 'number') {
            throw new ErrorProtocolo(
              "El payload SSE no contiene un objeto válido con campo 'revision'",
            )
          }

          // Control de revision dentro de la baseline vigente:
          // - revision < revisionActual: descartar (evento desordenado o antiguo)
          // - revision == revisionActual: tratar de forma idempotente
          // - revision > revisionActual: aceptar y avanzar (incluso con saltos numéricos)
          if (payload.revision >= this.revisionActual) {
            this.procesarEstadoSSE(payload)
          }
        } catch (error) {
          // Si el JSON o contrato es inválido, forzamos cierre y recuperación segura
          limpiarYTerminar()
          reject(
            error instanceof ErrorProtocolo
              ? error
              : new ErrorProtocolo('Error al procesar mensaje SSE', error),
          )
        }
      }

      eventSource.addEventListener('estado', listenerEstado)

      // Handler para error en el stream SSE
      eventSource.onerror = (evento: Event) => {
        // CRÍTICO: Cerramos inmediatamente el EventSource para impedir que
        // la reconexión automática nativa omita el snapshot de recuperación.
        limpiarYTerminar()
        eventSource.removeEventListener('estado', listenerEstado)
        reject(new ErrorTransporte('Interrupción o error en el stream SSE', evento))
      }
    })
  }

  /**
   * Adopta un nuevo snapshot REST como baseline nueva.
   *
   * IMPORTANTE PARA RESTART:
   * Al provenir de un snapshot explícito, reemplaza siempre el estado previo sin importar
   * si la revisión numérica es menor que la anterior (por ejemplo, tras un reinicio de FastAPI
   * donde el backend vuelve a revision 0 en SIN_PREPARAR).
   */
  private adoptarNuevaBaseline(snapshot: T): void {
    this.revisionActual = snapshot.revision
    this.estadoActual = snapshot
    this.notificarEstado(snapshot)
  }

  /**
   * Procesa un evento SSE recibido dentro de la baseline activa.
   */
  private procesarEstadoSSE(nuevoEstado: T): void {
    this.revisionActual = nuevoEstado.revision
    this.estadoActual = nuevoEstado
    this.notificarEstado(nuevoEstado)
  }

  /**
   * Envía el nuevo estado al callback del consumidor protegiéndolo de excepciones.
   */
  private notificarEstado(estado: T): void {
    if (!this._activa) {
      return
    }
    try {
      this.opciones.alEstado(estado)
    } catch (error) {
      // Un error accidental en el callback del consumidor no debe destruir el sincronizador
      this.notificarError(error)
    }
  }

  /**
   * Notifica un error al callback alError del consumidor si está definido.
   */
  private notificarError(error: unknown): void {
    if (!this._activa) {
      return
    }
    try {
      this.opciones.alError?.(error)
    } catch {
      // Ignoramos errores dentro del propio manejador de errores
    }
  }

  /**
   * Notifica cambios en el estado de conexión del stream.
   */
  private notificarCambioConexion(conectado: boolean): void {
    if (!this._activa) {
      return
    }
    try {
      this.opciones.alCambiarConexion?.(conectado)
    } catch {
      // Ignoramos errores dentro del manejador
    }
  }
}

/**
 * Inicia la sincronización de estado y devuelve la suscripción cancelable.
 */
export function iniciarSincronizacionEstado<T extends { revision: number }>(
  parametros: ParametrosSincronizador<T>,
): Suscripcion {
  const sincronizador = new SincronizadorEstado<T>(parametros)
  return sincronizador.iniciar()
}
