import { describe, expect, it } from 'vitest'
import {
  centsToNumber,
  digitsToCents,
  formatMoneyFromCents,
  numberToCents,
  onlyDigits,
  parseMoney,
} from '@/lib/money'

describe('onlyDigits', () => {
  it('remove letras e símbolos', () => {
    expect(onlyDigits('R$ 1.234,56 abc')).toBe('123456')
  })

  it('string vazia permanece vazia', () => {
    expect(onlyDigits('')).toBe('')
  })
})

describe('digitsToCents', () => {
  it('interpreta dígitos como centavos', () => {
    expect(digitsToCents('454000')).toBe(454000)
    expect(digitsToCents('1')).toBe(1)
    expect(digitsToCents('')).toBe(0)
  })

  it('ignora não-dígitos (paste)', () => {
    expect(digitsToCents('4.540,00')).toBe(454000)
    expect(digitsToCents('abc')).toBe(0)
  })
})

describe('formatMoneyFromCents', () => {
  it('formata pt-BR', () => {
    expect(formatMoneyFromCents(454000)).toBe('4.540,00')
    expect(formatMoneyFromCents(0)).toBe('0,00')
    expect(formatMoneyFromCents(5)).toBe('0,05')
  })
})

describe('centsToNumber / numberToCents', () => {
  it('converte ida e volta', () => {
    expect(centsToNumber(454000)).toBe(4540)
    expect(numberToCents(4540)).toBe(454000)
    expect(numberToCents(4540.5)).toBe(454050)
    expect(centsToNumber(0)).toBe(0)
  })
})

describe('parseMoney (compat)', () => {
  it('parseia formatos BR e US', () => {
    expect(parseMoney('1.500,50')).toBe(1500.5)
    expect(parseMoney('1500,50')).toBe(1500.5)
    expect(parseMoney('1500.50')).toBe(1500.5)
  })
})
