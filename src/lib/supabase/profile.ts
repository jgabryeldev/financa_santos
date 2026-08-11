import { redirect } from 'next/navigation'
import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export async function getProfile(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
    if (insertError || !newProfile) {
      throw new Error('Erro ao obter perfil do usuário')
    }
    return newProfile
  }

  return profile
}
