import { getCards } from '@/actions/transactions'
import { getDashboardBalances } from '@/actions/transactions'
import { CardDrawer } from '@/components/CardDrawer'
import { DeleteCardButton } from '@/components/DeleteCardButton'
import { CreditCard, Plus, TrendingDown, Utensils } from 'lucide-react'
import Link from 'next/link'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export default async function CardsPage() {
  const [cards, { cards: cardsWithLimits }] = await Promise.all([
    getCards(),
    getDashboardBalances(),
  ])

  const totalLimit = cardsWithLimits.reduce((a, c) => a + c.limit, 0)
  const totalUsed = cardsWithLimits.reduce((a, c) => a + c.used, 0)
  const totalAvailable = totalLimit - totalUsed

  return (
    <main className="min-h-screen p-4 pb-32">
      {/* Header */}
      <header className="flex justify-between items-center py-4 mb-6">
        <div>
          <p className="text-zinc-500 text-sm font-medium">Seus cartões</p>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Cartões</h1>
        </div>
        <CardDrawer>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
            <Plus size={16} />
            Novo
          </button>
        </CardDrawer>
      </header>

      {/* Resumo total */}
      {cards.length > 0 && (
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-3xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={16} className="text-zinc-500" />
            <span className="text-xs text-zinc-500 font-medium">Total de todos os cartões</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-[10px] text-zinc-600 mb-0.5">Limite Total</p>
              <p className="text-base font-bold text-zinc-100">R$ {fmt(totalLimit)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 mb-0.5">Usado</p>
              <p className="text-base font-bold text-red-400">R$ {fmt(totalUsed)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 mb-0.5">Disponível</p>
              <p className="text-base font-bold text-emerald-400">R$ {fmt(totalAvailable)}</p>
            </div>
          </div>
          {/* Barra geral */}
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: totalLimit > 0 ? `${Math.min(100, (totalUsed / totalLimit) * 100)}%` : '0%' }}
            />
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5 text-right">
            {totalLimit > 0 ? `${((totalUsed / totalLimit) * 100).toFixed(0)}% utilizado` : '0% utilizado'}
          </p>
        </div>
      )}

      {/* Lista de cartões */}
      {cards.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard size={48} className="mx-auto mb-4 text-zinc-700" />
          <p className="text-zinc-400 font-medium mb-1">Nenhum cartão cadastrado</p>
          <p className="text-zinc-600 text-sm mb-6">Adicione seus cartões de crédito para controlar os limites.</p>
          <CardDrawer>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
              Adicionar primeiro cartão
            </button>
          </CardDrawer>
        </div>
      ) : (
        <div className="space-y-3">
          {cardsWithLimits.map((card) => {
            const percent = card.limit > 0 ? (card.used / card.limit) * 100 : 0
            const isHigh = percent > 70
            const full = cards.find((c) => c.id === card.id)
            const isFood = (card as { kind?: string }).kind === 'food' || full?.kind === 'food'

            return (
              <div
                key={card.id}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 relative overflow-hidden"
              >
                <div
                  className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-6 translate-x-6"
                  style={{ backgroundColor: card.color }}
                />

                <div className="flex items-start justify-between mb-4 relative">
                  <Link href={`/cards/${card.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: card.color + '20', border: `1px solid ${card.color}40` }}
                    >
                      {isFood ? (
                        <Utensils size={18} style={{ color: card.color }} />
                      ) : (
                        <CreditCard size={18} style={{ color: card.color }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-100 truncate">{card.name}</p>
                      <p className="text-xs text-zinc-500">
                        {isFood ? (
                          <>Alimentação · Recarga dia {card.closing_day}</>
                        ) : (
                          <>Fecha dia {card.closing_day} • Vence dia {card.due_day}</>
                        )}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <CardDrawer card={full}>
                      <button className="text-zinc-600 hover:text-zinc-300 text-xs px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors">
                        Editar
                      </button>
                    </CardDrawer>
                    <DeleteCardButton id={card.id} />
                  </div>
                </div>

                <Link href={`/cards/${card.id}`} className="block">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <p className="text-[10px] text-zinc-600 mb-0.5">Limite</p>
                      <p className="text-sm font-bold text-zinc-200">R$ {fmt(card.limit)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600 mb-0.5">
                        {isFood ? 'Usado' : 'Fatura'}
                      </p>
                      <p className={`text-sm font-bold ${card.used > 0 ? 'text-red-400' : 'text-zinc-200'}`}>
                        R$ {fmt(card.used)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600 mb-0.5">Disponível</p>
                      <p className={`text-sm font-bold ${card.available < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        R$ {fmt(card.available)}
                      </p>
                    </div>
                  </div>

                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, percent)}%`,
                        backgroundColor: isHigh ? '#f43f5e' : card.color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1.5">
                    <span className="text-[10px] text-zinc-600">
                      {percent.toFixed(0)}% utilizado
                    </span>
                    {isHigh && (
                      <span className="text-[10px] text-red-400 flex items-center gap-1">
                        <TrendingDown size={10} />
                        Limite alto
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
