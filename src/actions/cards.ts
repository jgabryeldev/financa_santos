'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/profile'
import { formatSupabaseError, type ActionResult } from '@/lib/supabase/errors'
import { revalidatePath } from 'next/cache'

export type CreditCard = {
  id: string
  profile_id: string
  name: string
  credit_limit: number
  closing_day: number
  due_day: number
  color: string
  created_at: string
}

export type CardInput = {
  name: string
  credit_limit: number
  closing_day: number
  due_day: number
  color: string
}

export async function createCard(data: CardInput): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase.from('credit_cards').insert({
    profile_id: profile.id,
    name: data.name,
    credit_limit: data.credit_limit,
    closing_day: data.closing_day,
    due_day: data.due_day,
    color: data.color,
  })

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateCard(
  id: string,
  data: Partial<CardInput>
): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('credit_cards')
    .update(data)
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteCard(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('credit_cards')
    .delete()
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}
