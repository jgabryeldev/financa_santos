import Link from 'next/link'
import { getCardDetail } from '@/actions/cards'
import { ChevronLeft } from 'lucide-react'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export default async function CardUpcomingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getCardDetail(id)

  if (detail.kind === 'food') {
    return (
      <main className="min-h-screen p-4 pb-32">
        <Link href={`/cards/${id}`} className="text-sm text-indigo-400">
          ← Voltar
        </Link>
        <p className="mt-8 text-zinc-500 text-sm text-center">
          Cartão alimentação não gera próximas faturas.
        </p>
      </main>
    )
  }

  const { card, upcomingByMonth, futureTotal } = detail

  return (
    <main className="min-h-screen p-4 pb-32">
      <header className="flex items-center gap-3 py-4 mb-6">
        <Link
          href={`/cards/${id}`}
          className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <p className="text-xs text-zinc-500">{card.name}</p>
          <h1 className="text-xl font-bold text-zinc-100">Próximas faturas</h1>
        </div>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 flex justify-between items-center">
        <span className="text-sm text-zinc-400">Total futuro</span>
        <span className="text-lg font-bold text-orange-400">R$ {fmt(futureTotal)}</span>
      </div>

      {upcomingByMonth.length === 0 ? (
        <p className="text-center text-zinc-600 text-sm py-12">Nenhuma parcela futura.</p>
      ) : (
        <div className="space-y-4">
          {upcomingByMonth.map((bucket) => (
            <section
              key={`${bucket.year}-${bucket.month}`}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-200">
                  {MONTHS[bucket.month - 1]} {bucket.year}
                </h2>
                <span className="text-sm font-bold text-orange-400">
                  R$ {fmt(bucket.total)}
                </span>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {bucket.items.map((tx) => (
                  <div key={tx.id} className="px-4 py-3 flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{tx.description}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Vence {tx.date.split('-').reverse().join('/')}
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
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
