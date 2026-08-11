'use client'

import { isValidElement, useMemo, useState, useTransition, type ReactNode } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '@/components/ui/drawer'
import { MoneyInput } from '@/components/MoneyInput'
import { X } from 'lucide-react'
import { redeemFromPot } from '@/actions/investments'
import { daysBetween, estimateIR, irRateForDays } from '@/lib/cdi'
import { localDateISO } from '@/lib/money'

type Props = {
  children: ReactNode
  potId: string
  potName: string
  maxAmount: number
  principal: number
  earliestApplyDate: string | null
  canRedeem: boolean
  lockedUntil?: string | null
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export function RedeemDrawer({
  children,
  potId,
  potName,
  maxAmount,
  principal,
  earliestApplyDate,
  canRedeem,
  lockedUntil,
}: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [amount, setAmount] = useState(0)

  const preview = useMemo(() => {
    if (!amount || amount <= 0 || maxAmount <= 0) {
      return { yieldPart: 0, ir: 0, net: 0, rate: 0.225 }
    }
    const ratio = Math.min(1, amount / maxAmount)
    const yieldPart = (maxAmount - principal) * ratio
    const held = daysBetween(earliestApplyDate || localDateISO(), localDateISO())
    const rate = irRateForDays(held)
    const ir = estimateIR(yieldPart, held)
    return { yieldPart, ir, net: amount - ir, rate }
  }, [amount, maxAmount, principal, earliestApplyDate])

  function reset() {
    setAmount(0)
    setError(null)
    setSuccess(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!canRedeem) {
      return setError(
        lockedUntil
          ? `Resgate bloqueado até ${lockedUntil.split('-').reverse().join('/')}.`
          : 'Resgate indisponível.'
      )
    }
    if (!amount || amount <= 0) return setError('Informe um valor válido.')
    if (amount > maxAmount + 0.009) return setError('Valor maior que o saldo.')

    startTransition(async () => {
      try {
        const result = await redeemFromPot(potId, amount)
        if (!result.success) {
          setError(result.error)
          return
        }
        setSuccess(
          `Resgatado R$ ${fmt(amount)}. IR est. R$ ${fmt(result.irEstimate || 0)} → líquido ~R$ ${fmt(result.netEstimate || amount)}.`
        )
        setAmount(0)
        setTimeout(() => {
          setOpen(false)
          reset()
        }, 1600)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao resgatar.')
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
              Resgatar — {potName}
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
            <p className="text-xs text-zinc-500">
              Disponível: <strong className="text-zinc-200">R$ {fmt(maxAmount)}</strong>
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Valor (R$)</label>
              <MoneyInput
                value={amount}
                onChange={setAmount}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
              />
              <button
                type="button"
                onClick={() => setAmount(maxAmount)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                Resgatar tudo
              </button>
            </div>

            {amount > 0 && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-1 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Rendimento nesta parcela</span>
                  <span className="text-emerald-400">R$ {fmt(preview.yieldPart)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>IR est. ({(preview.rate * 100).toFixed(1)}%)</span>
                  <span className="text-amber-400">− R$ {fmt(preview.ir)}</span>
                </div>
                <div className="flex justify-between text-zinc-200 font-medium pt-1 border-t border-zinc-800">
                  <span>Líquido estimado</span>
                  <span>R$ {fmt(preview.net)}</span>
                </div>
                <p className="text-[10px] text-zinc-600 pt-1">
                  Estimativa. IOF (&lt;30 dias) não incluso. O valor bruto volta para a Conta Corrente.
                </p>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl">{error}</p>
            )}
            {success && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl">{success}</p>
            )}

            <button
              type="submit"
              disabled={isPending || !canRedeem}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-base rounded-xl transition-all duration-200 mt-2"
            >
              {isPending ? 'Resgatando...' : 'Confirmar resgate'}
            </button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
