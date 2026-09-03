/**
 * Pruebas del formato visual del factor de mayoría especial (WP-063).
 *
 * Cada caso fija una de las decisiones humanas cerradas del WP: dos decimales exactos,
 * truncamiento en lugar de redondeo y ninguna degradación por artefactos de punto flotante.
 */

import { describe, expect, it } from 'vitest'
import { formatearFactorMayoria } from '../src/factor_mayoria'

describe('formato visual del factor de mayoría', () => {
  it('trunca los decimales sobrantes en lugar de redondearlos', () => {
    // Los cinco casos obligatorios del WP-063. `0.6799` es el que distingue truncar de
    // redondear: un redondeo mostraría `0.68` y contradiría la decisión humana.
    expect(formatearFactorMayoria(0.6789)).toBe('0.67')
    expect(formatearFactorMayoria(0.6799)).toBe('0.67')
    expect(formatearFactorMayoria(0.6)).toBe('0.60')
    expect(formatearFactorMayoria(1)).toBe('1.00')
    expect(formatearFactorMayoria(0.999)).toBe('0.99')
  })

  it('completa siempre dos decimales aunque el valor tenga menos o ninguno', () => {
    expect(formatearFactorMayoria(0.5)).toBe('0.50')
    expect(formatearFactorMayoria(0.07)).toBe('0.07')
    expect(formatearFactorMayoria(0)).toBe('0.00')
  })

  it('no degrada un valor válido al centésimo inferior por punto flotante', () => {
    // `0.29 * 100` vale 28.999999999999996 en binario: un truncamiento aritmético ingenuo
    // mostraría `0.28`. Lo mismo ocurre con 0.57, 0.58 y 0.29 en distintas plataformas.
    expect(formatearFactorMayoria(0.29)).toBe('0.29')
    expect(formatearFactorMayoria(0.57)).toBe('0.57')
    expect(formatearFactorMayoria(0.58)).toBe('0.58')
    expect(formatearFactorMayoria(1.005)).toBe('1.00')
  })

  it('trunca correctamente valores con cola binaria larga', () => {
    // Resultados aritméticos reales que llegan con muchos decimales espurios.
    expect(formatearFactorMayoria(0.1 + 0.2)).toBe('0.30')
    expect(formatearFactorMayoria(2 / 3)).toBe('0.66')
    expect(formatearFactorMayoria(0.6666666666666666)).toBe('0.66')
  })

  it('resuelve la notación científica sin dejar el exponente a la vista', () => {
    // `String(1e-7)` devuelve '1e-7'. Un corte por posición de coma sobre ese texto
    // produciría basura; la utilidad expande primero la notación decimal plana.
    expect(formatearFactorMayoria(1e-7)).toBe('0.00')
    expect(formatearFactorMayoria(1.5e-3)).toBe('0.00')
    expect(formatearFactorMayoria(1.23e2)).toBe('123.00')
  })

  it('conserva el signo y deja visible un valor no finito en lugar de disfrazarlo', () => {
    // El factor institucional nunca es negativo ni infinito, pero una utilidad de
    // presentación no debe inventar un número válido a partir de una anomalía.
    expect(formatearFactorMayoria(-0.755)).toBe('-0.75')
    expect(formatearFactorMayoria(Number.NaN)).toBe('NaN')
    expect(formatearFactorMayoria(Number.POSITIVE_INFINITY)).toBe('Infinity')
  })

  it('es una función pura que no altera el valor recibido', () => {
    // Criterio de aceptación 5: el dato real conserva su precisión completa. La utilidad
    // devuelve texto y no puede usarse para reemplazar el número que viaja al backend.
    const factorReal = 0.6789
    expect(formatearFactorMayoria(factorReal)).toBe('0.67')
    expect(factorReal).toBe(0.6789)
  })
})
