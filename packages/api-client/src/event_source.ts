/**
 * Fábrica y utilidades para EventSource nativo o inyectado.
 */

import { ErrorTransporte } from './errores'
import type { FabricaEventSource, InterfazEventSource } from './tipos'

/**
 * Crea una fábrica de EventSource predeterminada basada en globalThis.EventSource.
 */
export function crearFabricaEventSourcePredeterminada(): FabricaEventSource {
  return (url: string): InterfazEventSource => {
    if (typeof EventSource === 'undefined') {
      throw new ErrorTransporte(
        'EventSource no está disponible en este entorno de ejecución (se requiere navegador o polyfill).',
      )
    }
    return new EventSource(url) as unknown as InterfazEventSource
  }
}
