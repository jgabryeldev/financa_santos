'use client'

import { isValidElement, useState, useTransition, type ReactNode } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/MoneyInput'
import { X } from 'lucide-react'
import { createPotWithApply, applyToPot } from '@/actions/investments'
import { localDateISO } from '@/lib/money'

type Props = {
  children: ReactNode
  /** Se informado, é aporte em cofrinho existente */
  potId?: string
  potName?: string
}

const COLORS = [
  '#10b981', '#6366f1', '#8b5cf6', '#ec4899',
  '#f59e0b', '#3b82f6', '#f43f5e', '#14b8a6',
]

export function InvestmentDrawer({ children, potId, potName }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isApplyOnly = !!potId

  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [cdiPercent, setCdiPercent] = useState('102')
  const [liquidity, setLiquidity] = useState<'daily' | 'dated'>('daily')
  const [unlockDate, setUnlockDate] = useState('')
  const [color, setColor] = useState(COLORS[0])

  function reset() {
    if (!isApplyOnly) {
      setName('')
      setCdiPercent('102')
      setLiquidity('daily')
      setUnlockDate('')
      setColor(COLORS[0])
    }
    setAmount(0)
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!amount || amount <= 0) return setError('Informe um valor válido.')

    if (isApplyOnly && potId) {
      startTransition(async () => {
        try {
          const result = await applyToPot(potId, amount)
          if (!result.success) {
            setError(result.error)
            return
          }
          reset()
          setOpen(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao aplicar.')
        }
      })
      return
    }

    if (!name.trim()) return setError('Informe o nome do cofrinho.')
    const pct = parseFloat(cdiPercent.replace(',', '.'))
    if (!pct || pct < 1 || pct > 300) return setError('CDI inválido (1–300%).')
    if (liquidity === 'dated' && !unlockDate) {
      return setError('Informe a data de liberação.')
    }

    startTransition(async () => {
      try {
        const result = await createPotWithApply({
          name: name.trim(),
          initialAmount: amount,
          cdiPercent: pct,
          liquidity,
          unlockDate: liquidity === 'dated' ? unlockDate : null,
          color,
        })
        if (!result.success) {
          setError(result.error)
          return
        }
        reset()
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao criar cofrinho.')
      }
    })
  }

  return (
    <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }} showSwipeHandle>
      <DrawerTrigger
        render={isValidElement(children) ? children : <button type="button">{children}</button>}
      />

      <DrawerContent className="bg-zinc-900 border-zinc-800">
        <div className="mx-auto w-full max-w-sm pb-8">
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <DrawerTitle className="text-lg font-semibold text-zinc-100">
              {isApplyOnly ? `Aplicar em ${potName || 'cofrinho'}` : 'Novo cofrinho'}
            </DrawerTitle>
            <DrawerClose
              render={
                <button className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800">
                  <X size={18} />
                </button>
              }
            />
          </div>

          <form onSubmit={handleSubmit} className="px-6 space-y-4">
            {!isApplyOnly && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-500 font-medium">Nome</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Reserva, Viagem, Emergência..."
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-500 font-medium">% do CDI</label>
                  <Input
                    value={cdiPercent}
                    onChange={(e) => setCdiPercent(e.target.value)}
                    type="text"
                    inputMode="decimal"
                    placeholder="102"
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
                  />
                </div>

                <div className="flex gap-2 p-1 bg-zinc-950 rounded-xl">
                  {([
                    { value: 'daily' as const, label: 'Resgate diário' },
                    { value: 'dated' as const, label: 'Com data' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLiquidity(opt.value)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        liquidity === opt.value
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {liquidity === 'dated' && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-500 font-medium">Liberação em</label>
                    <Input
                      type="date"
                      value={unlockDate}
                      min={localDateISO()}
                      onChange={(e) => setUnlockDate(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 font-medium">Cor</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 rounded-full transition-all ${
                          color === c
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">
                {isApplyOnly ? 'Valor do aporte (R$)' : 'Valor inicial (R$)'}
              </label>
              <MoneyInput
                value={amount}
                onChange={setAmount}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
              />
              <p className="text-[10px] text-zinc-600">
                Sai da Conta Corrente e do Saldo Real Disponível.
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-base rounded-xl transition-all duration-200 mt-2"
            >
              {isPending ? 'Salvando...' : isApplyOnly ? 'Aplicar' : 'Criar e aplicar'}
            </button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
