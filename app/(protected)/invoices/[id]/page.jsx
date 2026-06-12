'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function InvoiceDetailPage() {
    const params = useParams()
    const router = useRouter()

    const [invoice, setInvoice] = useState(null)
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const [sending, setSending] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')

    useEffect(() => {
        loadInvoice()
    }, [])

    const loadInvoice = async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
            router.push('/login')
            return
        }

        const { data: invoiceData, error: invoiceError } = await supabase
            .from('invoices')
            .select(`
        *,
        clients (
          name,
          company_name,
          email,
          phone,
          billing_address,
          currency
        )
      `)
            .eq('id', params.id)
            .eq('user_id', session.user.id)
            .single()

        if (invoiceError) {
            setErrorMessage(invoiceError.message)
            setLoading(false)
            return
        }

        const { data: itemData, error: itemError } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', params.id)

        if (!itemError) {
            setItems(itemData || [])
        }

        setInvoice(invoiceData)
        setLoading(false)
    }

    const updateStatus = async (status) => {
        setUpdating(true)
        setErrorMessage('')

        const updateData = {
            status,
        }

        if (status === 'sent') {
            updateData.sent_at = new Date().toISOString()
        }

        if (status === 'paid') {
            updateData.paid_at = new Date().toISOString()
        }

        const { error } = await supabase
            .from('invoices')
            .update(updateData)
            .eq('id', invoice.id)

        setUpdating(false)

        if (error) {
            setErrorMessage(error.message)
            return
        }

        await loadInvoice()
    }

    const handlePrint = () => {
        window.print()
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

    const sendInvoice = async () => {
        setSending(true)
        setErrorMessage('')
        setSuccessMessage('')

        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
            router.push('/login')
            return
        }

        const response = await fetch('/api/invoices/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                invoiceId: invoice.id,
            }),
        })

        const result = await response.json()

        setSending(false)

        if (!response.ok) {
            setErrorMessage(result.error || 'Failed to send invoice.')
            return
        }

        setSuccessMessage('Invoice sent to client successfully.')
        await loadInvoice()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                Loading invoice...
            </div>
        )
    }

    if (!invoice) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                    <h1 className="text-xl font-bold text-slate-900">
                        Invoice not found
                    </h1>

                    {errorMessage && (
                        <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
                    )}

                    <Link
                        href="/invoices"
                        className="inline-flex mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                    >
                        Back to invoices
                    </Link>
                </div>
            </div>
        )
    }

    {
        successMessage && (
            <div className="mb-5 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 print:hidden">
                {successMessage}
            </div>
        )
    }

    const currency = invoice.clients?.currency || 'PHP'

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 print:hidden">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">
                            {invoice.invoice_number}
                        </h1>
                        <p className="text-sm text-slate-500">
                            Invoice details and payment status
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Link
                            href="/invoices"
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                            Back
                        </Link>

                        <button
                            onClick={handlePrint}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                            Print / PDF
                        </button>

                        <button
                            onClick={sendInvoice}
                            disabled={sending}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {sending ? 'Sending...' : 'Send Invoice'}
                        </button>

                        <button
                            onClick={() => updateStatus('sent')}
                            disabled={updating}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            Mark Sent
                        </button>

                        <button
                            onClick={() => updateStatus('paid')}
                            disabled={updating}
                            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                        >
                            Mark Paid
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8">
                {errorMessage && (
                    <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 print:hidden">
                        {errorMessage}
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 print:shadow-none print:border-none">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900">INVOICE</h2>
                            <p className="mt-2 text-slate-500">
                                {invoice.invoice_number}
                            </p>
                        </div>

                        <span
                            className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${statusClass(
                                invoice.status
                            )}`}
                        >
                            {invoice.status}
                        </span>
                    </div>

                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                Bill To
                            </h3>

                            <div className="mt-3 text-slate-700">
                                <p className="font-bold text-slate-900">
                                    {invoice.clients?.name}
                                </p>

                                {invoice.clients?.company_name && (
                                    <p>{invoice.clients.company_name}</p>
                                )}

                                {invoice.clients?.email && <p>{invoice.clients.email}</p>}
                                {invoice.clients?.phone && <p>{invoice.clients.phone}</p>}
                                {invoice.clients?.billing_address && (
                                    <p className="mt-2 whitespace-pre-line">
                                        {invoice.clients.billing_address}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="sm:text-right">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                Invoice Details
                            </h3>

                            <div className="mt-3 text-slate-700 space-y-1">
                                <p>
                                    <span className="font-medium">Period:</span>{' '}
                                    {invoice.period_start} to {invoice.period_end}
                                </p>

                                <p>
                                    <span className="font-medium">Due date:</span>{' '}
                                    {invoice.due_date}
                                </p>

                                <p>
                                    <span className="font-medium">Created:</span>{' '}
                                    {new Date(invoice.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium">Description</th>
                                    <th className="text-right px-4 py-3 font-medium">Hours</th>
                                    <th className="text-right px-4 py-3 font-medium">Rate</th>
                                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                                </tr>
                            </thead>

                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id} className="border-t border-slate-100">
                                        <td className="px-4 py-4 text-slate-700">
                                            {item.description}
                                        </td>

                                        <td className="px-4 py-4 text-right text-slate-700">
                                            {Number(item.quantity || 0).toFixed(2)}
                                        </td>

                                        <td className="px-4 py-4 text-right text-slate-700">
                                            {formatCurrency(item.rate, currency)}
                                        </td>

                                        <td className="px-4 py-4 text-right font-semibold text-slate-900">
                                            {formatCurrency(item.amount, currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <div className="w-full max-w-sm space-y-3">
                            <div className="flex justify-between text-slate-600">
                                <span>Subtotal</span>
                                <span>{formatCurrency(invoice.subtotal, currency)}</span>
                            </div>

                            <div className="flex justify-between text-slate-600">
                                <span>Tax</span>
                                <span>{formatCurrency(invoice.tax, currency)}</span>
                            </div>

                            <div className="border-t border-slate-200 pt-3 flex justify-between text-xl font-bold text-slate-900">
                                <span>Total</span>
                                <span>{formatCurrency(invoice.total, currency)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 rounded-2xl bg-slate-50 p-5">
                        <p className="text-sm text-slate-600">
                            Thank you for your business. Please settle this invoice on or before the due date.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}