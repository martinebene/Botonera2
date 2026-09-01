/** Pruebas de la regla temporal que Moderación y Recinto consumen en común. */

import { describe, expect, it } from 'vitest'
import { calcularDuracionEnSnapshot, convertirMarcaBackend, formatearDuracion } from '../src/tiempo'

describe('ancla temporal compartida', () => {
  it('compara timestamps naive como lecturas del mismo reloj backend', () => {
    expect(calcularDuracionEnSnapshot('2026-08-30T10:00:00', '2026-08-30T09:30:00')).toBe(1_800_000)
  })

  it('conserva la semántica ISO cuando las marcas incluyen zona explícita', () => {
    expect(calcularDuracionEnSnapshot('2026-08-30T10:00:00Z', '2026-08-30T08:30:00-01:00')).toBe(
      1_800_000,
    )
  })

  it('rechaza fechas imposibles y marcas no interpretables', () => {
    expect(convertirMarcaBackend('2026-02-30T10:00:00')).toBeNull()
    expect(convertirMarcaBackend('marca inválida')).toBeNull()
    expect(calcularDuracionEnSnapshot('marca inválida', '2026-08-30T09:30:00')).toBeNull()
  })

  it('recorta diferencias negativas y permite duraciones mayores a 24 horas', () => {
    expect(calcularDuracionEnSnapshot('2026-08-30T09:00:00', '2026-08-30T10:00:00')).toBe(0)
    expect(
      formatearDuracion(calcularDuracionEnSnapshot('2026-08-31T11:00:00', '2026-08-30T10:00:00')!),
    ).toBe('25:00:00')
  })
})
