export type NormalizeDayResult = number | null | { error: string }

/** Normaliza dia do mês opcional (1–31) ou null. */
export function normalizeDay(day?: number | null): NormalizeDayResult {
  if (day == null || day === undefined) return null
  if (Number.isNaN(day)) return { error: 'Dia do mês inválido.' }
  const n = Math.trunc(day)
  if (n < 1 || n > 31) return { error: 'Dia do mês deve ser entre 1 e 31.' }
  return n
}

export function isNormalizeDayError(
  value: NormalizeDayResult
): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value
}
