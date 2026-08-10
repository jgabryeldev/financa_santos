'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (error || !profile) {
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({ user_id: user.id })
      .select('id')
      .single()
    if (insertError || !newProfile) throw new Error('Erro ao obter perfil do usuário')
    return newProfile
  }
  return profile
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

  if (error) throw new Error(error.message)
  return (data || []) as FixedFinance[]
}

export async function createFixed(data: FixedFinanceInput) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase.from('fixed_finances').insert({
    profile_id: profile.id,
    description: data.description,
    amount: data.amount,
    type: data.type,
    day: data.day || null,
    color: data.color || '#6366f1',
  })

  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateFixed(id: string, data: Partial<FixedFinanceInput>) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('fixed_finances')
    .update(data)
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteFixed(id: string) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('fixed_finances')
    .delete()
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  return { success: true }
}
