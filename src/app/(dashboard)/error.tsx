'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  const message =
    error.message && !error.message.includes('omitted in production')
      ? error.message
      : 'Algo deu errado ao carregar esta página.'

  return (
    <main className="min-h-screen p-6 pb-32 flex flex-col items-center justify-center text-center">
      <p className="text-zinc-500 text-sm font-medium mb-2">Erro</p>
      <h1 className="text-xl font-bold text-zinc-100 mb-3">Não foi possível carregar</h1>
      <p className="text-sm text-zinc-400 max-w-sm mb-6">{message}</p>
      {/column .+ does not exist|supabase_migrate/i.test(message) && (
        <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 max-w-sm mb-6 text-left">
          O banco parece desatualizado. Abra o SQL Editor do Supabase e execute o arquivo{' '}
          <code className="text-amber-300">supabase_migrate.sql</code> do projeto.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          Tentar de novo
        </button>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          Ir ao início
        </button>
      </div>
    </main>
  )
}
