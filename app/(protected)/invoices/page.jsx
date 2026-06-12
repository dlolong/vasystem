'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function InvoicesPage() {
    const router = useRouter()

    const [userId, setUserId] = useState(null)
    const [invoices, setInvoices] = useState([])
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        loadInvoices()
    }, [])

    const loadInvoices = async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
            router.push('/login')
            return
        }

        setUserId(session.user.id)

        const { data, error } = await supabase
            .from('invoices')
            .select(`
        *,
        clients (
          name,
          email,
          currency
        )
      `)
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })

        if (!error) {
            setInvoices(data || [])
        }

        setLoading(false)
    }

    const generateWeeklyInvoices = async () => {
        setErrorMessage('')
        setGenerating(true)

        const week = getLastWeekRange()

        const { data: entries, error: entriesError } = await supabase
            .from('time_entries')
            .select(`
        *,
        clients (
          name,
          payment_terms,
          currency
        )
      `)
            .eq('user_id', userId)
            .eq('billable', true)
            .eq('invoiced', false)
            .gte('work_date', week.start)
            .lte('work_date', week.end)

        if (entriesError) {
            setErrorMessage(entriesError.message)
            setGenerating(false)
            return
        }

        if (!entries || entries.length === 0) {
            setErrorMessage('No uninvoiced billable time entries found for last week.')
            setGenerating(false)
            return
        }

        const groupedByClient = entries.reduce((group, entry) => {
            if (!group[entry.client_id]) {
                group[entry.client_id] = []
            }

            group[entry.client_id].push(entry)
            return group
        }, {})

        for (const clientId of Object.keys(groupedByClient)) {
            const clientEntries = groupedByClient[clientId]

            const subtotal = clientEntries.reduce((sum, entry) => {
                return sum + Number(entry.hours || 0) * Number(entry.hourly_rate || 0)
            }, 0)

            const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()
                .toString()
                .slice(-6)}`

            const dueDate = new Date()
            dueDate.setDate(
                dueDate.getDate() + Number(clientEntries[0]?.clients?.payment_terms || 7)
            )

            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .insert({
                    user_id: userId,
                    client_id: clientId,
                    invoice_number: invoiceNumber,
                    period_start: week.start,
                    period_end: week.end,
                    subtotal,
                    tax: 0,
                    total: subtotal,
                    status: 'draft',
                    due_date: dueDate.toISOString().split('T')[0],
                })
                .select()
                .single()

            if (invoiceError) {
                setErrorMessage(invoiceError.message)
                continue
            }

            const invoiceItems = clientEntries.map((entry) => ({
                invoice_id: invoice.id,
                time_entry_id: entry.id,
                description: entry.description || `Work on ${entry.work_date}`,
                quantity: Number(entry.hours || 0),
                rate: Number(entry.hourly_rate || 0),
                amount: Number(entry.hours || 0) * Number(entry.hourly_rate || 0),
            }))

            await supabase.from('invoice_items').insert(invoiceItems)

            await supabase
                .from('time_entries')
                .update({
                    invoiced: true,
                    invoice_id: invoice.id,
                })
                .in(
                    'id',
                    clientEntries.map((entry) => entry.id)
                )
        }

        setGenerating(false)
        await loadInvoices()
    }

    const getLastWeekRange = () => {
        const today = new Date()
        const day = today.getDay()
        const currentMonday = new Date(today)

        currentMonday.setDate(today.getDate() - day + (day === 0 ? -6 : 1))

        const lastMonday = new Date(currentMonday)
        lastMonday.setDate(currentMonday.getDate() - 7)

        const lastSunday = new Date(lastMonday)
        lastSunday.setDate(lastMonday.getDate() + 6)

        return {
            start: lastMonday.toISOString().split('T')[0],
            end: lastSunday.toISOString().split('T')[0],
        }
    }

    const formatCurrency = (amount, currency = 'PHP') => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency,
        }).format(amount || 0)
    }

    const statusClass = (status) => {
        if (status === 'paid') return 'bg-green-100 text-green-700'
        if (status === 'sent') return 'bg-blue-100 text-blue-700'
        if (status === 'overdue') return 'bg-red-100 text-red-700'
        return 'bg-slate-100 text-slate-700'
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                Loading invoices...
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Invoices</h1>
                        <p className="text-sm text-slate-500">
                            Generate and manage weekly invoices.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={generateWeeklyInvoices}
                            disabled={generating}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {generating ? 'Generating...' : 'Generate Last Week'}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {errorMessage && (
                    <div className="mb-5 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-700">
                        {errorMessage}
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="text-left px-6 py-3 font-medium">Invoice #</th>
                                    <th className="text-left px-6 py-3 font-medium">Client</th>
                                    <th className="text-left px-6 py-3 font-medium">Period</th>
                                    <th className="text-left px-6 py-3 font-medium">Due Date</th>
                                    <th className="text-left px-6 py-3 font-medium">Total</th>
                                    <th className="text-left px-6 py-3 font-medium">Status</th>
                                    <th className="text-left px-6 py-3 font-medium">Action</th>
                                </tr>
                            </thead>

                            <tbody>
                                {invoices.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-10 text-center text-slate-500">
                                            No invoices yet.
                                        </td>
                                    </tr>
                                ) : (
                                    invoices.map((invoice) => {
                                        const currency = invoice.clients?.currency || 'PHP'

                                        return (
                                            <tr key={invoice.id} className="border-t border-slate-100">
                                                <td className="px-6 py-4 font-semibold text-slate-900">
                                                    {invoice.invoice_number}
                                                </td>

                                                <td className="px-6 py-4 text-slate-700">
                                                    {invoice.clients?.name || 'Unknown client'}
                                                </td>

                                                <td className="px-6 py-4 text-slate-700">
                                                    {invoice.period_start} to {invoice.period_end}
                                                </td>

                                                <td className="px-6 py-4 text-slate-700">
                                                    {invoice.due_date}
                                                </td>

                                                <td className="px-6 py-4 font-semibold text-slate-900">
                                                    {formatCurrency(invoice.total, currency)}
                                                </td>

                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                                                            invoice.status
                                                        )}`}
                                                    >
                                                        {invoice.status}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <Link
                                                        href={`/invoices/${invoice.id}`}
                                                        className="font-semibold text-blue-600 hover:text-blue-700"
                                                    >
                                                        View
                                                    </Link>
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