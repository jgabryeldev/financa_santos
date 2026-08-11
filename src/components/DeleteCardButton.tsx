'use client'

import { useState, useTransition } from 'react'
import { deleteCard } from '@/actions/cards'
import { Trash2 } from 'lucide-react'

export function DeleteCardButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm('Excluir este cartão? As transações vinculadas serão desvinculadas.')) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteCard(id)
        if (!result.success) setError(result.error)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao excluir.')
      }
    })
  }

  return (
    <div className="relative">
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-zinc-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40"
        aria-label="Excluir cartão"
        title={error || undefined}
      >
        <Trash2 size={14} />
      </button>
      {error && (
        <p className="absolute right-0 top-full mt-1 z-10 w-48 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  )
}
