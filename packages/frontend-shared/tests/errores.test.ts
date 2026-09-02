/**
 * Lectura del rechazo devuelto por el api-client (WP-056).
 *
 * La regla es no ocultar nunca el motivo institucional detrás de un texto genérico: si el
 * backend explicó por qué rechazó un comando, eso es lo que debe leer el operador.
 */

import { describe, expect, it } from 'vitest'
import { extraerMensajeError } from '../src/errores'

describe('extraerMensajeError', () => {
  it('prefiere el mensaje institucional del backend', () => {
    const error = {
      mensajeBackend: 'Ya existe un remapeo en curso',
      mensaje: 'Error HTTP 409',
      message: 'Request failed',
    }

    expect(extraerMensajeError(error, 'Falló.')).toBe('Ya existe un remapeo en curso')
  })

  it('cae al mensaje del transporte cuando el backend no explicó nada', () => {
    expect(extraerMensajeError({ mensaje: 'Sin conexión' }, 'Falló.')).toBe('Sin conexión')
    expect(extraerMensajeError(new Error('Network error'), 'Falló.')).toBe('Network error')
  })

  it('usa el texto predeterminado ante un rechazo sin información utilizable', () => {
    expect(extraerMensajeError(null, 'Falló.')).toBe('Falló.')
    expect(extraerMensajeError('texto suelto', 'Falló.')).toBe('Falló.')
    expect(extraerMensajeError({ mensaje: '' }, 'Falló.')).toBe('Falló.')
    expect(extraerMensajeError({ codigo: 500 }, 'Falló.')).toBe('Falló.')
  })
})
