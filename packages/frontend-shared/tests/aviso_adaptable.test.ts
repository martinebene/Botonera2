/**
 * Ajuste tipográfico de los avisos técnicos (WP-056).
 *
 * El algoritmo se prueba con una función de medición sintética: se declara cuántos
 * píxeles "ocupa" el texto por cada punto de cuerpo y se comprueba qué decide. Así las
 * reglas humanas —mayor tamaño viable, elipsis sólo cuando nada entra— quedan verificadas
 * sin depender de la fuente ni del motor de layout del navegador.
 */

import { describe, expect, it } from 'vitest'
import { ajustarTamanoAviso, lineasVisiblesAviso } from '../src/aviso_adaptable'

/**
 * Construye una medición monótona: el texto entra mientras el cuerpo no supere `umbral`.
 *
 * Cuenta además cuántas mediciones pidió el algoritmo, que es lo que permite afirmar que
 * la búsqueda es acotada y no un barrido de píxel en píxel.
 */
function medidorHasta(umbral: number): { entra: (tamano: number) => boolean; llamadas: number[] } {
  const llamadas: number[] = []
  return {
    llamadas,
    entra: (tamano: number) => {
      llamadas.push(tamano)
      return tamano <= umbral
    },
  }
}

describe('ajustarTamanoAviso', () => {
  it('usa el cuerpo máximo cuando el texto entra holgadamente', () => {
    const medidor = medidorHasta(500)

    const resultado = ajustarTamanoAviso({
      tamanoMinimo: 14,
      tamanoMaximo: 128,
      entra: medidor.entra,
    })

    expect(resultado).toEqual({ tamano: 128, truncado: false })
    // Una sola medición: si el máximo entra, no hay nada que buscar.
    expect(medidor.llamadas).toEqual([128])
  })

  it('elige el mayor cuerpo entero que todavía entra', () => {
    const medidor = medidorHasta(37)

    const resultado = ajustarTamanoAviso({
      tamanoMinimo: 14,
      tamanoMaximo: 128,
      entra: medidor.entra,
    })

    expect(resultado).toEqual({ tamano: 37, truncado: false })
    // 38 no debe considerarse aceptable: es el primer cuerpo que ya no entra.
    expect(medidor.llamadas).toContain(37)
  })

  it('acota la cantidad de mediciones con una búsqueda binaria', () => {
    const medidor = medidorHasta(37)

    ajustarTamanoAviso({ tamanoMinimo: 14, tamanoMaximo: 128, entra: medidor.entra })

    // log2(128 - 14) ≈ 6.8, más las dos comprobaciones de los extremos.
    expect(medidor.llamadas.length).toBeLessThanOrEqual(9)
  })

  it('conserva el cuerpo mínimo y pide elipsis cuando nada entra', () => {
    const medidor = medidorHasta(5)

    const resultado = ajustarTamanoAviso({
      tamanoMinimo: 14,
      tamanoMaximo: 128,
      entra: medidor.entra,
    })

    // El texto se recorta con `…`, pero nunca se vuelve ilegible por debajo del mínimo.
    expect(resultado).toEqual({ tamano: 14, truncado: true })
  })

  it('acepta un rango de un único tamaño', () => {
    const resultado = ajustarTamanoAviso({
      tamanoMinimo: 20,
      tamanoMaximo: 20,
      entra: (tamano) => tamano <= 20,
    })

    expect(resultado).toEqual({ tamano: 20, truncado: false })
  })

  it('trunca los tamaños fraccionarios en lugar de proponer cuerpos no enteros', () => {
    const resultado = ajustarTamanoAviso({
      tamanoMinimo: 14.9,
      tamanoMaximo: 40.7,
      entra: (tamano) => tamano <= 25.5,
    })

    expect(Number.isInteger(resultado.tamano)).toBe(true)
    expect(resultado.tamano).toBe(25)
  })

  it('rechaza rangos inutilizables en lugar de devolver un cuerpo arbitrario', () => {
    const entra = () => true
    expect(() => ajustarTamanoAviso({ tamanoMinimo: 0, tamanoMaximo: 30, entra })).toThrow(
      RangeError,
    )
    expect(() => ajustarTamanoAviso({ tamanoMinimo: 30, tamanoMaximo: 10, entra })).toThrow(
      RangeError,
    )
    expect(() => ajustarTamanoAviso({ tamanoMinimo: Number.NaN, tamanoMaximo: 30, entra })).toThrow(
      RangeError,
    )
  })
})

describe('lineasVisiblesAviso', () => {
  it('cuenta las líneas completas que entran en la superficie', () => {
    // 100 px de alto con líneas de 16 × 1,25 = 20 px permiten cinco líneas exactas.
    expect(lineasVisiblesAviso(100, 16, 1.25)).toBe(5)
  })

  it('nunca deja el aviso sin una línea visible', () => {
    expect(lineasVisiblesAviso(10, 40, 1.15)).toBe(1)
    expect(lineasVisiblesAviso(0, 16, 1.15)).toBe(1)
    expect(lineasVisiblesAviso(Number.NaN, 16, 1.15)).toBe(1)
  })
})
