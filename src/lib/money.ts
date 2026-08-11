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

/** Data local no formato YYYY-MM-DD (evita drift UTC do toISOString). */
export function localDateISO(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
