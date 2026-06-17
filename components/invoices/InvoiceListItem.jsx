"use client";

import { Eye, ExternalLink } from "lucide-react";
import { formatMoney } from "@/lib/currency";

const statusOptions = [
    { label: "Draft", value: "draft" },
    { label: "Sent", value: "sent" },
    { label: "Paid", value: "paid" },
    { label: "Overdue", value: "overdue" },
    { label: "Cancelled", value: "cancelled" },
];

export default function InvoiceListItem({
    invoice,
    formatDate,
    onView,
    onStatusChange,
}) {
    function getStatusBadge(status) {
        const styles = {
            draft: "bg-slate-100 text-slate-700",
            sent: "bg-blue-100 text-blue-700",
            paid: "bg-green-100 text-green-700",
            overdue: "bg-red-100 text-red-700",
            cancelled: "bg-slate-200 text-slate-600",
        };

        return styles[status] || styles.draft;
    }

    const client = invoice.clients || invoice.client;
    const currency = invoice.currency || client?.currency || "USD";

    return (
        <div className="grid grid-cols-1 gap-4 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[1.4fr_1fr_180px_230px] lg:items-center">
            <div className="min-w-0">
                <h3 className="truncate font-semibold text-slate-900">
                    {invoice.invoice_number || `Invoice ${invoice.id.slice(0, 8)}`}
                </h3>

                <p className="mt-1 truncate text-sm text-slate-500">
                    {client?.name || "No client"}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                    Due: {formatDate(invoice.due_date)}
                </p>
            </div>

            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Amount
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                    {formatMoney(invoice.total_amount, currency)}
                </p>

                <p className="mt-1 text-xs font-medium text-slate-400">
                    {currency}
                </p>
            </div>

            <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Status
                </p>

                <div className="space-y-2">
                    <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(
                            invoice.status
                        )}`}
                    >
                        {invoice.status || "draft"}
                    </span>

                    <select
                        value={invoice.status || "draft"}
                        onChange={(e) => onStatusChange(invoice.id, e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                        {statusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                                {status.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:flex lg:justify-end">
                <button
                    type="button"
                    onClick={() => onView(invoice)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white lg:w-auto"
                >
                    <Eye size={16} />
                    View
                </button>

                {invoice.public_token ? (
                    <a
                        href={`/public-invoice/${invoice.public_token}`}
                        target="_blank"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 lg:w-auto"
                    >
                        <ExternalLink size={16} />
                        Public
                    </a>
                ) : (
                    <button
                        type="button"
                        disabled
                        className="inline-flex w-full items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400 lg:w-auto"
                    >
                        No Link
                    </button>
                )}
            </div>
        </div>
    );
}