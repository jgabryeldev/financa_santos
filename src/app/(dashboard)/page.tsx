import { getDashboardBalances, getTransactions } from '@/actions/transactions'
import { getCards } from '@/actions/transactions'
import { TransactionDrawer } from '@/components/TransactionDrawer'
import { Wallet, TrendingDown, CreditCard, TrendingUp, ArrowUpRight, ArrowDownLeft, PiggyBank } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function DashboardPage() {
  const [
    {
      balanceDebit,
      realBalance,
      cards,
      fixedExpensesCurrentMonth,
      fixedIncomeCurrentMonth,
      creditCardExpensesCurrentMonth,
      investedCurrent,
      investedYield,
    },
    transactions,
    allCards,
  ] = await Promise.all([
    getDashboardBalances(),
    getTransactions(),
    getCards(),
  ])

  const availableCredit = cards.reduce((acc, c) => acc + c.available, 0)
  const recentTransactions = transactions.slice(0, 10)

  return (
    <main className="min-h-screen p-4 pb-32">
      {/* Header */}
      <header className="flex justify-between items-center py-4 mb-6">
        <div>
          <p className="text-zinc-500 text-sm font-medium">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Finanças</h1>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Wallet size={18} className="text-white" />
        </div>
      </header>

      {/* Saldo Principal */}
      <section className="space-y-3 mb-6">
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-6 shadow-2xl shadow-indigo-900/30 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute -bottom-12 -left-6 w-32 h-32 bg-white/5 rounded-full" />

          <p className="text-indigo-200 text-sm font-medium mb-1 relative z-10">Saldo Real Disponível</p>
          <p className={`text-4xl font-bold tracking-tight mb-3 relative z-10 ${realBalance < 0 ? 'text-red-300' : 'text-white'}`}>
            R$ {fmt(realBalance)}
          </p>
          <div className="flex flex-wrap gap-4 relative z-10">
            {fixedIncomeCurrentMonth > 0 && (
              <div className="flex items-center gap-1.5">
                <TrendingUp size={12} className="text-indigo-300" />
                <span className="text-xs text-indigo-200">
                  Receitas fixas: <strong className="text-white">R$ {fmt(fixedIncomeCurrentMonth)}</strong>
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <TrendingDown size={12} className="text-indigo-300" />
              <span className="text-xs text-indigo-200">
                Fixos: <strong className="text-white">R$ {fmt(fixedExpensesCurrentMonth)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CreditCard size={12} className="text-indigo-300" />
              <span className="text-xs text-indigo-200">
                Fatura: <strong className="text-white">R$ {fmt(creditCardExpensesCurrentMonth)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Cards secundários */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-emerald-500/10 w-9 h-9 rounded-xl flex items-center justify-center text-emerald-500">
                <Wallet size={18} />
              </div>
              <TrendingUp size={14} className="text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-xs font-medium mb-0.5">Conta Corrente</p>
            <p className={`text-lg font-bold ${balanceDebit < 0 ? 'text-red-400' : 'text-zinc-100'}`}>
              R$ {fmt(balanceDebit)}
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-500/10 w-9 h-9 rounded-xl flex items-center justify-center text-blue-500">
                <CreditCard size={18} />
              </div>
              <TrendingDown size={14} className="text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-xs font-medium mb-0.5">Crédito Livre</p>
            <p className={`text-lg font-bold ${availableCredit < 0 ? 'text-red-400' : 'text-zinc-100'}`}>
              R$ {fmt(availableCredit)}
            </p>
          </div>
        </div>

        <Link
          href="/investments"
          className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-emerald-500/40 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-500/10 w-9 h-9 rounded-xl flex items-center justify-center text-emerald-500">
                <PiggyBank size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">Investimentos</p>
                <p className="text-[10px] text-zinc-500">Cofrinhos % CDI</p>
              </div>
            </div>
            <p className="text-lg font-bold text-zinc-100">
              R$ {fmt(investedCurrent || 0)}
            </p>
          </div>
          {(investedYield || 0) > 0 && (
            <p className="text-xs text-emerald-400">
              Rendimento: + R$ {fmt(investedYield)}
            </p>
          )}
        </Link>

        {/* Resumo por cartão */}
        {cards.length > 0 && (
          <div className="space-y-2">
            {cards.map((card) => (
              <Link
                key={card.id}
                href={`/cards/${card.id}`}
                className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color }} />
                    <span className="text-sm font-medium text-zinc-200">{card.name}</span>
                    {'kind' in card && card.kind === 'food' && (
                      <span className="text-[9px] text-amber-400/80 uppercase tracking-wide">VR</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    R$ {fmt(card.available)} livre
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${card.limit > 0 ? Math.min(100, (card.used / card.limit) * 100) : 0}%`,
                      backgroundColor: card.color,
                      opacity: 0.8,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-zinc-600">
                    Usado: R$ {fmt(card.used)}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    Limite: R$ {fmt(card.limit)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Transações Recentes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-zinc-100 font-semibold text-base">Transações Recentes</h2>
          <span className="text-xs text-zinc-600">{recentTransactions.length} itens</span>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-12 text-zinc-600">
            <Wallet size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma transação ainda.</p>
            <p className="text-xs mt-1">Toque no + para adicionar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx) => {
              const isExpense = tx.type === 'expense'
              const isInstallment = tx.installment_total > 1

              return (
                <div
                  key={tx.id}
                  className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4 flex items-center gap-3"
                >
                  {/* Ícone */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isExpense ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {isExpense ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {tx.credit_cards ? (
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: tx.credit_cards.color }}
                          />
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
                    </div>
                  </div>

                  {/* Valor */}
                  <p className={`text-sm font-bold flex-shrink-0 ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
                    {isExpense ? '-' : '+'} R$ {fmt(tx.amount)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <TransactionDrawer cards={allCards.map(c => ({ id: c.id, name: c.name, color: c.color, credit_limit: Number(c.credit_limit), kind: c.kind === 'food' ? 'food' : 'credit' }))} />
    </main>
  )
}
