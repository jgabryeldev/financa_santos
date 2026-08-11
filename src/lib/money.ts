/** Converte string monetária BR/US para número. Ex: "1.500,50" → 1500.5 */
export function parseMoney(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return NaN

  const hasComma = trimmed.includes(',')
  const hasDot = trimmed.includes('.')

  let normalized = trimmed.replace(/[^\d.,-]/g, '')

  if (hasComma && hasDot) {
    // BR: 1.500,50 → ponto = milhar, vírgula = decimal
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    // 1500,50 ou 1,5
    normalized = normalized.replace(',', '.')
  }
  // só ponto: trata como decimal US (1500.50)

  return parseFloat(normalized)
}

/** Mantém só dígitos da entrada (teclado / paste). */
export function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Interpreta dígitos como centavos.
 * "454000" → 454000 centavos (= R$ 4.540,00)
 * "" → 0
 */
export function digitsToCents(raw: string): number {
  const digits = onlyDigits(raw)
  if (!digits) return 0
  // evita overflow absurdo em inputs longos
  const clipped = digits.slice(0, 12)
  return Number.parseInt(clipped, 10)
}

/** Formata centavos no padrão pt-BR: 454000 → "4.540,00" */
export function formatMoneyFromCents(cents: number): string {
  const safe = Number.isFinite(cents) && cents > 0 ? Math.trunc(cents) : 0
  return (safe / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Centavos → number para Server Actions (454000 → 4540) */
export function centsToNumber(cents: number): number {
  const safe = Number.isFinite(cents) && cents > 0 ? Math.trunc(cents) : 0
  return safe / 100
}

/** Number → centavos para hidratar o input (4540.5 → 454050) */
export function numberToCents(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 100)
}

/** Data local no formato YYYY-MM-DD (evita drift UTC do toISOString). */
export function localDateISO(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
