import { createClient } from '@/lib/supabase/server'
import { logout } from '@/actions/auth'
import { User, LogOut, Mail, Shield, Repeat, CreditCard, TrendingDown } from 'lucide-react'
import { getCards } from '@/actions/transactions'
import { getFixedFinances } from '@/actions/fixed'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [cards, fixedItems] = await Promise.all([
    getCards(),
    getFixedFinances(),
  ])

  const totalFixedExpense = fixedItems.filter(i => i.type === 'expense').reduce((a, i) => a + Number(i.amount), 0)
  const totalFixedIncome = fixedItems.filter(i => i.type === 'income').reduce((a, i) => a + Number(i.amount), 0)

  function fmt(v: number) {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  }

  return (
    <main className="min-h-screen p-4 pb-32">
      {/* Header */}
      <header className="py-4 mb-6">
        <p className="text-zinc-500 text-sm font-medium">Sua conta</p>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Perfil</h1>
      </header>

      {/* Avatar + email */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
          <User size={28} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-zinc-400 text-xs font-medium mb-0.5 flex items-center gap-1.5">
            <Mail size={11} />
            E-mail
          </p>
          <p className="text-zinc-100 font-semibold text-sm truncate">{user?.email}</p>
          <p className="text-zinc-600 text-[10px] mt-1 flex items-center gap-1">
            <Shield size={9} />
            Conta verificada
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
          <CreditCard size={16} className="text-indigo-400 mx-auto mb-1.5" />
          <p className="text-xl font-bold text-zinc-100">{cards.length}</p>
          <p className="text-[10px] text-zinc-600">Cartões</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
          <TrendingDown size={16} className="text-red-400 mx-auto mb-1.5" />
          <p className="text-sm font-bold text-zinc-100">R$ {fmt(totalFixedExpense)}</p>
          <p className="text-[10px] text-zinc-600">Fixos/mês</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
          <Repeat size={16} className="text-emerald-400 mx-auto mb-1.5" />
          <p className="text-sm font-bold text-zinc-100">R$ {fmt(totalFixedIncome)}</p>
          <p className="text-[10px] text-zinc-600">Receita/mês</p>
        </div>
      </div>

      {/* Logout */}
      <form action={logout}>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-red-500/40 hover:bg-red-500/5 text-red-400 h-14 rounded-2xl font-medium transition-all duration-200"
        >
          <LogOut size={18} />
          Sair da conta
        </button>
      </form>

      <p className="text-center text-zinc-700 text-xs mt-6">
        Finanças Família • Versão 1.0
      </p>
    </main>
  )
}
