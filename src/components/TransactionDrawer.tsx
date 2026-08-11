'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Plus, X, CreditCard, Wallet, Utensils } from 'lucide-react'
import { createTransaction } from '@/actions/transactions'
import { MoneyInput } from '@/components/MoneyInput'
import { localDateISO } from '@/lib/money'
import type { CardKind } from '@/lib/card-billing'

type Card = {
  id: string
  name: string
  color: string
  credit_limit: number
  kind?: CardKind
}

type Props = {
  cards: Card[]
}

type PayMethod = 'debit' | 'credit' | 'food'

export function TransactionDrawer({ cards }: Props) {
  const creditCards = useMemo(() => cards.filter((c) => (c.kind || 'credit') === 'credit'), [cards])
  const foodCards = useMemo(() => cards.filter((c) => c.kind === 'food'), [cards])

  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('debit')
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => localDateISO())
  const [selectedCardId, setSelectedCardId] = useState<string>('')
  const [installments, setInstallments] = useState('1')

  const activeCards = paymentMethod === 'food' ? foodCards : creditCards
  const isCardPay =
    type === 'expense' && (paymentMethod === 'credit' || paymentMethod === 'food')
  const isCredit = type === 'expense' && paymentMethod === 'credit'

  function reset() {
    setType('expense')
    setPaymentMethod('debit')
    setAmount(0)
    setDescription('')
    setDate(localDateISO())
    setSelectedCardId('')
    setInstallments('1')
    setError(null)
  }

  function selectMethod(m: PayMethod) {
    setPaymentMethod(m)
    const list = m === 'food' ? foodCards : m === 'credit' ? creditCards : []
    setSelectedCardId(list[0]?.id || '')
    if (m === 'food') setInstallments('1')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!amount || amount <= 0) {
      setError('Informe um valor válido.')
      return
    }
    if (!description.trim()) {
      setError('Informe uma descrição.')
      return
    }
    if (isCardPay && !selectedCardId) {
      setError(
        paymentMethod === 'food'
          ? 'Selecione um cartão alimentação.'
          : 'Selecione um cartão de crédito.'
      )
      return
    }

    startTransition(async () => {
      try {
        const result = await createTransaction({
          description: description.trim(),
          amount,
          type,
          date,
          creditCardId: isCardPay ? selectedCardId : null,
          installments: isCredit ? parseInt(installments, 10) : 1,
        })
        if (!result.success) {
          setError(result.error)
          return
        }
        reset()
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar transação.')
      }
    })
  }

  const methods = [
    { value: 'debit' as const, label: 'Débito', icon: Wallet },
    { value: 'credit' as const, label: 'Crédito', icon: CreditCard },
    { value: 'food' as const, label: 'Alimentação', icon: Utensils },
  ]

  return (
    <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }} showSwipeHandle>
      <DrawerTrigger
        render={
          <button
            aria-label="Nova transação"
            className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg shadow-indigo-500/30 bg-indigo-600 hover:bg-indigo-700 active:scale-95 z-50 flex items-center justify-center transition-all duration-200"
          >
            <Plus className="h-6 w-6 text-white" />
          </button>
        }
      />

      <DrawerContent className="bg-zinc-900 border-zinc-800">
        <div className="mx-auto w-full max-w-sm pb-8">
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <DrawerTitle className="text-lg font-semibold text-zinc-100">
              Nova Transação
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
                  {t === 'expense' ? 'Despesa' : 'Receita'}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg font-medium z-10">
                R$
              </span>
              <MoneyInput
                value={amount}
                onChange={setAmount}
                autoFocus
                className="text-3xl h-16 bg-transparent border-zinc-800 text-zinc-100 text-center focus-visible:ring-indigo-500/50 pl-10"
              />
            </div>

            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (ex: Mercado, Salário...)"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
            />

            <Input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              type="date"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
            />

            {type === 'expense' && (
              <div className="flex gap-1 p-1 bg-zinc-950 rounded-xl">
                {methods.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => selectMethod(value)}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                      paymentMethod === value
                        ? value === 'food'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-indigo-500/15 text-indigo-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {isCardPay && (
              <>
                {activeCards.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-2">
                    Nenhum cartão de {paymentMethod === 'food' ? 'alimentação' : 'crédito'}. Cadastre em{' '}
                    <span className="text-indigo-400">Cartões</span>.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 font-medium">Cartão</p>
                    <div className="grid grid-cols-1 gap-2">
                      {activeCards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setSelectedCardId(card.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            selectedCardId === card.id
                              ? 'border-indigo-500 bg-indigo-500/10'
                              : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: card.color }}
                          />
                          <span className="text-sm text-zinc-200 flex-1">{card.name}</span>
                          {selectedCardId === card.id && (
                            <div className="w-2 h-2 rounded-full bg-indigo-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isCredit && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 font-medium">Parcelas</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setInstallments(String(n))}
                          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                            installments === String(n)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-zinc-950 text-zinc-400 hover:bg-zinc-800'
                          }`}
                        >
                          {n}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={isPending || (isCardPay && activeCards.length === 0)}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base rounded-xl transition-all duration-200 mt-2"
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
