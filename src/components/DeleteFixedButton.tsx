'use client'

import { useTransition } from 'react'
import { deleteFixed } from '@/actions/fixed'
import { Trash2 } from 'lucide-react'

export function DeleteFixedButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('Excluir este item fixo?')) return
    startTransition(async () => {
      await deleteFixed(id)
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-zinc-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40"
      aria-label="Excluir item fixo"
    >
      <Trash2 size={14} />
    </button>
  )
}
