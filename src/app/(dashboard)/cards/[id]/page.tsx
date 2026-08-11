import Link from 'next/link'
import { getCardDetail } from '@/actions/cards'
import { ChevronLeft, ChevronRight, CreditCard, Utensils } from 'lucide-react'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getCardDetail(id)
  const { card, kind, split, currentInvoice, futureTotal } = detail
  const isFood = kind === 'food'

  return (
    <main className="min-h-screen p-4 pb-32">
      <header className="flex items-center gap-3 py-4 mb-6">
        <Link
          href="/cards"
          className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200"
        >
          <ChevronLeft size={20} />
        </Link>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: card.color + '25', border: `1px solid ${card.color}40` }}
        >
          {isFood ? (
            <Utensils size={18} style={{ color: card.color }} />
          ) : (
            <CreditCard size={18} style={{ color: card.color }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-100 truncate">{card.name}</h1>
          <p className="text-xs text-zinc-500">
            {isFood ? 'Alimentação' : 'Crédito'} · Limite R$ {fmt(detail.limit)}
          </p>
        </div>
      </header>

      {/* Barra vertical + métricas (inspirado no app bancário) */}
      <section className="flex gap-4 mb-8">
        <div className="w-3 rounded-full overflow-hidden bg-zinc-800 flex flex-col-reverse h-48 shrink-0">
          {!isFood && split.futurePct > 0 && (
            <div
              className="w-full bg-orange-500 transition-all"
              style={{ height: `${Math.max(4, split.futurePct)}%` }}
            />
          )}
          <div
            className={`w-full transition-all ${isFood ? 'bg-amber-500' : 'bg-sky-500'}`}
            style={{ height: `${Math.max(split.current > 0 ? 4 : 0, split.currentPct)}%` }}
          />
          <div
            className="w-full bg-emerald-500 transition-all"
            style={{ height: `${Math.max(4, split.availablePct)}%` }}
          />
        </div>

        <div className="flex-1 flex flex-col justify-between py-1">
          <Link
            href={`/cards/${id}#disponivel`}
            className="group flex items-center justify-between py-2"
          >
            <div>
              <p className="text-xs text-zinc-500">Limite disponível</p>
              <p className="text-lg font-bold text-emerald-400">R$ {fmt(split.available)}</p>
            </div>
            <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400" />
          </Link>

          <Link
            href={`/cards/${id}#atual`}
            className="group flex items-center justify-between py-2 border-y border-zinc-800/80"
          >
            <div>
              <p className="text-xs text-zinc-500">
                {isFood ? 'Usado neste ciclo' : 'Fatura atual'}
              </p>
              <p className={`text-lg font-bold ${isFood ? 'text-amber-400' : 'text-sky-400'}`}>
                R$ {fmt(split.current)}
              </p>
            </div>
            <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400" />
          </Link>

          {isFood ? (
            <div className="py-2">
              <p className="text-xs text-zinc-500">Renovação</p>
              <p className="text-sm font-medium text-zinc-300">
                Todo dia {card.closing_day} · sem fatura a pagar
              </p>
            </div>
          ) : (
            <Link
              href={`/cards/${id}/upcoming`}
              className="group flex items-center justify-between py-2"
            >
              <div>
                <p className="text-xs text-zinc-500">Próximas faturas</p>
                <p className="text-lg font-bold text-orange-400">R$ {fmt(futureTotal)}</p>
              </div>
              <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400" />
            </Link>
          )}
        </div>
      </section>

      {/* Lista fatura atual / uso do ciclo */}
      <section id="atual" className="scroll-mt-4">
        <h2 className="text-sm font-semibold text-zinc-400 mb-3">
          {isFood ? 'Gastos neste ciclo' : 'Itens da fatura atual'}
        </h2>
        {currentInvoice.items.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-8">Nenhum lançamento.</p>
        ) : (
          <div className="space-y-2">
            {currentInvoice.items.map((tx) => (
              <div
                key={tx.id}
                className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4 flex justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{tx.description}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {tx.date.split('-').reverse().join('/')}
                    {tx.installment_total && tx.installment_total > 1
                      ? ` · ${tx.installment_current}/${tx.installment_total}x`
                      : ''}
                  </p>
                </div>
                <p className="text-sm font-bold text-red-400 shrink-0">
                  − R$ {fmt(Number(tx.amount))}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {!isFood && futureTotal > 0 && (
        <div className="mt-6">
          <Link
            href={`/cards/${id}/upcoming`}
            className="block text-center text-sm text-orange-400 hover:text-orange-300 py-3"
          >
            Ver próximas faturas por mês →
          </Link>
        </div>
      )}
    </main>
  )
}
