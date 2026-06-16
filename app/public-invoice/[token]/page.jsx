"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PublicInvoicePage() {
  const params = useParams();
  const token = params?.token;

  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) return;

    loadInvoice(token);
  }, [token]);

  const loadInvoice = async (invoiceToken) => {
    try {
      setLoading(true);

      const response = await fetch(`/api/public-invoice/${invoiceToken}`, {
        method: "GET",
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error || "Invoice not found.");
        setLoading(false);
        return;
      }

      setInvoice(result.invoice);
      setItems(result.items || []);
      setLoading(false);
    } catch (error) {
      setErrorMessage(error.message || "Something went wrong.");
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'PHP') => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
    }).format(amount || 0)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        Loading invoice...
      </div>
    )
  }

  if (errorMessage || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-slate-900">
            Invoice not found
          </h1>

          <p className="mt-2 text-slate-500">
            {errorMessage || 'The invoice link is invalid or no longer available.'}
          </p>
        </div>
      </div>
    )
  }

  const currency = invoice.client?.currency || 'PHP'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              VA System
            </h1>

            <p className="text-sm text-slate-500">
              Invoice from your Virtual Assistant
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Print / Save PDF
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 print:shadow-none print:border-none">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">
                INVOICE
              </h2>

              <p className="mt-2 text-slate-500">
                {invoice.invoice_number}
              </p>
            </div>

            <span className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
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
                  {invoice.client?.name}
                </p>

                {invoice.client?.company_name && (
                  <p>{invoice.client.company_name}</p>
                )}

                {invoice.client?.email && <p>{invoice.client.email}</p>}

                {invoice.client?.phone && <p>{invoice.client.phone}</p>}

                {invoice.client?.billing_address && (
                  <p className="mt-2 whitespace-pre-line">
                    {invoice.client.billing_address}
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
                  <th className="text-left px-4 py-3 font-medium">
                    Description
                  </th>

                  <th className="text-right px-4 py-3 font-medium">
                    Hours
                  </th>

                  <th className="text-right px-4 py-3 font-medium">
                    Rate
                  </th>

                  <th className="text-right px-4 py-3 font-medium">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No invoice items found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
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
                  ))
                )}
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