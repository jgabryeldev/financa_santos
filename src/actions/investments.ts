'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/profile'
import { formatSupabaseError, type ActionResult } from '@/lib/supabase/errors'
import {
  balanceFromLots,
  buildOpenLots,
  cashImpactFromLedger,
  daysBetween,
  estimateIR,
  fetchCdiSeries,
  irRateForDays,
  roundMoney,
  splitRedeem,
  type LedgerLike,
} from '@/lib/cdi'
import { localDateISO } from '@/lib/money'
import { revalidatePath } from 'next/cache'

export type InvestmentPot = {
  id: string
  profile_id: string
  name: string
  cdi_percent: number
  liquidity: 'daily' | 'dated'
  unlock_date: string | null
  color: string
  status: 'active' | 'closed'
  created_at: string
}

export type PotWithBalance = InvestmentPot & {
  principal: number
  currentAmount: number
  yieldAmount: number
  canRedeem: boolean
  earliestApplyDate: string | null
}

export type CreatePotInput = {
  name: string
  initialAmount: number
  cdiPercent: number
  liquidity: 'daily' | 'dated'
  unlockDate?: string | null
  color?: string
}

async function getCashAvailable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string
): Promise<number> {
  const [txResult, fixedResult, ledgerResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, type, credit_card_id, is_paid')
      .eq('profile_id', profileId),
    supabase.from('fixed_finances').select('amount, type').eq('profile_id', profileId),
    supabase
      .from('investment_ledger')
      .select('type, amount, principal_amount, yield_amount, occurred_on')
      .eq('profile_id', profileId),
  ])

  if (txResult.error) throw new Error(formatSupabaseError(txResult.error))
  if (fixedResult.error) throw new Error(formatSupabaseError(fixedResult.error))
  if (ledgerResult.error) {
    const msg = formatSupabaseError(ledgerResult.error)
    if (/investment_ledger|schema cache|PGRST|does not exist/i.test(msg)) {
      throw new Error(
        'Módulo de investimentos não instalado. Execute supabase_migrate_v3_investments.sql no Supabase.'
      )
    }
    throw new Error(msg)
  }

  let cash = 0
  for (const t of txResult.data || []) {
    if (t.credit_card_id || !t.is_paid) continue
    cash += t.type === 'income' ? Number(t.amount) : -Number(t.amount)
  }
  for (const f of fixedResult.data || []) {
    if (f.type === 'income') cash += Number(f.amount)
  }

  const impact = cashImpactFromLedger((ledgerResult.data || []) as LedgerLike[])
  return roundMoney(cash - impact.netCashOut)
}

export async function listPotsWithBalances(): Promise<PotWithBalance[]> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { data: pots, error } = await supabase
    .from('investment_pots')
    .select('*')
    .eq('profile_id', profile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    const msg = formatSupabaseError(error)
    if (/investment_pots|schema cache|PGRST|does not exist/i.test(msg)) {
      throw new Error(
        'Módulo de investimentos não instalado. Execute supabase_migrate_v3_investments.sql no Supabase.'
      )
    }
    throw new Error(msg)
  }
  if (!pots?.length) return []

  const { data: ledger, error: ledgerError } = await supabase
    .from('investment_ledger')
    .select('*')
    .eq('profile_id', profile.id)
    .in(
      'pot_id',
      pots.map((p) => p.id)
    )
    .order('occurred_on', { ascending: true })

  if (ledgerError) throw new Error(formatSupabaseError(ledgerError))

  const today = localDateISO()
  const allDates = (ledger || []).map((e) => e.occurred_on as string)
  const from = allDates.length ? allDates.reduce((a, b) => (a < b ? a : b)) : today
  const series = await fetchCdiSeries(from, today)

  return pots.map((pot) => {
    const potLedger = (ledger || []).filter((e) => e.pot_id === pot.id) as LedgerLike[]
    const lots = buildOpenLots(potLedger)
    const bal = balanceFromLots(lots, series, Number(pot.cdi_percent))
    const unlock = pot.unlock_date as string | null
    const canRedeem = pot.liquidity === 'daily' || (!!unlock && today >= unlock)

    return {
      id: pot.id,
      profile_id: pot.profile_id,
      name: pot.name,
      cdi_percent: Number(pot.cdi_percent),
      liquidity: pot.liquidity as 'daily' | 'dated',
      unlock_date: unlock,
      color: pot.color || '#10b981',
      status: pot.status as 'active' | 'closed',
      created_at: pot.created_at,
      principal: bal.principal,
      currentAmount: bal.amount,
      yieldAmount: bal.yield,
      canRedeem,
      earliestApplyDate: lots[0]?.date ?? null,
    }
  })
}

