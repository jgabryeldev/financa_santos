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
import { createCard, updateCard } from '@/actions/cards'

type CardInput = {
  id?: string
  name?: string
  credit_limit?: number
  closing_day?: number
  due_day?: number
  color?: string
}

type Props = {
  children: ReactNode
  card?: CardInput
  onSuccess?: () => void
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#f43f5e', '#14b8a6',
]

export function CardDrawer({ children, card, onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!card?.id

  const [name, setName] = useState(card?.name || '')
  const [limit, setLimit] = useState(card?.credit_limit ? Number(card.credit_limit) : 0)
  const [closingDay, setClosingDay] = useState(card?.closing_day ? String(card.closing_day) : '')
  const [dueDay, setDueDay] = useState(card?.due_day ? String(card.due_day) : '')
  const [color, setColor] = useState(card?.color || COLORS[0])

  function reset() {
    if (!isEdit) {
      setName('')
      setLimit(0)
      setClosingDay('')
      setDueDay('')
      setColor(COLORS[0])
    }
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) return setError('Informe o nome do cartão.')
    if (!limit || limit <= 0) return setError('Informe um limite válido.')
    const numClosing = parseInt(closingDay, 10)
    const numDue = parseInt(dueDay, 10)
    if (!numClosing || numClosing < 1 || numClosing > 31) return setError('Dia de fechamento inválido (1-31).')
    if (!numDue || numDue < 1 || numDue > 31) return setError('Dia de vencimento inválido (1-31).')

    startTransition(async () => {
      try {
        const payload = {
          name: name.trim(),
          credit_limit: limit,
          closing_day: numClosing,
          due_day: numDue,
          color,
        }

        const result =
          isEdit && card.id
            ? await updateCard(card.id, payload)
            : await createCard(payload)

        if (!result.success) {
          setError(result.error)
          return
        }

        reset()
        setOpen(false)
        onSuccess?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar cartão.')
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
              {isEdit ? 'Editar Cartão' : 'Novo Cartão'}
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
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Nome do cartão</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Nubank, Inter, Itaú..."
                className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Limite (R$)</label>
              <MoneyInput
                value={limit}
                onChange={setLimit}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 font-medium">Dia fechamento</label>
                <Input
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 15"
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 font-medium">Dia vencimento</label>
                <Input
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 22"
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
                />
              </div>
            </div>

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
              {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Adicionar cartão'}
            </button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
