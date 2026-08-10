'use client'

import { useTransition } from 'react'
import { deleteCard } from '@/actions/cards'
import { Trash2 } from 'lucide-react'

export function DeleteCardButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('Excluir este cartão? As transações vinculadas serão desvinculadas.')) return
    startTransition(async () => {
      await deleteCard(id)
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-zinc-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40"
      aria-label="Excluir cartão"
    >
      <Trash2 size={14} />
    </button>
  )
}
