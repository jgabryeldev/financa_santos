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
import { X } from 'lucide-react'
import { createFixed, updateFixed } from '@/actions/fixed'
import type { FixedFinance } from '@/actions/fixed'

type Props = {
  children: ReactNode
  fixed?: FixedFinance
  onSuccess?: () => void
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#f43f5e', '#14b8a6',
]

export function FixedDrawer({ children, fixed, onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!fixed?.id

  const [type, setType] = useState<'income' | 'expense'>(fixed?.type || 'expense')
  const [description, setDescription] = useState(fixed?.description || '')
  const [amount, setAmount] = useState(fixed?.amount ? String(fixed.amount) : '')
  const [day, setDay] = useState(fixed?.day ? String(fixed.day) : '')
  const [color, setColor] = useState(fixed?.color || COLORS[0])

  function reset() {
    if (!isEdit) {
      setType('expense')
      setDescription('')
      setAmount('')
      setDay('')
      setColor(COLORS[0])
    }
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const numAmount = parseFloat(amount.replace(',', '.'))
    if (!description.trim()) return setError('Informe uma descrição.')
    if (!numAmount || numAmount <= 0) return setError('Informe um valor válido.')

    startTransition(async () => {
      try {
        const payload = {
          description: description.trim(),
          amount: numAmount,
          type,
          day: day ? parseInt(day) : null,
          color,
        }

        if (isEdit && fixed.id) {
          await updateFixed(fixed.id, payload)
        } else {
          await createFixed(payload)
        }

        reset()
        setOpen(false)
        onSuccess?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar.')
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
              {isEdit ? 'Editar item fixo' : 'Novo item fixo'}
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
            {/* Tipo */}
            <div className="flex gap-2 p-1 bg-zinc-950 rounded-xl">
              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    type === t
                      ? t === 'expense'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-emerald-500/15 text-emerald-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t === 'expense' ? 'Gasto Fixo' : 'Receita Fixa'}
                </button>
              ))}
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Descrição</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Aluguel, Netflix, Salário..."
                className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
              />
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Valor mensal (R$)</label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
              />
            </div>

            {/* Dia de vencimento (opcional) */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">
                Dia do mês (opcional)
              </label>
              <Input
                value={day}
                onChange={(e) => setDay(e.target.value)}
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 5"
                className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
              />
            </div>

            {/* Cor */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 font-medium">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-base rounded-xl transition-all duration-200 mt-2"
            >
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Adicionar'}
            </button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
