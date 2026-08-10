'use client'

import { useState, useTransition } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Plus, X, CreditCard, Wallet } from 'lucide-react'
import { createTransaction } from '@/actions/transactions'

type Card = {
  id: string
  name: string
  color: string
  credit_limit: number
}

type Props = {
  cards: Card[]
}

const PAYMENT_METHODS = [
  { value: 'debit', label: 'Débito', icon: Wallet },
  { value: 'credit', label: 'Crédito', icon: CreditCard },
] as const

export function TransactionDrawer({ cards }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [paymentMethod, setPaymentMethod] = useState<'debit' | 'credit'>('debit')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedCardId, setSelectedCardId] = useState<string>(cards[0]?.id || '')
  const [installments, setInstallments] = useState('1')

  function reset() {
    setType('expense')
    setPaymentMethod('debit')
    setAmount('')
    setDescription('')
    setDate(new Date().toISOString().split('T')[0])
    setSelectedCardId(cards[0]?.id || '')
    setInstallments('1')
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const numAmount = parseFloat(amount.replace(',', '.'))
    if (!numAmount || numAmount <= 0) {
      setError('Informe um valor válido.')
      return
    }
    if (!description.trim()) {
      setError('Informe uma descrição.')
      return
    }
    if (isCredit && !selectedCardId) {
      setError('Selecione um cartão de crédito.')
      return
    }

    startTransition(async () => {
      try {
        await createTransaction({
          description: description.trim(),
          amount: numAmount,
          type,
          date,
          creditCardId: isCredit ? selectedCardId : null,
          installments: isCredit ? parseInt(installments) : 1,
        })
        reset()
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar transação.')
      }
    })
  }

  const isCredit = paymentMethod === 'credit' && type === 'expense'

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
          {/* Header */}
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
            {/* Tipo: Despesa / Receita */}
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

            {/* Valor */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg font-medium">
                R$
              </span>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                autoFocus
                className="text-3xl h-16 bg-transparent border-zinc-800 text-zinc-100 text-center focus-visible:ring-indigo-500/50 pl-10"
              />
            </div>

            {/* Descrição */}
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (ex: Mercado, Salário...)"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
            />

            {/* Data */}
            <Input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              type="date"
              className="bg-zinc-950 border-zinc-800 text-zinc-100 h-12 focus-visible:ring-indigo-500/50"
            />

            {/* Método de pagamento (só para despesas) */}
            {type === 'expense' && (
              <div className="flex gap-2 p-1 bg-zinc-950 rounded-xl">
                {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentMethod(value)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                      paymentMethod === value
                        ? 'bg-indigo-500/15 text-indigo-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Cartão e parcelas — apenas crédito + despesa */}
            {isCredit && (
              <>
                {cards.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-2">
                    Nenhum cartão cadastrado. Acesse a aba{' '}
                    <span className="text-indigo-400">Cartões</span> para adicionar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 font-medium">Cartão</p>
                    <div className="grid grid-cols-1 gap-2">
                      {cards.map((card) => (
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

                {/* Parcelas */}
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
              </>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={isPending || (isCredit && cards.length === 0)}
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
