import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/cdi-sample.json'
import {
  accruePrincipal,
  annualToPercentPerDay,
  balanceFromLots,
  buildOpenLots,
  cashImpactFromLedger,
  dailyFactor,
  daysBetween,
  estimateIR,
  irRateForDays,
  parseBcbSeries,
  splitRedeem,
} from './cdi'

const series = parseBcbSeries(fixture)

describe('parseBcbSeries', () => {
  it('converte datas BCB e ordena', () => {
    expect(series[0].date).toBe('2026-08-03')
    expect(series.at(-1)?.date).toBe('2026-08-10')
    expect(series[0].percentPerDay).toBeCloseTo(0.052531)
  })
})

describe('dailyFactor', () => {
  it('aplica 100% e 102% do CDI', () => {
    const f100 = dailyFactor(0.052531, 100)
    const f102 = dailyFactor(0.052531, 102)
    expect(f100).toBeCloseTo(1 + 0.00052531, 8)
    expect(f102).toBeCloseTo(1 + 0.00052531 * 1.02, 8)
    expect(f102).toBeGreaterThan(f100)
  })
})

describe('accruePrincipal', () => {
  it('capitaliza 1000 a 102% do CDI na fixture', () => {
    const result = accruePrincipal(1000, series, 102)
    expect(result.principal).toBe(1000)
    expect(result.businessDays).toBe(6)
    expect(result.amount).toBeGreaterThan(1000)
    expect(result.yield).toBeCloseTo(result.amount - 1000, 2)
  })
})

describe('lots + balance', () => {
  it('FIFO de resgate e saldo composto', () => {
    const lots = buildOpenLots([
      { type: 'apply', amount: 1000, occurred_on: '2026-08-03' },
      {
        type: 'redeem',
        amount: 200,
        principal_amount: 200,
        yield_amount: 0,
        occurred_on: '2026-08-05',
      },
    ])
    expect(lots).toHaveLength(1)
    expect(lots[0].principal).toBe(800)

    const bal = balanceFromLots(lots, series, 100)
    expect(bal.principal).toBe(800)
    expect(bal.amount).toBeGreaterThan(800)
  })
})

describe('estimateIR', () => {
  it('usa tabela regressiva', () => {
    expect(irRateForDays(30)).toBe(0.225)
    expect(irRateForDays(200)).toBe(0.2)
    expect(irRateForDays(400)).toBe(0.175)
    expect(irRateForDays(800)).toBe(0.15)
    expect(estimateIR(100, 30)).toBe(22.5)
    expect(estimateIR(100, 400)).toBe(17.5)
  })
})

describe('cashImpactFromLedger', () => {
  it('reduz caixa em apply e devolve em redeem', () => {
    const impact = cashImpactFromLedger([
      { type: 'apply', amount: 1000, occurred_on: '2026-08-01' },
      {
        type: 'redeem',
        amount: 1050,
        principal_amount: 1000,
        yield_amount: 50,
        occurred_on: '2026-08-10',
      },
    ])
    expect(impact.investedPrincipal).toBe(0)
    expect(impact.netCashOut).toBe(-50) // lucro líquido no caixa
  })
})

describe('splitRedeem / helpers', () => {
  it('proporciona principal e yield', () => {
    const split = splitRedeem(505, 1000, 1010)
    expect(split.principalAmount + split.yieldAmount).toBeCloseTo(505, 1)
  })

  it('annualToPercentPerDay e daysBetween', () => {
    expect(annualToPercentPerDay(14.15)).toBeGreaterThan(0)
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10)
  })
})
