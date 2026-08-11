'use client'

import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, BarChart2, Trash2, Users } from 'lucide-react'
import { deleteTransaction, deleteTransactionGroup } from '@/actions/transactions'
import { useMemo, useState, useTransition } from 'react'
import type { Transaction } from '@/actions/transactions'

type Props = {
  transactions: Transaction[]
  year: number
  month: number
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function memberLabel(tx: Transaction) {
  const by = tx.created_by
  if (!by) return 'Família'
  return by.name || by.email || 'Membro'
}

export function ReportsClient({ transactions, year, month }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [openMember, setOpenMember] = useState<string | null>(null)

  function navigate(dir: 1 | -1) {
    let newMonth = month + dir
    let newYear = year
    if (newMonth > 12) { newMonth = 1; newYear++ }
    if (newMonth < 1) { newMonth = 12; newYear-- }
    router.push(`/reports?year=${newYear}&month=${newMonth}`)
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
  const balance = totalIncome - totalExpense

  const byCard: Record<string, { name: string; color: string; total: number }> = {}
  transactions.filter(t => t.credit_card_id && t.type === 'expense').forEach(t => {
    const cardId = t.credit_card_id!
    if (!byCard[cardId]) {
      byCard[cardId] = {
        name: t.credit_cards?.name || 'Cartão',
        color: t.credit_cards?.color || '#6366f1',
        total: 0,
      }
    }
    byCard[cardId].total += Number(t.amount)
  })

  const byMember = useMemo(() => {
    const map: Record<
      string,
      { key: string; label: string; email: string | null; total: number; items: Transaction[] }
    > = {}

    for (const t of transactions.filter((tx) => tx.type === 'expense')) {
      const key = t.created_by_profile_id || t.created_by?.id || 'unknown'
      const label = memberLabel(t)
      if (!map[key]) {
        map[key] = {
          key,
          label,
          email: t.created_by?.email ?? null,
          total: 0,
          items: [],
        }
      }
      map[key].total += Number(t.amount)
      map[key].items.push(t)
    }

    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [transactions])

  function handleDelete(tx: Transaction) {
    const isGroup = tx.installment_total > 1 && tx.group_id
    const msg = isGroup
      ? `Excluir todas as ${tx.installment_total} parcelas desta compra?`
      : 'Excluir esta transação?'
    if (!confirm(msg)) return

    setError(null)
    startTransition(async () => {
      try {
        const result =
          isGroup && tx.group_id
            ? await deleteTransactionGroup(tx.group_id)
            : await deleteTransaction(tx.id)
        if (!result.success) setError(result.error)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao excluir.')
      }
    })
  }

  return (
    <main className="min-h-screen p-4 pb-32">
      <header className="py-4 mb-6">
        <p className="text-zinc-500 text-sm font-medium mb-1">Relatório mensal</p>
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-zinc-100">
            {MONTHS[month - 1]} {year}
          </h1>
          <button
            onClick={() => navigate(1)}
            className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      <section className="mb-6">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-3xl p-5 mb-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-[10px] text-zinc-600 mb-1">Receitas</p>
              <p className="text-base font-bold text-emerald-400">+{fmt(totalIncome)}</p>
            </div>
            <div className="text-center border-x border-zinc-800">
              <p className="text-[10px] text-zinc-600 mb-1">Despesas</p>
              <p className="text-base font-bold text-red-400">-{fmt(totalExpense)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-zinc-600 mb-1">Saldo</p>
              <p className={`text-base font-bold ${balance >= 0 ? 'text-zinc-100' : 'text-red-400'}`}>
                {balance >= 0 ? '+' : ''}{fmt(balance)}
              </p>
            </div>
          </div>
        </div>

        {Object.keys(byCard).length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-zinc-500 font-medium px-1">Faturas do mês</p>
            {Object.entries(byCard).map(([id, info]) => (
              <div key={id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
                <span className="text-sm text-zinc-300 flex-1">{info.name}</span>
                <span className="text-sm font-bold text-red-400">R$ {fmt(info.total)}</span>
              </div>
            ))}
          </div>
        )}

        {byMember.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 font-medium px-1 flex items-center gap-1.5">
              <Users size={12} />
              Gastos por pessoa
            </p>
            {byMember.map((member) => {
              const open = openMember === member.key
              return (
                <div key={member.key} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenMember(open ? null : member.key)}
                    className="w-full p-3 flex items-center gap-3 text-left hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center text-xs font-bold uppercase">
                      {member.label.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 font-medium truncate">{member.label}</p>
                      {member.email && (
                        <p className="text-[10px] text-zinc-600 truncate">{member.email}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-400">R$ {fmt(member.total)}</p>
                      <p className="text-[10px] text-zinc-600">{member.items.length} itens</p>
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-zinc-800 px-3 py-2 space-y-2">
                      {member.items.map((tx) => (
                        <div key={tx.id} className="flex items-start justify-between gap-3 py-1.5">
                          <div className="min-w-0">
                            <p className="text-xs text-zinc-300 truncate">{tx.description}</p>
                            <p className="text-[10px] text-zinc-600 mt-0.5">
                              {tx.date ? format(parseISO(tx.date), "d MMM", { locale: ptBR }) : '—'}
                              {tx.credit_cards ? ` · ${tx.credit_cards.name}` : ' · Débito'}
                              {tx.installment_total > 1
                                ? ` · ${tx.installment_current}/${tx.installment_total}x`
                                : ''}
                            </p>
                          </div>
                          <p className="text-xs font-semibold text-red-400 flex-shrink-0">
                            R$ {fmt(Number(tx.amount))}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl mb-3">{error}</p>
        )}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart2 size={16} className="text-zinc-500" />
            Transações
          </h2>
          <span className="text-xs text-zinc-600">{transactions.length} itens</span>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12 text-zinc-600">
            <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma transação neste mês.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const isExpense = tx.type === 'expense'
              const isInstallment = tx.installment_total > 1

              return (
                <div
                  key={tx.id}
                  className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isExpense ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {isExpense ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{tx.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {tx.credit_cards ? (
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tx.credit_cards.color }} />
                          {tx.credit_cards.name}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500">Débito</span>
                      )}
                      <span className="text-[10px] text-zinc-600">•</span>
                      <span className="text-[10px] text-zinc-500">
                        {tx.date ? format(parseISO(tx.date), "d MMM", { locale: ptBR }) : '—'}
                      </span>
                      {isInstallment && (
                        <>
                          <span className="text-[10px] text-zinc-600">•</span>
                          <span className="text-[10px] text-indigo-400">
                            {tx.installment_current}/{tx.installment_total}x
                          </span>
                        </>
                      )}
                      <span className="text-[10px] text-zinc-600">•</span>
                      <span className="text-[10px] text-zinc-500">{memberLabel(tx)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className={`text-sm font-bold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
                      {isExpense ? '-' : '+'} R$ {fmt(Number(tx.amount))}
                    </p>
                    <button
                      onClick={() => handleDelete(tx)}
                      disabled={isPending}
                      className="text-zinc-700 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