export async function createPotWithApply(input: CreatePotInput): Promise<ActionResult> {
  const name = input.name.trim()
  if (!name) return { success: false, error: 'Informe o nome do cofrinho.' }
  if (!input.initialAmount || input.initialAmount <= 0) {
    return { success: false, error: 'Informe um valor inicial válido.' }
  }
  if (!input.cdiPercent || input.cdiPercent < 1 || input.cdiPercent > 300) {
    return { success: false, error: 'Percentual do CDI inválido (1–300).' }
  }
  if (input.liquidity === 'dated') {
    if (!input.unlockDate) {
      return { success: false, error: 'Informe a data de liberação.' }
    }
    if (input.unlockDate < localDateISO()) {
      return { success: false, error: 'A data de liberação deve ser hoje ou futura.' }
    }
  }

  const supabase = await createClient()
  const profile = await getProfile(supabase)

  try {
    const available = await getCashAvailable(supabase, profile.id)
    if (input.initialAmount > available) {
      return {
        success: false,
        error: `Saldo insuficiente na conta corrente (disponível: R$ ${available.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
      }
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao validar saldo.' }
  }

  const { data: pot, error: potError } = await supabase
    .from('investment_pots')
    .insert({
      profile_id: profile.id,
      name,
      cdi_percent: input.cdiPercent,
      liquidity: input.liquidity,
      unlock_date: input.liquidity === 'dated' ? input.unlockDate : null,
      color: input.color || '#10b981',
      status: 'active',
    })
    .select('*')
    .single()

  if (potError || !pot) {
    return {
      success: false,
      error: formatSupabaseError(potError || { message: 'Falha ao criar cofrinho' }),
    }
  }

  const { error: ledgerError } = await supabase.from('investment_ledger').insert({
    pot_id: pot.id,
    profile_id: profile.id,
    type: 'apply',
    amount: input.initialAmount,
    occurred_on: localDateISO(),
  })

  if (ledgerError) {
    await supabase.from('investment_pots').delete().eq('id', pot.id)
    return { success: false, error: formatSupabaseError(ledgerError) }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function applyToPot(potId: string, amount: number): Promise<ActionResult> {
  if (!amount || amount <= 0) return { success: false, error: 'Informe um valor válido.' }

  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { data: pot, error: potError } = await supabase
    .from('investment_pots')
    .select('*')
    .eq('id', potId)
    .eq('profile_id', profile.id)
    .single()

  if (potError || !pot) return { success: false, error: 'Cofrinho não encontrado.' }
  if (pot.status !== 'active') return { success: false, error: 'Cofrinho encerrado.' }

  try {
    const available = await getCashAvailable(supabase, profile.id)
    if (amount > available) {
      return {
        success: false,
        error: `Saldo insuficiente (disponível: R$ ${available.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
      }
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao validar saldo.' }
  }

  const { error } = await supabase.from('investment_ledger').insert({
    pot_id: potId,
    profile_id: profile.id,
    type: 'apply',
    amount,
    occurred_on: localDateISO(),
  })

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function redeemFromPot(
  potId: string,
  amount: number
): Promise<ActionResult & { irEstimate?: number; netEstimate?: number }> {
  if (!amount || amount <= 0) return { success: false, error: 'Informe um valor válido.' }

  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { data: pot, error: potError } = await supabase
    .from('investment_pots')
    .select('*')
    .eq('id', potId)
    .eq('profile_id', profile.id)
    .single()

  if (potError || !pot) return { success: false, error: 'Cofrinho não encontrado.' }
  if (pot.status !== 'active') return { success: false, error: 'Cofrinho encerrado.' }

  const today = localDateISO()
  if (pot.liquidity === 'dated' && pot.unlock_date && today < pot.unlock_date) {
    return {
      success: false,
      error: `Resgate bloqueado até ${String(pot.unlock_date).split('-').reverse().join('/')}.`,
    }
  }

  const { data: ledger, error: ledgerError } = await supabase
    .from('investment_ledger')
    .select('*')
    .eq('pot_id', potId)
    .eq('profile_id', profile.id)
    .order('occurred_on', { ascending: true })

  if (ledgerError) return { success: false, error: formatSupabaseError(ledgerError) }

  const lots = buildOpenLots((ledger || []) as LedgerLike[])
  const from = lots[0]?.date || today
  const series = await fetchCdiSeries(from, today)
  const bal = balanceFromLots(lots, series, Number(pot.cdi_percent))

  if (amount > bal.amount + 0.009) {
    return {
      success: false,
      error: `Valor maior que o saldo do cofrinho (R$ ${bal.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
    }
  }

  const redeemAmount = Math.min(amount, bal.amount)
  const { principalAmount, yieldAmount } = splitRedeem(
    redeemAmount,
    bal.principal,
    bal.amount
  )

  const heldDays = daysBetween(from, today)
  const irEstimate = estimateIR(yieldAmount, heldDays)

  const { error } = await supabase.from('investment_ledger').insert({
    pot_id: potId,
    profile_id: profile.id,
    type: 'redeem',
    amount: redeemAmount,
    principal_amount: principalAmount,
    yield_amount: yieldAmount,
    occurred_on: today,
    note: `IR est. ${irRateForDays(heldDays) * 100}% → R$ ${irEstimate.toFixed(2)}`,
  })

  if (error) return { success: false, error: formatSupabaseError(error) }

  const remaining = roundMoney(bal.amount - redeemAmount)
  if (remaining < 0.01) {
    await supabase
      .from('investment_pots')
      .update({ status: 'closed' })
      .eq('id', potId)
      .eq('profile_id', profile.id)
  }

  revalidatePath('/', 'layout')
  return {
    success: true,
    irEstimate,
    netEstimate: roundMoney(redeemAmount - irEstimate),
  }
}

export async function deleteClosedPot(potId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { data: pot } = await supabase
    .from('investment_pots')
    .select('id, status')
    .eq('id', potId)
    .eq('profile_id', profile.id)
    .single()

  if (!pot) return { success: false, error: 'Cofrinho não encontrado.' }
  if (pot.status !== 'closed') {
    return { success: false, error: 'Só é possível excluir cofrinhos já resgatados/zerados.' }
  }

  const { error } = await supabase
    .from('investment_pots')
    .delete()
    .eq('id', potId)
    .eq('profile_id', profile.id)

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getInvestmentTotals(): Promise<{
  investedPrincipal: number
  investedCurrent: number
  investedYield: number
  netCashOut: number
}> {
  const empty = {
    investedPrincipal: 0,
    investedCurrent: 0,
    investedYield: 0,
    netCashOut: 0,
  }

  try {
    const pots = await listPotsWithBalances()
    const investedPrincipal = roundMoney(pots.reduce((a, p) => a + p.principal, 0))
    const investedCurrent = roundMoney(pots.reduce((a, p) => a + p.currentAmount, 0))
    const investedYield = roundMoney(investedCurrent - investedPrincipal)

    const supabase = await createClient()
    const profile = await getProfile(supabase)
    const { data: ledger } = await supabase
      .from('investment_ledger')
      .select('type, amount, principal_amount, yield_amount, occurred_on')
      .eq('profile_id', profile.id)

    const impact = cashImpactFromLedger((ledger || []) as LedgerLike[])

    return {
      investedPrincipal,
      investedCurrent,
      investedYield,
      netCashOut: impact.netCashOut,
    }
  } catch {
    return empty
  }
}
