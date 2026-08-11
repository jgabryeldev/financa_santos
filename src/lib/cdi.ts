export type CdiPoint = {
  date: string // YYYY-MM-DD
  /** Percentual ao dia, como na série SGS 12 (ex.: 0.052531 = 0,052531% a.d.) */
  percentPerDay: number
}

export type AccrueResult = {
  principal: number
  amount: number
  yield: number
  businessDays: number
}

export type Lot = {
  date: string
  principal: number
}

export type LedgerLike = {
  type: 'apply' | 'redeem'
  amount: number
  occurred_on: string
  principal_amount?: number | null
  yield_amount?: number | null
}

/** Converte data BCB DD/MM/YYYY → YYYY-MM-DD */
export function parseBcbDate(raw: string): string {
  const [d, m, y] = raw.split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/**
 * Fator diário para um ponto CDI (% a.d.) e percentual do índice (ex.: 102).
 * Ex.: 0.052531% a.d. a 100% → 1 + 0.00052531
 */
export function dailyFactor(percentPerDay: number, cdiPercentOfIndex: number): number {
  const base = percentPerDay / 100
  const scaled = base * (cdiPercentOfIndex / 100)
  return 1 + scaled
}

/** Capitaliza principal ao longo da série (já filtrada / ordenada). */
export function accruePrincipal(
  principal: number,
  series: CdiPoint[],
  cdiPercentOfIndex: number
): AccrueResult {
  if (principal <= 0 || series.length === 0) {
    return { principal, amount: Math.max(0, principal), yield: 0, businessDays: 0 }
  }

  let amount = principal
  for (const point of series) {
    amount *= dailyFactor(point.percentPerDay, cdiPercentOfIndex)
  }

  const rounded = roundMoney(amount)
  return {
    principal: roundMoney(principal),
    amount: rounded,
    yield: roundMoney(rounded - principal),
    businessDays: series.length,
  }
}

/** Filtra série a partir de fromDate (inclusive), ordenada. */
export function seriesFrom(series: CdiPoint[], fromDate: string): CdiPoint[] {
  return series
    .filter((p) => p.date >= fromDate)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Reconstrói lotes abertos (FIFO): applies aumentam; redeems reduzem principal.
 */
export function buildOpenLots(ledger: LedgerLike[]): Lot[] {
  const lots: Lot[] = []
  const sorted = [...ledger].sort((a, b) => {
    const byDate = a.occurred_on.localeCompare(b.occurred_on)
    if (byDate !== 0) return byDate
    return a.type === 'apply' ? -1 : 1
  })

  for (const entry of sorted) {
    if (entry.type === 'apply') {
      lots.push({ date: entry.occurred_on, principal: Number(entry.amount) })
      continue
    }

    let toRemove = Number(entry.principal_amount ?? entry.amount)
    for (const lot of lots) {
      if (toRemove <= 0) break
      const take = Math.min(lot.principal, toRemove)
      lot.principal = roundMoney(lot.principal - take)
      toRemove = roundMoney(toRemove - take)
    }
  }

  return lots.filter((l) => l.principal > 0.001)
}

export function sumPrincipal(lots: Lot[]): number {
  return roundMoney(lots.reduce((acc, l) => acc + l.principal, 0))
}

/** Saldo atual = soma dos lotes capitalizados desde a data de cada aporte. */
export function balanceFromLots(
  lots: Lot[],
  series: CdiPoint[],
  cdiPercentOfIndex: number
): AccrueResult {
  let amount = 0
  let principal = 0
  let businessDays = 0

  for (const lot of lots) {
    const slice = seriesFrom(series, lot.date)
    const r = accruePrincipal(lot.principal, slice, cdiPercentOfIndex)
    amount += r.amount
    principal += r.principal
    businessDays = Math.max(businessDays, r.businessDays)
  }

  amount = roundMoney(amount)
  principal = roundMoney(principal)
  return {
    principal,
    amount,
    yield: roundMoney(amount - principal),
    businessDays,
  }
}

/** IR regressivo sobre o rendimento (estimativa). daysHeld = dias corridos. */
export function estimateIR(yieldAmount: number, daysHeld: number): number {
  if (yieldAmount <= 0) return 0
  let rate = 0.225
  if (daysHeld > 720) rate = 0.15
  else if (daysHeld > 360) rate = 0.175
  else if (daysHeld > 180) rate = 0.2
  return roundMoney(yieldAmount * rate)
}

export function irRateForDays(daysHeld: number): number {
  if (daysHeld > 720) return 0.15
  if (daysHeld > 360) return 0.175
  if (daysHeld > 180) return 0.2
  return 0.225
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T12:00:00')
  const b = new Date(toISO + 'T12:00:00')
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Impacto no caixa: applies saem; redeems (amount total) voltam.
 * investedPrincipal = applies - redeem principals (ainda "preso").
 */
export function cashImpactFromLedger(ledger: LedgerLike[]): {
  investedPrincipal: number
  netCashOut: number
} {
  let applies = 0
  let redeemPrincipal = 0
  let redeemTotal = 0

  for (const e of ledger) {
    if (e.type === 'apply') applies += Number(e.amount)
    else {
      redeemTotal += Number(e.amount)
      redeemPrincipal += Number(e.principal_amount ?? 0)
    }
  }

  return {
    investedPrincipal: roundMoney(Math.max(0, applies - redeemPrincipal)),
    netCashOut: roundMoney(applies - redeemTotal),
  }
}

/** Fallback quando a API falha: % a.d. equivalente a annual% a.a. base 252. */
export function annualToPercentPerDay(annualPct: number): number {
  const daily = Math.pow(1 + annualPct / 100, 1 / 252) - 1
  return daily * 100
}

export function parseBcbSeries(
  rows: Array<{ data: string; valor: string | number }>
): CdiPoint[] {
  return rows
    .map((row) => ({
      date: parseBcbDate(row.data),
      percentPerDay: Number(row.valor),
    }))
    .filter((p) => p.date && Number.isFinite(p.percentPerDay))
    .sort((a, b) => a.date.localeCompare(b.date))
}

const FALLBACK_ANNUAL_CDI = 14.15

let memoryCache: { key: string; points: CdiPoint[]; expires: number } | null = null

export async function fetchCdiSeries(
  fromISO: string,
  toISO: string
): Promise<CdiPoint[]> {
  const key = `${fromISO}:${toISO}`
  const now = Date.now()
  if (memoryCache && memoryCache.key === key && memoryCache.expires > now) {
    return memoryCache.points
  }

  const dataInicial = isoToBcb(fromISO)
  const dataFinal = isoToBcb(toISO)
  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados` +
    `?formato=json&dataInicial=${encodeURIComponent(dataInicial)}` +
    `&dataFinal=${encodeURIComponent(dataFinal)}`

  try {
    const res = await fetch(url, { next: { revalidate: 21_600 } })
    if (!res.ok) throw new Error(`BCB ${res.status}`)
    const json = (await res.json()) as Array<{ data: string; valor: string }>
    const points = parseBcbSeries(json)
    if (points.length === 0) throw new Error('BCB vazio')
    memoryCache = { key, points, expires: now + 6 * 60 * 60 * 1000 }
    return points
  } catch {
    // Série sintética com CDI fallback em todos os dias úteis aproximados
    const points = synthesizeWeekdaySeries(fromISO, toISO, FALLBACK_ANNUAL_CDI)
    memoryCache = { key, points, expires: now + 30 * 60 * 1000 }
    return points
  }
}

function isoToBcb(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function synthesizeWeekdaySeries(
  fromISO: string,
  toISO: string,
  annualPct: number
): CdiPoint[] {
  const percentPerDay = annualToPercentPerDay(annualPct)
  const points: CdiPoint[] = []
  const cur = new Date(fromISO + 'T12:00:00')
  const end = new Date(toISO + 'T12:00:00')
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      points.push({ date: `${y}-${m}-${d}`, percentPerDay })
    }
    cur.setDate(cur.getDate() + 1)
  }
  return points
}

/** Proporção principal/yield ao resgatar `redeemAmount` do saldo atual. */
export function splitRedeem(
  redeemAmount: number,
  principal: number,
  currentAmount: number
): { principalAmount: number; yieldAmount: number } {
  if (redeemAmount <= 0 || currentAmount <= 0) {
    return { principalAmount: 0, yieldAmount: 0 }
  }
  const ratio = Math.min(1, redeemAmount / currentAmount)
  const principalAmount = roundMoney(principal * ratio)
  const yieldAmount = roundMoney(redeemAmount - principalAmount)
  return { principalAmount, yieldAmount }
}
