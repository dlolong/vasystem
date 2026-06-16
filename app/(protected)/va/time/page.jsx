'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function TimeEntriesPage() {
  const router = useRouter()

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        clients (
          name,
          currency
        )
      `)
      .eq('user_id', session.user.id)
      .order('work_date', { ascending: false })

    if (!error) {
      setEntries(data || [])
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
        Loading time entries...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Time Entries</h1>
            <p className="text-sm text-slate-500">
              Track your work hours for each client.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/time/new"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add Time
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Date</th>
                  <th className="text-left px-6 py-3 font-medium">Client</th>
                  <th className="text-left px-6 py-3 font-medium">Description</th>
                  <th className="text-left px-6 py-3 font-medium">Hours</th>
                  <th className="text-left px-6 py-3 font-medium">Rate</th>
                  <th className="text-left px-6 py-3 font-medium">Amount</th>
                  <th className="text-left px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-center text-slate-500">
                      No time entries yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const currency = entry.clients?.currency || 'PHP'
                    const amount =
                      Number(entry.hours || 0) * Number(entry.hourly_rate || 0)

                    return (
                      <tr key={entry.id} className="border-t border-slate-100">
                        <td className="px-6 py-4 text-slate-700">
                          {entry.work_date}
                        </td>

                        <td className="px-6 py-4 font-medium text-slate-900">
                          {entry.clients?.name || 'Unknown client'}
                        </td>

                        <td className="px-6 py-4 text-slate-700">
                          {entry.description || 'No description'}
                        </td>

                        <td className="px-6 py-4 text-slate-700">
                          {Number(entry.hours || 0).toFixed(2)}
                        </td>

                        <td className="px-6 py-4 text-slate-700">
                          {formatCurrency(entry.hourly_rate, currency)}
                        </td>

                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {formatCurrency(amount, currency)}
                        </td>

                        <td className="px-6 py-4">
                          {entry.invoiced ? (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                              Invoiced
                            </span>
                          ) : (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                              Uninvoiced
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}