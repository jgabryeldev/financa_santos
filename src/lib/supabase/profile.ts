import { redirect } from 'next/navigation'
import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type AppProfile = {
  id: string
  household_id: string
  name: string | null
  email: string | null
}

async function resolveHouseholdId(supabase: Supabase): Promise<string> {
  const { data } = await supabase
    .from('households')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (data?.id) return data.id

  // Fallback estável (mesmo UUID da migração v5) — raro, só se RLS/tabela ausente
  return '00000000-0000-4000-8000-000000000001'
}

export async function getProfile(supabase: Supabase): Promise<AppProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, household_id, name, email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!error && profile?.id && profile.household_id) {
    // Mantém e-mail sincronizado se ainda vazio
    if (!profile.email && user.email) {
      await supabase
        .from('profiles')
        .update({ email: user.email })
        .eq('id', profile.id)
      return { ...profile, email: user.email }
    }
    return profile as AppProfile
  }

  const householdId = await resolveHouseholdId(supabase)
  const displayName =
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Membro'

  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({
      user_id: user.id,
      household_id: householdId,
      email: user.email ?? null,
      name: displayName,
    })
    .select('id, household_id, name, email')
    .single()

  if (insertError || !newProfile) {
    // Conflito: perfil criado pelo trigger sem select completo
    const { data: again } = await supabase
      .from('profiles')
      .select('id, household_id, name, email')
      .eq('user_id', user.id)
      .single()
    if (again?.id && again.household_id) return again as AppProfile
    throw new Error(
      insertError
        ? `Erro ao obter perfil: ${insertError.message}. Execute supabase_migrate_v5_family_household.sql no Supabase.`
        : 'Erro ao obter perfil do usuário'
    )
  }

  return newProfile as AppProfile
}
