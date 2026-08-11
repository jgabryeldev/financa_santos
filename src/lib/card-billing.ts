export type CardKind = 'credit' | 'food'

export type BillingTx = {
  id: string
  description: string
  amount: number
  type: string
  date: string
  credit_card_id: string | null
  is_paid: boolean
  installment_current?: number
  installment_total?: number
}

export type DateCycle = {
  start: string // YYYY-MM-DD inclusive (day after previous closing)
  end: string // YYYY-MM-DD inclusive (next closing day)
  dueYear: number
  dueMonth: number // 1-12 — month of the due date for this cycle's invoice
}

export type MonthBucket = {
  year: number
  month: number
  total: number
  items: BillingTx[]
}

export type LimitSplit = {
  available: number
  current: number
  future: number
  availablePct: number
  currentPct: number
  futurePct: number
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(iso: string): Date {
  return new Date(iso + 'T12:00:00')
}

function clampDay(year: number, monthIndex: number, day: number): number {
  const last = new Date(year, monthIndex + 1, 0).getDate()
  return Math.min(day, last)
}

/** Próximo (ou mesmo) dia de fechamento a partir de `today`. */
function nextClosingDate(closingDay: number, today: Date): Date {
  const y = today.getFullYear()
  const m = today.getMonth()
  const dayThisMonth = clampDay(y, m, closingDay)
  const candidate = new Date(y, m, dayThisMonth, 12)
  if (today <= candidate) return candidate
  const nm = m + 1
  const ny = nm > 11 ? y + 1 : y
  const realM = nm % 12
  return new Date(ny, realM, clampDay(ny, realM, closingDay), 12)
}

function previousClosingDate(closingDay: number, closingOrAfter: Date): Date {
  const y = closingOrAfter.getFullYear()
  const m = closingOrAfter.getMonth()
  const dayThis = clampDay(y, m, closingDay)
  const thisClose = new Date(y, m, dayThis, 12)
  if (toISODate(thisClose) === toISODate(closingOrAfter)) {
    const pm = m - 1
    const py = pm < 0 ? y - 1 : y
    const realM = (pm + 12) % 12
    return new Date(py, realM, clampDay(py, realM, closingDay), 12)
  }
  if (closingOrAfter > thisClose) return thisClose
  const pm = m - 1
  const py = pm < 0 ? y - 1 : y
  const realM = (pm + 12) % 12
  return new Date(py, realM, clampDay(py, realM, closingDay), 12)
}

/**
 * Ciclo aberto de fatura: após o último fechamento até o próximo fechamento.
 * A fatura desse ciclo vence no `due_day` do mês seguinte ao fechamento (padrão CDB/cartão BR simplificado:
 * compras até o fechamento entram na fatura que vence no due_day do período).
 *
 * Modelo alinhado ao createTransaction: a `date` da parcela já é o dia de vencimento.
 * Então "fatura atual" = txs com date no mês de vencimento corrente (due month).
 */
export function currentDueMonth(today: Date = new Date()): { year: number; month: number } {
  return { year: today.getFullYear(), month: today.getMonth() + 1 }
}

/**
 * Ciclo de compras (para alimentação / renovação): do dia após o último closing
 * até o próximo closing (inclusive no end para UI).
 */
export function currentCycle(closingDay: number, today: Date = new Date()): DateCycle {
  const nextClose = nextClosingDate(closingDay, today)
  const prevClose = previousClosingDate(closingDay, nextClose)
  const startDate = new Date(prevClose)
  startDate.setDate(startDate.getDate() + 1)

  // dueYear/Month = mês do próximo fechamento (createTransaction grava date = due;
  // para food, o ciclo usa o mês do nextClose).
  return {
    start: toISODate(startDate),
    end: toISODate(nextClose),
    dueYear: nextClose.getFullYear(),
    dueMonth: nextClose.getMonth() + 1,
  }
}

export function invoiceForMonth(
  txs: BillingTx[],
  cardId: string,
  year: number,
  month: number
): { total: number; items: BillingTx[] } {
  const start = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${pad(month)}-${pad(lastDay)}`

  const items = txs.filter(
    (t) =>
      t.credit_card_id === cardId &&
      t.type === 'expense' &&
      t.date >= start &&
      t.date <= end
  )
  const total = round2(items.reduce((a, t) => a + Number(t.amount), 0))
  return { total, items }
}

/** Fatura atual de crédito: despesas não pagas com vencimento no mês corrente. */
export function currentCreditInvoice(
  txs: BillingTx[],
  cardId: string,
  today: Date = new Date()
): { total: number; items: BillingTx[] } {
  const { year, month } = currentDueMonth(today)
  const { items } = invoiceForMonth(txs, cardId, year, month)
  const unpaid = items.filter((t) => !t.is_paid)
  return {
    total: round2(unpaid.reduce((a, t) => a + Number(t.amount), 0)),
    items: unpaid,
  }
}

export function groupUpcomingByMonth(
  txs: BillingTx[],
  cardId: string,
  fromISO?: string
): MonthBucket[] {
  const today = fromISO || toISODate(new Date())
  const { year: cy, month: cm } = currentDueMonth(parseISODate(today))
  const currentEnd = `${cy}-${pad(cm)}-${pad(new Date(cy, cm, 0).getDate())}`

  const future = txs.filter(
    (t) =>
      t.credit_card_id === cardId &&
      t.type === 'expense' &&
      !t.is_paid &&
      t.date > currentEnd
  )

  const map = new Map<string, MonthBucket>()
  for (const t of future) {
    const [y, m] = t.date.split('-').map(Number)
    const key = `${y}-${pad(m)}`
    if (!map.has(key)) {
      map.set(key, { year: y, month: m, total: 0, items: [] })
    }
    const bucket = map.get(key)!
    bucket.items.push(t)
    bucket.total = round2(bucket.total + Number(t.amount))
  }

  return [...map.values()].sort((a, b) =>
    a.year === b.year ? a.month - b.month : a.year - b.year
  )
}

export function sumFutureInvoices(upcoming: MonthBucket[]): number {
  return round2(upcoming.reduce((a, b) => a + b.total, 0))
}

export function splitLimit(
  limit: number,
  currentInvoice: number,
  futureInvoices: number
): LimitSplit {
  const current = Math.max(0, currentInvoice)
  const future = Math.max(0, futureInvoices)
  const used = current + future
  const available = Math.max(0, limit - used)
  const base = Math.max(limit, used, 1)
  return {
    available: round2(available),
    current: round2(current),
    future: round2(future),
    availablePct: (available / base) * 100,
    currentPct: (current / base) * 100,
    futurePct: (future / base) * 100,
  }
}

export function foodUsedInCycle(
  txs: BillingTx[],
  cardId: string,
  cycle: DateCycle
): { total: number; items: BillingTx[] } {
  const items = txs.filter(
    (t) =>
      t.credit_card_id === cardId &&
      t.type === 'expense' &&
      t.date >= cycle.start &&
      t.date <= cycle.end
  )
  return {
    total: round2(items.reduce((a, t) => a + Number(t.amount), 0)),
    items,
  }
}

export function foodAvailable(limit: number, used: number): number {
  return round2(Math.max(0, limit - used))
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
