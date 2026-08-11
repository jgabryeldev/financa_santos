'use client'
import Link from 'next/link'
import { Home, CreditCard, BarChart2, User, Repeat, PiggyBank } from 'lucide-react'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', icon: Home, label: 'Início' },
  { href: '/investments', icon: PiggyBank, label: 'Investir' },
  { href: '/cards', icon: CreditCard, label: 'Cartões' },
  { href: '/fixed', icon: Repeat, label: 'Fixos' },
  { href: '/reports', icon: BarChart2, label: 'Relatórios' },
  { href: '/profile', icon: User, label: 'Perfil' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/60 pb-safe">
      <ul className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-200 ${
                  isActive ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className={`text-[9px] font-medium ${isActive ? 'text-indigo-400' : ''}`}>
                  {item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
