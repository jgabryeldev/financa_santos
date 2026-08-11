'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/profile'
import { formatSupabaseError, type ActionResult } from '@/lib/supabase/errors'
import {
  currentCreditInvoice,
  currentCycle,
  foodAvailable,
  foodUsedInCycle,
  groupUpcomingByMonth,
  splitLimit,
  sumFutureInvoices,
  type BillingTx,
  type CardKind,
  type LimitSplit,
  type MonthBucket,
} from '@/lib/card-billing'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

export type CreditCard = {
  id: string
  profile_id: string
  name: string
  credit_limit: number
  closing_day: number
  due_day: number
  color: string
  kind: CardKind
  created_at: string
}

export type CardInput = {
  name: string
  credit_limit: number
  closing_day: number
  due_day: number
  color: string
  kind: CardKind
}

export type CardDetail = {
  card: CreditCard
  kind: CardKind
  limit: number
  split: LimitSplit
  currentInvoice: { total: number; items: BillingTx[] }
  upcomingByMonth: MonthBucket[]
  futureTotal: number
  /** Alimentação: uso no ciclo atual */
  foodUsed?: number
  foodItems?: BillingTx[]
}

function normalizeKind(raw: unknown): CardKind {
  return raw === 'food' ? 'food' : 'credit'
}

export async function createCard(data: CardInput): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const kind = data.kind || 'credit'
  const dueDay = kind === 'food' ? data.closing_day : data.due_day

  const { error } = await supabase.from('credit_cards').insert({
    profile_id: profile.id,
    household_id: profile.household_id,
    name: data.name,
    credit_limit: data.credit_limit,
    closing_day: data.closing_day,
    due_day: dueDay,
    color: data.color,
    kind,
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

  const payload: Record<string, unknown> = { ...data }
  if (data.kind === 'food' && data.closing_day != null) {
    payload.due_day = data.due_day ?? data.closing_day
  }

  const { error } = await supabase
    .from('credit_cards')
    .update(payload)
    .eq('id', id)
    .eq('household_id', profile.household_id)

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
    .eq('household_id', profile.household_id)

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getCardDetail(cardId: string): Promise<CardDetail> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { data: cardRow, error: cardError } = await supabase
    .from('credit_cards')
    .select('*')
    .eq('id', cardId)
    .eq('household_id', profile.household_id)
    .single()

  if (cardError || !cardRow) notFound()

  const { data: txRows, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('household_id', profile.household_id)
    .eq('credit_card_id', cardId)
    .order('date', { ascending: true })

  if (txError) throw new Error(formatSupabaseError(txError))

  const card: CreditCard = {
    id: cardRow.id,
    profile_id: cardRow.profile_id,
    name: cardRow.name,
    credit_limit: Number(cardRow.credit_limit),
    closing_day: Number(cardRow.closing_day),
    due_day: Number(cardRow.due_day),
    color: cardRow.color || '#6366f1',
    kind: normalizeKind(cardRow.kind),
    created_at: cardRow.created_at,
  }

  const txs = (txRows || []).map((t) => ({
    ...t,
    amount: Number(t.amount),
  })) as BillingTx[]

  const limit = card.credit_limit

  if (card.kind === 'food') {
    const cycle = currentCycle(card.closing_day)
    const used = foodUsedInCycle(txs, card.id, cycle)
    const available = foodAvailable(limit, used.total)
    const split = splitLimit(limit, used.total, 0)
    // reinterpret: current = used this cycle, future = 0
    return {
      card,
      kind: 'food',
      limit,
      split: {
        ...split,
        available,
        current: used.total,
        future: 0,
      },
      currentInvoice: { total: used.total, items: used.items },
      upcomingByMonth: [],
      futureTotal: 0,
      foodUsed: used.total,
      foodItems: used.items,
    }
  }

  const currentInvoice = currentCreditInvoice(txs, card.id)
  const upcomingByMonth = groupUpcomingByMonth(txs, card.id)
  const futureTotal = sumFutureInvoices(upcomingByMonth)
  const split = splitLimit(limit, currentInvoice.total, futureTotal)

  return {
    card,
    kind: 'credit',
    limit,
    split,
    currentInvoice,
    upcomingByMonth,
    futureTotal,
  }
}
