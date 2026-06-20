"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Printer, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMoney } from "@/lib/currency";
import { useAppContext } from "@/context/AppContext";

export default function InvoicePreviewDialog({
    open,
    invoice,
    onClose,
    onDeleted,
}) {
    const { showToast } = useAppContext();

const [currentUserId, setCurrentUserId] = useState(null);
const [deleting, setDeleting] = useState(false);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [source, setSource] = useState("");

    const client = invoice?.client || invoice?.clients || null;
    const currency = normalizeCurrency(
        invoice?.currency || client?.currency || "USD"
    );

    const isVAInvoice = Boolean(invoice?.user_id);
    const isAgencyInvoice = !invoice?.user_id && Boolean(invoice?.organization_id);

    const canDeleteInvoice =
    Boolean(currentUserId) &&
    Boolean(invoice?.id) &&
    (
        invoice?.created_by === currentUserId ||
        invoice?.user_id === currentUserId ||
        (
            invoice?.creator_type === "va" &&
            invoice?.creator_id === currentUserId
        )
    );

    useEffect(() => {
        if (open && invoice?.id) {
            loadItems();
        }

        if (!open) {
            setItems([]);
            setSource("");
        }
    }, [open, invoice?.id]);

    useEffect(() => {
    if (open) {
        loadCurrentUser();
    }

    if (!open) {
        setCurrentUserId(null);
        setDeleting(false);
    }
}, [open]);

async function handleDeleteInvoice() {
    if (!invoice?.id) {
        showToast("Invoice not found.", "error");
        return;
    }

    if (!canDeleteInvoice) {
        showToast("Only the invoice creator can delete this invoice.", "error");
        return;
    }

    const confirmed = window.confirm(
        `Delete invoice ${invoice.invoice_number || invoice.id.slice(0, 8)}?\n\nThis will permanently delete the invoice. For VA invoices, linked time logs will become uninvoiced again.`
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
        const { error } = await supabase.rpc("delete_invoice_as_creator", {
            p_invoice_id: invoice.id,
        });

        if (error) throw error;

        showToast("Invoice deleted successfully.", "success");

        if (onDeleted) {
            onDeleted(invoice.id);
        }

        onClose();
    } catch (error) {
        showToast(error.message || "Unable to delete invoice.", "error");
    }

    setDeleting(false);
}

async function loadCurrentUser() {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) {
        console.error(error);
        setCurrentUserId(null);
        return;
    }

    setCurrentUserId(user?.id || null);
}

    async function loadItems() {
        setLoading(true);

        try {
            let loadedItems = [];

            if (isVAInvoice) {
                loadedItems = await loadTimeLogItems();

                setItems(loadedItems);
                setSource(loadedItems.length > 0 ? "time_logs" : "empty");
                setLoading(false);
                return;
            }

            if (isAgencyInvoice) {
                loadedItems = await loadInvoiceItems();

                setItems(loadedItems);
                setSource(loadedItems.length > 0 ? "invoice_items" : "empty");
                setLoading(false);
                return;
            }

            // Safe fallback for unknown invoice type
            loadedItems = await loadInvoiceItems();

            if (loadedItems.length === 0) {
                loadedItems = await loadTimeLogItems();
            }

            setItems(loadedItems);
            setSource(loadedItems.length > 0 ? "fallback" : "empty");
        } catch (error) {
            console.error("Invoice preview error:", error);
            setItems([]);
            setSource("error");
        }

        setLoading(false);
    }

    async function loadInvoiceItems() {
        const { data, error } = await supabase
            .from("invoice_items")
            .select(
                `
      id,
      invoice_id,
      description,
      quantity,
      rate,
      amount,
      time_log_id
    `
            )
            .eq("invoice_id", invoice.id)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Invoice items error:", error);
            return [];
        }

        return (data || []).map((item) => {
            const quantity = Number(item.quantity || 0);
            const rate = Number(item.rate || 0);
            const amount =
                Number(item.amount || 0) || Number((quantity * rate).toFixed(2));

            return {
                id: item.id,
                type: "invoice_item",
                description: item.description || "Invoice item",
                quantity,
                rate,
                amount,
                date: null,
            };
        });
    }

    async function loadTimeLogItems() {
        const { data, error } = await supabase
            .from("time_logs")
            .select(
                `
        id,
        start_time,
        end_time,
        duration,
        description,
        hourly_rate,
        currency,
        invoice_id,
        billable,
        invoiced
      `
            )
            .eq("invoice_id", invoice.id)
            .order("start_time", { ascending: true });

        if (error) {
            console.error(error);
            return [];
        }

        return (data || []).map((log) => {
            const hours = Number((Number(log.duration || 0) / 3600).toFixed(2));
            const rate = Number(log?.hourly_rate || client?.hourly_rate || 0);
            const amount = Number((hours * rate).toFixed(2));

            return {
                id: log.id,
                type: "time_log",
                description: log.description || "VA services",
                quantity: hours,
                rate,
                amount,
                date: log.start_time,
            };
        });
    }

    const totals = useMemo(() => {
        const subtotal =
            items.length > 0
                ? items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
                : Number(invoice?.total_amount || 0);

        const tax = Number(invoice?.tax || 0);
        const total = subtotal + tax;

        return {
            subtotal,
            tax,
            total,
        };
    }, [items, invoice]);

    function formatCurrency(amount) {
        return formatMoney(amount, currency);
    }

    function formatDate(date) {
        if (!date) return "—";

        return new Date(date).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    function handlePrint() {
        window.print();
    }
    

    if (!open || !invoice) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 px-3 py-6 print:static print:bg-white print:p-0">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl print:max-h-none print:rounded-none print:shadow-none">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 print:hidden">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Invoice Preview
                        </h2>
                        <p className="text-sm text-slate-500">
                            {isVAInvoice
                                ? "VA invoice from time logs."
                                : "Agency invoice from invoice items."}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {invoice.public_token && (
                            <a
                                href={`/public-invoice/${invoice.public_token}`}
                                target="_blank"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Public Link
                                <ExternalLink size={15} />
                            </a>
                        )}

                        {canDeleteInvoice && (
    <button
        type="button"
        onClick={handleDeleteInvoice}
        disabled={deleting}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
        {deleting ? (
            <>
                <Loader2 size={15} className="animate-spin" />
                Deleting...
            </>
        ) : (
            <>
                <Trash2 size={15} />
                Delete
            </>
        )}
    </button>
)}

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            <Printer size={15} />
                            Print
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">
                    <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 print:border-none print:shadow-none">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-900">INVOICE</h2>
                                <p className="mt-2 text-slate-500">
                                    {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                                </p>
                            </div>

                            <span className="inline-flex w-fit rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold capitalize text-blue-700">
                                {invoice.status || "draft"}
                            </span>
                        </div>

                        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                    Bill To
                                </h3>

                                <div className="mt-3 text-slate-700">
                                    <p className="font-bold text-slate-900">
                                        {client?.name || "Client"}
                                    </p>

                                    {client?.company_name && <p>{client.company_name}</p>}
                                    {client?.email && <p>{client.email}</p>}
                                    {client?.phone && <p>{client.phone}</p>}

                                    {client?.billing_address && (
                                        <p className="mt-2 whitespace-pre-line">
                                            {client.billing_address}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="sm:text-right">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                    Invoice Details
                                </h3>

                                <div className="mt-3 space-y-1 text-slate-700">
                                    <p>
                                        <span className="font-medium">Type:</span>{" "}
                                        {isVAInvoice ? "VA invoice" : "Agency invoice"}
                                    </p>

                                    <p>
                                        <span className="font-medium">Item source:</span>{" "}
                                        {getSourceLabel(source)}
                                    </p>

                                    <p>
                                        <span className="font-medium">Period:</span>{" "}
                                        {invoice.period_start || "—"} to {invoice.period_end || "—"}
                                    </p>

                                    <p>
                                        <span className="font-medium">Due date:</span>{" "}
                                        {formatDate(invoice.due_date)}
                                    </p>

                                    <p>
                                        <span className="font-medium">Created:</span>{" "}
                                        {formatDate(invoice.created_at)}
                                    </p>

                                    <p>
                                        <span className="font-medium">Currency:</span> {currency}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">
                                            Description
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium">Date</th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            {isVAInvoice ? "Hours" : "Qty"}
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium">Rate</th>
                                        <th className="px-4 py-3 text-right font-medium">
                                            Amount
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan="5"
                                                className="px-4 py-8 text-center text-slate-500"
                                            >
                                                Loading items...
                                            </td>
                                        </tr>
                                    ) : items.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="5"
                                                className="px-4 py-8 text-center text-slate-500"
                                            >
                                                {isVAInvoice
                                                    ? "No linked time logs found for this VA invoice."
                                                    : "No invoice items found for this Agency invoice."}
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item) => (
                                            <tr key={item.id} className="border-t border-slate-100">
                                                <td className="px-4 py-4 text-slate-700">
                                                    <p>{item.description}</p>
                                                    <p className="mt-1 text-xs text-slate-400">
                                                        {item.type === "time_log"
                                                            ? "From time log"
                                                            : "From invoice item"}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-4 text-slate-500">
                                                    {formatDate(item.date)}
                                                </td>

                                                <td className="px-4 py-4 text-right text-slate-700">
                                                    {Number(item.quantity || 0).toFixed(2)}
                                                </td>

                                                <td className="px-4 py-4 text-right text-slate-700">
                                                    {formatCurrency(item.rate)}
                                                </td>

                                                <td className="px-4 py-4 text-right font-semibold text-slate-900">
                                                    {formatCurrency(item.amount)}
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
                                    <span>{formatCurrency(totals.subtotal)}</span>
                                </div>

                                <div className="flex justify-between text-slate-600">
                                    <span>Tax</span>
                                    <span>{formatCurrency(totals.tax)}</span>
                                </div>

                                <div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-bold text-slate-900">
                                    <span>Total</span>
                                    <span>{formatCurrency(totals.total)}</span>
                                </div>
                            </div>
                        </div>

                        <BankDetailsCard invoice={invoice} />

                        <div className="mt-10 rounded-2xl bg-slate-50 p-5">
                            <p className="text-sm text-slate-600">
                                {invoice.notes ||
                                    "Thank you for your business. Please settle this invoice on or before the due date."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function normalizeCurrency(currency) {
    return currency?.trim()?.toUpperCase() || "USD";
}

function getSourceLabel(source) {
    const labels = {
        time_logs: "Time logs",
        invoice_items: "Invoice items",
        fallback: "Fallback source",
        empty: "No items",
        error: "Unable to load",
    };

    return labels[source] || "Loading...";
}

function BankDetailsCard({ invoice }) {
  const hasBankDetails =
    invoice?.creator_bank_name ||
    invoice?.creator_bank_account_name ||
    invoice?.creator_bank_account_number;

  if (!hasBankDetails) return null;

  return (
    <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
        Payment Instructions
      </h3>

      <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-blue-950 sm:grid-cols-2">
        <Detail label="Payee" value={invoice.creator_display_name} />
        <Detail label="Bank" value={invoice.creator_bank_name} />
        <Detail label="Account Name" value={invoice.creator_bank_account_name} />
        <Detail
          label="Account Number"
          value={invoice.creator_bank_account_number}
        />
        <Detail label="Account Type" value={invoice.creator_bank_account_type} />
        <Detail label="Branch" value={invoice.creator_bank_branch} />
        <Detail label="SWIFT / Code" value={invoice.creator_bank_swift_code} />
      </div>

      {invoice.creator_bank_notes && (
        <p className="mt-4 whitespace-pre-line rounded-xl bg-white/70 p-3 text-sm text-blue-900">
          {invoice.creator_bank_notes}
        </p>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  if (!value) return null;

  return (
    <p>
      <span className="font-semibold">{label}:</span> {value}
    </p>
  );
}