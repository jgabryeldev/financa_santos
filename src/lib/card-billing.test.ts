import { describe, expect, it } from 'vitest'
import {
  currentCycle,
  currentCreditInvoice,
  foodAvailable,
  foodUsedInCycle,
  groupUpcomingByMonth,
  invoiceForMonth,
  splitLimit,
  type BillingTx,
} from './card-billing'

const txs: BillingTx[] = [
  {
    id: '1',
    description: 'Mercado',
    amount: 100,
    type: 'expense',
    date: '2026-08-10',
    credit_card_id: 'card1',
    is_paid: false,
  },
  {
    id: '2',
    description: 'Parcela 2/3',
    amount: 200,
    type: 'expense',
    date: '2026-09-10',
    credit_card_id: 'card1',
    is_paid: false,
  },
  {
    id: '3',
    description: 'Parcela 3/3',
    amount: 200,
    type: 'expense',
    date: '2026-10-10',
    credit_card_id: 'card1',
    is_paid: false,
  },
  {
    id: '4',
    description: 'Outro cartão',
    amount: 50,
    type: 'expense',
    date: '2026-08-10',
    credit_card_id: 'card2',
    is_paid: false,
  },
]

describe('invoiceForMonth / currentCreditInvoice', () => {
  it('soma fatura do mês', () => {
    const aug = invoiceForMonth(txs, 'card1', 2026, 8)
    expect(aug.total).toBe(100)
    expect(aug.items).toHaveLength(1)
  })

  it('fatura atual filtra não pagos do mês', () => {
    const today = new Date('2026-08-15T12:00:00')
    const inv = currentCreditInvoice(txs, 'card1', today)
    expect(inv.total).toBe(100)
  })
})

describe('groupUpcomingByMonth', () => {
  it('agrupa meses futuros após a fatura atual', () => {
    const upcoming = groupUpcomingByMonth(txs, 'card1', '2026-08-15')
    expect(upcoming).toHaveLength(2)
    expect(upcoming[0]).toMatchObject({ year: 2026, month: 9, total: 200 })
    expect(upcoming[1]).toMatchObject({ year: 2026, month: 10, total: 200 })
  })
})

describe('splitLimit', () => {
  it('monta segmentos da barra estilo app bancário', () => {
    const split = splitLimit(1000, 100, 400)
    expect(split.available).toBe(500)
    expect(split.current).toBe(100)
    expect(split.future).toBe(400)
    expect(split.availablePct + split.currentPct + split.futurePct).toBeCloseTo(100, 5)
  })

  it('quando estoura o limite, disponível zera', () => {
    const split = splitLimit(100, 80, 50)
    expect(split.available).toBe(0)
  })
})

describe('food cycle', () => {
  it('currentCycle cobre renovação pelo closing_day', () => {
    const today = new Date('2026-08-20T12:00:00')
    const cycle = currentCycle(10, today)
    expect(cycle.start).toBe('2026-08-11')
    expect(cycle.end).toBe('2026-09-10')
  })

  it('foodUsedInCycle e foodAvailable', () => {
    const cycle = { start: '2026-08-01', end: '2026-08-31', dueYear: 2026, dueMonth: 8 }
    const foodTxs: BillingTx[] = [
      {
        id: 'f1',
        description: 'Almoço',
        amount: 40,
        type: 'expense',
        date: '2026-08-12',
        credit_card_id: 'food1',
        is_paid: true,
      },
    ]
    const used = foodUsedInCycle(foodTxs, 'food1', cycle)
    expect(used.total).toBe(40)
    expect(foodAvailable(500, used.total)).toBe(460)
  })
})
