import { describe, expect, it } from 'vitest'
import { isNormalizeDayError, normalizeDay } from '@/lib/fixed-day'
import { formatSupabaseError } from '@/lib/supabase/errors'

describe('normalizeDay', () => {
  it('aceita null/undefined como opcional', () => {
    expect(normalizeDay(null)).toBeNull()
    expect(normalizeDay(undefined)).toBeNull()
  })

  it('aceita dias válidos', () => {
    expect(normalizeDay(5)).toBe(5)
    expect(normalizeDay(31)).toBe(31)
  })

  it('rejeita fora do intervalo', () => {
    const result = normalizeDay(32)
    expect(isNormalizeDayError(result)).toBe(true)
    if (isNormalizeDayError(result)) {
      expect(result.error).toMatch(/1 e 31/)
    }
  })
})

describe('formatSupabaseError', () => {
  it('orienta migrate v2 para PGRST204', () => {
    const msg = formatSupabaseError({
      message: "Could not find the 'color' column of 'fixed_finances' in the schema cache",
      code: 'PGRST204',
    })
    expect(msg).toContain('supabase_migrate_v2_reconcile.sql')
  })

  it('orienta migrate v2 para day_of_month NOT NULL', () => {
    const msg = formatSupabaseError({
      message: 'null value in column "day_of_month" of relation "fixed_finances" violates not-null constraint',
      code: '23502',
    })
    expect(msg).toContain('day_of_month')
    expect(msg).toContain('supabase_migrate_v2_reconcile.sql')
  })
})
