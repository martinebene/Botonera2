/**
 * Estrategia de espera con retroceso acotado y cancelable (Backoff) para reconexión SSE.
 *
 * Evita ciclos de reconexión agresivos y previene sobrecargar el backend cuando
 * este se reinicia o sufre problemas de conectividad temporal.
 */

import { ErrorCancelacion } from './errores'
import type { ConfiguracionBackoff, Temporizador } from './tipos'

/**
 * Temporizador por defecto basado en setTimeout y cancelable mediante AbortSignal.
 */
export const temporizadorPredeterminado: Temporizador = (
  milisegundos: number,
  signal?: AbortSignal,
): Promise<void> => {
  if (signal?.aborted) {
    return Promise.reject(new ErrorCancelacion('Espera cancelada'))
  }

  return new Promise((resolve, reject) => {
    const handleTimer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, milisegundos)

    const handleAbort = () => {
      clearTimeout(handleTimer)
      signal?.removeEventListener('abort', handleAbort)
      reject(new ErrorCancelacion('Espera cancelada'))
    }

    signal?.addEventListener('abort', handleAbort)
  })
}

/**
 * Administra el cálculo del tiempo de espera y la ejecución de la pausa cancelable.
 */
export class EstrategiaBackoff {
  readonly esperaInicialMs: number
  readonly esperaMaximaMs: number
  readonly factorMultiplicador: number
  private readonly temporizador: Temporizador

  constructor(configuracion: ConfiguracionBackoff = {}) {
    this.esperaInicialMs = configuracion.esperaInicialMs ?? 500
    this.esperaMaximaMs = configuracion.esperaMaximaMs ?? 5000
    this.factorMultiplicador = configuracion.factorMultiplicador ?? 1.5
    this.temporizador = configuracion.temporizador ?? temporizadorPredeterminado
  }

  /**
   * Calcula el tiempo de espera en milisegundos para un intento dado (0-indexado).
   *
   * @param intento Número de reintento consecutivo (0, 1, 2...).
   * @returns Milisegundos a esperar, acotados por esperaMaximaMs.
   */
  calcularEspera(intento: number): number {
    if (intento <= 0) {
      return this.esperaInicialMs
    }
    const exponencial = this.esperaInicialMs * Math.pow(this.factorMultiplicador, intento)
    return Math.min(this.esperaMaximaMs, Math.round(exponencial))
  }

  /**
   * Ejecuta la espera calculada para el intento actual, respetando el AbortSignal.
   *
   * @param intento Número de reintento consecutivo.
   * @param signal Señal de aborto opcional para cancelar la espera inmediatamente.
   */
  async esperarIntento(intento: number, signal?: AbortSignal): Promise<void> {
    const ms = this.calcularEspera(intento)
    await this.temporizador(ms, signal)
  }

  /**
   * Ejecuta una espera de una cantidad fija de milisegundos.
   *
   * @param milisegundos Tiempo a esperar.
   * @param signal Señal de aborto opcional.
   */
  async esperar(milisegundos: number, signal?: AbortSignal): Promise<void> {
    await this.temporizador(milisegundos, signal)
  }
}
