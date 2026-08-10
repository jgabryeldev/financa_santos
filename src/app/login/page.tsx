import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wallet } from 'lucide-react'
import { login, signup } from '@/actions/auth'

export default async function LoginPage(props: {
  searchParams: Promise<{ message?: string }>
}) {
  const searchParams = await props.searchParams
  
  return (
    <main className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-6 min-h-screen mx-auto bg-zinc-950">
      <div className="flex flex-col items-center justify-center space-y-4 mb-8">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
          <Wallet size={32} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Bem-vindo</h1>
        <p className="text-zinc-400 text-sm text-center">
          Faça login ou crie uma conta para acessar a gestão financeira familiar.
        </p>
      </div>

      <form action={login} className="flex-1 flex flex-col w-full justify-center gap-2 text-zinc-100">
        <label className="text-md font-medium text-zinc-300" htmlFor="email">
          E-mail
        </label>
        <Input
          className="bg-zinc-900 border-zinc-800 text-zinc-100 h-12 rounded-xl mb-6 px-4"
          name="email"
          placeholder="voce@exemplo.com"
          type="email"
          required
        />
        <label className="text-md font-medium text-zinc-300" htmlFor="password">
          Senha
        </label>
        <Input
          className="bg-zinc-900 border-zinc-800 text-zinc-100 h-12 rounded-xl mb-6 px-4"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        
        {searchParams?.message && (
          <p className="mt-4 p-4 bg-red-500/10 text-red-500 text-center text-sm rounded-xl mb-4">
            {searchParams.message}
          </p>
        )}
        
        <button 
          formAction={login}
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white w-full h-12 rounded-xl text-md font-medium mb-2 transition-colors"
        >
          Entrar
        </button>
        <button
          formAction={signup}
          type="submit"
          className="border border-zinc-800 text-zinc-300 hover:bg-zinc-900 w-full h-12 rounded-xl text-md font-medium transition-colors"
        >
          Criar nova conta
        </button>
      </form>
    </main>
  )
}
