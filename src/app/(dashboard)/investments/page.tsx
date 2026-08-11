import { listPotsWithBalances } from '@/actions/investments'
import { InvestmentDrawer } from '@/components/InvestmentDrawer'
import { RedeemDrawer } from '@/components/RedeemDrawer'
import { PiggyBank, Plus, Lock, Unlock } from 'lucide-react'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function formatDate(iso: string) {
  return iso.split('-').reverse().join('/')
}

export default async function InvestmentsPage() {
  let pots: Awaited<ReturnType<typeof listPotsWithBalances>> = []
  let loadError: string | null = null

  try {
    pots = await listPotsWithBalances()
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Erro ao carregar investimentos.'
  }

  const totalCurrent = pots.reduce((a, p) => a + p.currentAmount, 0)
  const totalPrincipal = pots.reduce((a, p) => a + p.principal, 0)
  const totalYield = totalCurrent - totalPrincipal

  return (
    <main className="min-h-screen p-4 pb-32">
      <header className="flex justify-between items-center py-4 mb-6">
        <div>
          <p className="text-zinc-500 text-sm font-medium">Cofrinhos % CDI</p>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Investimentos</h1>
        </div>
        <InvestmentDrawer>
          <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
            <Plus size={16} />
            Novo
          </button>
        </InvestmentDrawer>
      </header>

      {loadError && (
        <div className="mb-6 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
          {loadError}
        </div>
      )}

      {pots.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 rounded-3xl p-5 mb-6 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
          <p className="text-emerald-200 text-sm font-medium mb-1 relative z-10">Total investido</p>
          <p className="text-3xl font-bold text-white tracking-tight mb-3 relative z-10">
            R$ {fmt(totalCurrent)}
          </p>
          <div className="flex gap-4 relative z-10 text-xs text-emerald-100">
            <span>
              Principal: <strong className="text-white">R$ {fmt(totalPrincipal)}</strong>
            </span>
            <span>
              Rendimento: <strong className="text-white">R$ {fmt(totalYield)}</strong>
            </span>
          </div>
        </div>
      )}

      {pots.length === 0 && !loadError ? (
        <div className="text-center py-16">
          <PiggyBank size={48} className="mx-auto mb-4 text-zinc-700" />
          <p className="text-zinc-400 font-medium mb-1">Nenhum cofrinho</p>
          <p className="text-zinc-600 text-sm mb-6">
            Guarde dinheiro com rendimento estimado em % do CDI.
          </p>
          <InvestmentDrawer>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
              Criar primeiro cofrinho
            </button>
          </InvestmentDrawer>
        </div>
      ) : (
        <div className="space-y-3">
          {pots.map((pot) => (
            <div
              key={pot.id}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 relative overflow-hidden"
            >
              <div
                className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-6 translate-x-6"
                style={{ backgroundColor: pot.color }}
              />

              <div className="flex items-start justify-between mb-3 relative">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: pot.color + '25' }}
                  >
                    <PiggyBank size={18} style={{ color: pot.color }} />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-100">{pot.name}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                      {pot.cdi_percent}% CDI ·{' '}
                      {pot.liquidity === 'daily' ? (
                        <span className="inline-flex items-center gap-1">
                          <Unlock size={10} /> Diário
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Lock size={10} /> Até {pot.unlock_date ? formatDate(pot.unlock_date) : '—'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold text-zinc-100">R$ {fmt(pot.currentAmount)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                <div>
                  <p className="text-zinc-600 mb-0.5">Principal</p>
                  <p className="text-zinc-300 font-medium">R$ {fmt(pot.principal)}</p>
                </div>
                <div>
                  <p className="text-zinc-600 mb-0.5">Rendimento</p>
                  <p className="text-emerald-400 font-medium">+ R$ {fmt(pot.yieldAmount)}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <InvestmentDrawer potId={pot.id} potName={pot.name}>
                  <button className="flex-1 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-300 hover:border-zinc-700 transition-colors">
                    Aplicar
                  </button>
                </InvestmentDrawer>
                <RedeemDrawer
                  potId={pot.id}
                  potName={pot.name}
                  maxAmount={pot.currentAmount}
                  principal={pot.principal}
                  earliestApplyDate={pot.earliestApplyDate}
                  canRedeem={pot.canRedeem}
                  lockedUntil={pot.unlock_date}
                >
                  <button
                    disabled={!pot.canRedeem}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-sm text-indigo-300 hover:bg-indigo-600/30 transition-colors disabled:opacity-40"
                  >
                    Resgatar
                  </button>
                </RedeemDrawer>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
