import { getFixedFinances } from '@/actions/fixed'
import { FixedDrawer } from '@/components/FixedDrawer'
import { DeleteFixedButton } from '@/components/DeleteFixedButton'
import { Plus, TrendingDown, TrendingUp, Repeat } from 'lucide-react'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export default async function FixedPage() {
  const items = await getFixedFinances()

  const totalExpense = items.filter(i => i.type === 'expense').reduce((a, i) => a + Number(i.amount), 0)
  const totalIncome = items.filter(i => i.type === 'income').reduce((a, i) => a + Number(i.amount), 0)
  const balance = totalIncome - totalExpense

  const expenses = items.filter(i => i.type === 'expense')
  const incomes = items.filter(i => i.type === 'income')

  return (
    <main className="min-h-screen p-4 pb-32">
      {/* Header */}
      <header className="flex justify-between items-center py-4 mb-6">
        <div>
          <p className="text-zinc-500 text-sm font-medium">Recorrentes mensais</p>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Fixos</h1>
        </div>
        <FixedDrawer>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
            <Plus size={16} />
            Novo
          </button>
        </FixedDrawer>
      </header>

      {/* Resumo */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
            <TrendingUp size={14} className="text-emerald-500 mx-auto mb-1" />
            <p className="text-[10px] text-zinc-600 mb-0.5">Receitas</p>
            <p className="text-sm font-bold text-emerald-400">R$ {fmt(totalIncome)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
            <TrendingDown size={14} className="text-red-500 mx-auto mb-1" />
            <p className="text-[10px] text-zinc-600 mb-0.5">Gastos</p>
            <p className="text-sm font-bold text-red-400">R$ {fmt(totalExpense)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
            <Repeat size={14} className="text-zinc-400 mx-auto mb-1" />
            <p className="text-[10px] text-zinc-600 mb-0.5">Saldo</p>
            <p className={`text-sm font-bold ${balance >= 0 ? 'text-zinc-100' : 'text-red-400'}`}>
              R$ {fmt(balance)}
            </p>
          </div>
        </div>
      )}

      {/* Gastos Fixos */}
      {expenses.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
            <TrendingDown size={14} className="text-red-400" />
            Gastos Fixos
          </h2>
          <div className="space-y-2">
            {expenses.map((item) => (
              <FixedItem key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Receitas Fixas */}
      {incomes.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" />
            Receitas Fixas
          </h2>
          <div className="space-y-2">
            {incomes.map((item) => (
              <FixedItem key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <div className="text-center py-16">
          <Repeat size={48} className="mx-auto mb-4 text-zinc-700" />
          <p className="text-zinc-400 font-medium mb-1">Nenhum item fixo</p>
          <p className="text-zinc-600 text-sm mb-6">
            Adicione salários, aluguel, assinaturas e outros valores recorrentes.
          </p>
          <FixedDrawer>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
              Adicionar primeiro item
            </button>
          </FixedDrawer>
        </div>
      )}
    </main>
  )
}

function FixedItem({ item }: { item: Awaited<ReturnType<typeof getFixedFinances>>[number] }) {
  const isExpense = item.type === 'expense'
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: item.color + '20' }}
      >
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate">{item.description}</p>
        <p className="text-xs text-zinc-600 mt-0.5">
          {item.day ? `Todo dia ${item.day}` : 'Sem data definida'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className={`text-sm font-bold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
          {isExpense ? '-' : '+'} R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        <FixedDrawer fixed={item}>
          <button className="text-zinc-600 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-xs">
            ✎
          </button>
        </FixedDrawer>
        <DeleteFixedButton id={item.id} />
      </div>
    </div>
  )
}
