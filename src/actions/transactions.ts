'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

// ─── helpers ──────────────────────────────────────────────
async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (error || !profile) {
    // Cria o perfil se ainda não existir (fallback)
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

// ─── createTransaction ────────────────────────────────────
export async function createTransaction(data: TransactionInput) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const installments = Math.max(1, data.installments || 1)
  const isCredit = !!data.creditCardId
  const baseDate = new Date(data.date + 'T12:00:00')

  let creditCard: { closing_day: number; due_day: number } | null = null
  if (isCredit && data.creditCardId) {
    const { data: cc } = await supabase
      .from('credit_cards')
      .select('closing_day, due_day')
      .eq('id', data.creditCardId)
      .single()
    creditCard = cc
  }

  const groupId = installments > 1 ? crypto.randomUUID() : null
  const amountPerInstallment = Number((data.amount / installments).toFixed(2))

  const toInsert = []

  for (let i = 0; i < installments; i++) {
    let txDate = new Date(baseDate)
    txDate.setMonth(txDate.getMonth() + i)

    let isPaid = !isCredit // débito = pago imediatamente

    if (isCredit && creditCard) {
      // Se a compra foi feita após o fechamento, vai para a fatura do mês seguinte
      const closing = new Date(txDate)
      closing.setDate(creditCard.closing_day)

      if (baseDate >= closing) {
        txDate.setMonth(txDate.getMonth() + 1)
      }
      txDate.setDate(creditCard.due_day)
    }

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
      is_paid: isPaid,
    })
  }

  const { error } = await supabase.from('transactions').insert(toInsert)
  if (error) throw new Error(error.message)

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
  if (error) throw new Error(error.message)

  return (data || []) as Transaction[]
}

// ─── deleteTransaction ────────────────────────────────────
export async function deleteTransaction(id: string) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  return { success: true }
}

// ─── deleteTransactionGroup ───────────────────────────────
export async function deleteTransactionGroup(groupId: string) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('group_id', groupId)
    .eq('profile_id', profile.id)

  if (error) throw new Error(error.message)

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

  const [
    { data: transactions },
    { data: fixedFinances },
    { data: creditCards },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('profile_id', profile.id),
    supabase
      .from('fixed_finances')
      .select('*')
      .eq('profile_id', profile.id),
    supabase
      .from('credit_cards')
      .select('*')
      .eq('profile_id', profile.id),
  ])

  // Saldo em conta (débito): soma de todas as transações pagas sem cartão
  let balanceDebit = 0
  ;(transactions || [])
    .filter(t => !t.credit_card_id && t.is_paid)
    .forEach(t => {
      balanceDebit += t.type === 'income' ? Number(t.amount) : -Number(t.amount)
    })

  // Gastos fixos mensais
  let fixedExpensesCurrentMonth = 0
  let fixedIncomeCurrentMonth = 0
  ;(fixedFinances || []).forEach(f => {
    if (f.type === 'expense') fixedExpensesCurrentMonth += Number(f.amount)
    else fixedIncomeCurrentMonth += Number(f.amount)
  })

  // Fatura do mês atual (crédito, não pago, no mês corrente)
  let creditCardExpensesCurrentMonth = 0
  ;(transactions || [])
    .filter(t =>
      t.credit_card_id &&
      t.type === 'expense' &&
      !t.is_paid &&
      t.date >= monthStart &&
      t.date <= monthEnd
    )
    .forEach(t => {
      creditCardExpensesCurrentMonth += Number(t.amount)
    })

  // Saldo real = saldo em conta - gastos fixos - fatura atual do cartão
  const realBalance = balanceDebit - fixedExpensesCurrentMonth - creditCardExpensesCurrentMonth

  // Resumo por cartão
  const cardsWithLimits = (creditCards || []).map(cc => {
    const used = (transactions || [])
      .filter(t => t.credit_card_id === cc.id && !t.is_paid && t.type === 'expense')
      .reduce((acc, t) => acc + Number(t.amount), 0)

    return {
      id: cc.id,
      name: cc.name,
      color: cc.color,
      limit: Number(cc.credit_limit),
      used,
      available: Number(cc.credit_limit) - used,
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

  if (error) {
    const extra = [error.code, error.hint, error.details].filter(Boolean).join(' — ')
    throw new Error(extra ? `${error.message} (${extra})` : error.message)
  }
  return data || []
}
