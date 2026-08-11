'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/profile'
import { formatSupabaseError, type ActionResult } from '@/lib/supabase/errors'
import { revalidatePath } from 'next/cache'

// ─── tipos ────────────────────────────────────────────────
export type TransactionInput = {
  description: string
  amount: number
  type: 'income' | 'expense'
  date: string
  creditCardId?: string | null
  installments?: number
}

export type Transaction = {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  date: string
  credit_card_id: string | null
  group_id: string | null
  installment_current: number
  installment_total: number
  is_paid: boolean
  created_at: string
  credit_cards: { name: string; color: string } | null
}

// ─── createTransaction ────────────────────────────────────
export async function createTransaction(data: TransactionInput): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const installments = Math.max(1, data.installments || 1)
  const isCredit = !!data.creditCardId
  const baseDate = new Date(data.date + 'T12:00:00')

  let creditCard: { closing_day: number; due_day: number } | null = null
  if (isCredit && data.creditCardId) {
    const { data: cc, error: ccError } = await supabase
      .from('credit_cards')
      .select('closing_day, due_day')
      .eq('id', data.creditCardId)
      .single()
    if (ccError) return { success: false, error: formatSupabaseError(ccError) }
    creditCard = cc
  }

  const groupId = installments > 1 ? crypto.randomUUID() : null
  const amountPerInstallment = Number((data.amount / installments).toFixed(2))

  // Primeira fatura: se a compra é após o fechamento, cai no ciclo seguinte
  const firstBillDate = new Date(baseDate)
  if (isCredit && creditCard) {
    const closing = new Date(baseDate)
    closing.setDate(creditCard.closing_day)
    if (baseDate >= closing) {
      firstBillDate.setMonth(firstBillDate.getMonth() + 1)
    }
    firstBillDate.setDate(creditCard.due_day)
  }

  const toInsert = []

  for (let i = 0; i < installments; i++) {
    const txDate = new Date(firstBillDate)
    txDate.setMonth(txDate.getMonth() + i)

    toInsert.push({
      profile_id: profile.id,
      description: data.description,
      amount: amountPerInstallment,
      type: data.type,
      date: txDate.toISOString().split('T')[0],
      credit_card_id: data.creditCardId || null,
      group_id: groupId,
      installment_current: i + 1,
      installment_total: installments,
      is_paid: !isCredit, // débito = pago imediatamente
    })
  }

  const { error } = await supabase.from('transactions').insert(toInsert)
  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

// ─── getTransactions ──────────────────────────────────────
export async function getTransactions(year?: number, month?: number) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  let query = supabase
    .from('transactions')
    .select('*, credit_cards(name, color)')
    .eq('profile_id', profile.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (year !== undefined && month !== undefined) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    query = query.gte('date', start).lte('date', end)
  }

  const { data, error } = await query.limit(100)
  if (error) throw new Error(formatSupabaseError(error))

  return (data || []).map((tx) => ({
    ...tx,
    amount: Number(tx.amount),
  })) as Transaction[]
}

// ─── deleteTransaction ────────────────────────────────────
export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

// ─── deleteTransactionGroup ───────────────────────────────
export async function deleteTransactionGroup(groupId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('group_id', groupId)
    .eq('profile_id', profile.id)

  if (error) return { success: false, error: formatSupabaseError(error) }

  revalidatePath('/', 'layout')
  return { success: true }
}

// ─── getDashboardBalances ─────────────────────────────────
export async function getDashboardBalances() {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

  const [txResult, fixedResult, cardsResult] = await Promise.all([
    supabase.from('transactions').select('*').eq('profile_id', profile.id),
    supabase.from('fixed_finances').select('*').eq('profile_id', profile.id),
    supabase.from('credit_cards').select('*').eq('profile_id', profile.id),
  ])

  if (txResult.error) throw new Error(formatSupabaseError(txResult.error))
  if (fixedResult.error) throw new Error(formatSupabaseError(fixedResult.error))
  if (cardsResult.error) throw new Error(formatSupabaseError(cardsResult.error))

  const transactions = txResult.data || []
  const fixedFinances = fixedResult.data || []
  const creditCards = cardsResult.data || []

  // Saldo em conta (débito): transações pagas sem cartão + receitas fixas
  let balanceDebit = 0
  transactions
    .filter((t) => !t.credit_card_id && t.is_paid)
    .forEach((t) => {
      balanceDebit += t.type === 'income' ? Number(t.amount) : -Number(t.amount)
    })

  let fixedExpensesCurrentMonth = 0
  let fixedIncomeCurrentMonth = 0
  fixedFinances.forEach((f) => {
    if (f.type === 'expense') fixedExpensesCurrentMonth += Number(f.amount)
    else fixedIncomeCurrentMonth += Number(f.amount)
  })

  balanceDebit += fixedIncomeCurrentMonth

  let creditCardExpensesCurrentMonth = 0
  transactions
    .filter(
      (t) =>
        t.credit_card_id &&
        t.type === 'expense' &&
        !t.is_paid &&
        t.date >= monthStart &&
        t.date <= monthEnd
    )
    .forEach((t) => {
      creditCardExpensesCurrentMonth += Number(t.amount)
    })

  // Saldo real = conta corrente (já com receitas fixas) - gastos fixos - fatura do mês
  const realBalance =
    balanceDebit - fixedExpensesCurrentMonth - creditCardExpensesCurrentMonth

  const cardsWithLimits = creditCards.map((cc) => {
    const used = transactions
      .filter((t) => t.credit_card_id === cc.id && !t.is_paid && t.type === 'expense')
      .reduce((acc, t) => acc + Number(t.amount), 0)

    const limit = Number(cc.credit_limit)

    return {
      id: cc.id,
      name: cc.name,
      color: cc.color || '#6366f1',
      limit,
      used,
      available: limit - used,
      closing_day: Number(cc.closing_day),
      due_day: Number(cc.due_day),
    }
  })

  return {
    balanceDebit,
    realBalance,
    cards: cardsWithLimits,
    fixedExpensesCurrentMonth,
    fixedIncomeCurrentMonth,
    creditCardExpensesCurrentMonth,
  }
}

// ─── getCards ─────────────────────────────────────────────
export async function getCards() {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { data, error } = await supabase
    .from('credit_cards')
    .select('*')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: true })

  if (error) throw new Error(formatSupabaseError(error))
  return (data || []).map((c) => ({
    ...c,
    credit_limit: Number(c.credit_limit),
    color: c.color || '#6366f1',
  }))
}
