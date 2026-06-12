'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AppNavbar({ user }) {
  const pathname = usePathname()
  const router = useRouter()

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
    },
    {
      label: 'Clients',
      href: '/clients',
    },
    {
      label: 'Time Entries',
      href: '/time',
    },
    {
      label: 'Invoices',
      href: '/invoices',
    },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActiveLink = (href) => {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="h-16 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              V
            </div>

            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">
                VA System
              </h1>

              <p className="text-xs text-slate-500 mt-1 hidden sm:block">
                CRM, time tracking, and invoices
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => {
              const isActive = isActiveLink(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden lg:block text-right">
              <p className="text-sm font-medium text-slate-900">
                {user?.email}
              </p>

              <p className="text-xs text-slate-500">
                VA account
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </div>

        <nav className="md:hidden flex items-center gap-2 overflow-x-auto border-t border-slate-100 py-3">
          {menuItems.map((item) => {
            const isActive = isActiveLink(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}