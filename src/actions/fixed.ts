'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/profile'
import { formatSupabaseError, type ActionResult } from '@/lib/supabase/errors'
import { revalidatePath } from 'next/cache'

export type FixedFinance = {
  id: string
  profile_id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  day: number | null
  color: string
  created_at: string
}

export type FixedFinanceInput = {
  description: string
  amount: number
  type: 'income' | 'expense'
  day?: number | null
  color?: string
}

function normalizeDay(day?: number | null): number | null | { error: string } {
  if (day == null || day === undefined) return null
  if (Number.isNaN(day)) return { error: 'Dia do mês inválido.' }
  const n = Math.trunc(day)
  if (n < 1 || n > 31) return { error: 'Dia do mês deve ser entre 1 e 31.' }
  return n
}

export async function getFixedFinances() {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { data, error } = await supabase
    .from('fixed_finances')
    .select('*')
    .eq('profile_id', profile.id)
    .order('type', { ascending: false })
    .order('amount', { ascending: false })

  if (error) throw new Error(formatSupabaseError(error))
  return (data || []).map((item) => ({
    ...item,
    amount: Number(item.amount),
    color: item.color || '#6366f1',
    day: item.day ?? null,
  })) as FixedFinance[]
}

export async function createFixed(data: FixedFinanceInput): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const day = normalizeDay(data.day)
  if (day && typeof day === 'object' && 'error' in day) {
    return { success: false, error: day.error }
  }

  const { error } = await supabase.from('fixed_finances').insert({
    profile_id: profile.id,
    description: data.description,
    amount: data.amount,
    type: data.type,
    day,
    color: data.color || '#6366f1',
  })

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateFixed(
  id: string,
  data: Partial<FixedFinanceInput>
): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const payload: Record<string, unknown> = { ...data }
  if ('day' in data) {
    const day = normalizeDay(data.day)
    if (day && typeof day === 'object' && 'error' in day) {
      return { success: false, error: day.error }
    }
    payload.day = day
  }

  const { error } = await supabase
    .from('fixed_finances')
    .update(payload)
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteFixed(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('fixed_finances')
    .delete()
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}
