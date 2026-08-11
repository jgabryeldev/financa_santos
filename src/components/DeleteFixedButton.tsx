'use client'

import { useState, useTransition } from 'react'
import { deleteFixed } from '@/actions/fixed'
import { Trash2 } from 'lucide-react'

export function DeleteFixedButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!confirm('Excluir este item fixo?')) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteFixed(id)
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
        aria-label="Excluir item fixo"
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
