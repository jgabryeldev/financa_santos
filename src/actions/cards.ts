'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

export async function createCard(data: CardInput) {
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

  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateCard(id: string, data: Partial<CardInput>) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('credit_cards')
    .update(data)
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteCard(id: string) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('credit_cards')
    .delete()
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  return { success: true }
}
