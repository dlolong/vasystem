'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function ClientsPage() {
  const router = useRouter()

  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (!error) {
      setClients(data || [])
    }

    setLoading(false)
  }

  const formatCurrency = (amount, currency = 'PHP') => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
    }).format(amount || 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        Loading clients...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Clients</h1>
            <p className="text-sm text-slate-500">
              Manage your VA clients and billing rates.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/clients/new"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add Client
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {clients.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <h2 className="text-xl font-bold text-slate-900">
              No clients yet
            </h2>
            <p className="mt-2 text-slate-500">
              Add your first client so you can start tracking billable hours.
            </p>

            <Link
              href="/clients/new"
              className="inline-flex mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Add your first client
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {client.name}
                    </h2>

                    {client.company_name && (
                      <p className="text-sm text-slate-500">
                        {client.company_name}
                      </p>
                    )}
                  </div>

                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    {client.status}
                  </span>
                </div>

                <div className="mt-5 space-y-2 text-sm">
                  <p className="text-slate-600">
                    <span className="font-medium">Email:</span>{' '}
                    {client.email || 'N/A'}
                  </p>

                  <p className="text-slate-600">
                    <span className="font-medium">Phone:</span>{' '}
                    {client.phone || 'N/A'}
                  </p>

                  <p className="text-slate-600">
                    <span className="font-medium">Rate:</span>{' '}
                    {formatCurrency(client.hourly_rate, client.currency)} / hour
                  </p>

                  <p className="text-slate-600">
                    <span className="font-medium">Payment terms:</span>{' '}
                    {client.payment_terms || 7} days
                  </p>
                </div>

                <div className="mt-6 flex gap-3">
                  <Link
                    href={`/time/new?client_id=${client.id}`}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Add Time
                  </Link>

                  <Link
                    href="/invoices"
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Invoices
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}