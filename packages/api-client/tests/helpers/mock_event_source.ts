/**
 * Simulación de EventSource para pruebas deterministas sin dependencias de red ni navegadores.
 */

import type { InterfazEventSource } from '../../src/tipos'

export class MockEventSource implements InterfazEventSource {
  readonly url: string
  onopen: ((evento: Event) => void) | null = null
  onerror: ((evento: Event) => void) | null = null
  onmessage: ((evento: MessageEvent) => void) | null = null

  cerrado = false
  listeners: Map<string, Set<(evento: MessageEvent) => void>> = new Map()

  constructor(url: string) {
    this.url = url
  }

  addEventListener(tipo: string, listener: (evento: MessageEvent) => void): void {
    if (!this.listeners.has(tipo)) {
      this.listeners.set(tipo, new Set())
    }
    this.listeners.get(tipo)!.add(listener)
  }

  removeEventListener(tipo: string, listener: (evento: MessageEvent) => void): void {
    this.listeners.get(tipo)?.delete(listener)
  }

  close(): void {
    this.cerrado = true
  }

  // Métodos de control para pruebas

  simularApertura(): void {
    if (this.cerrado) return
    this.onopen?.(new Event('open'))
  }

  simularEvento(tipo: string, data: unknown): void {
    if (this.cerrado) return
    const stringData = typeof data === 'string' ? data : JSON.stringify(data)
    const mensaje = new MessageEvent(tipo, { data: stringData })
    const handlers = this.listeners.get(tipo)
    if (handlers) {
      for (const h of handlers) {
        h(mensaje)
      }
    }
  }

  simularError(): void {
    if (this.cerrado) return
    this.onerror?.(new Event('error'))
  }
}
