"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";

const statusOptions = [
    { label: "Draft", value: "draft" },
    { label: "Sent", value: "sent" },
    { label: "Paid", value: "paid" },
    { label: "Overdue", value: "overdue" },
    { label: "Cancelled", value: "cancelled" },
];

export default function AddInvoiceDialog({
    open,
    onClose,
    clients = [],
    onInvoiceAdded,
}) {
    const { showToast } = useAppContext();
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        client_id: "",
        invoice_number: "",
        total_amount: "",
        status: "draft",
        due_date: "",
        payment_link: "",
        notes: "",
    });

    if (!open) return null;

    function updateField(e) {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    }

    function resetForm() {
        setForm({
            client_id: "",
            invoice_number: "",
            total_amount: "",
            status: "draft",
            due_date: "",
            payment_link: "",
            notes: "",
        });
    }

    function closeDialog() {
        resetForm();
        onClose();
    }

    function generateInvoiceNumber() {
        return `INV-${Date.now().toString().slice(-8)}`;
    }

    async function handleSubmit(e) {
        e.preventDefault();

        if (!form.client_id) {
            showToast("Please select a client.", "error");
            return;
        }

        if (!form.total_amount || Number(form.total_amount) <= 0) {
            showToast("Invoice amount is required.", "error");
            return;
        }

        const selectedClient = clients.find(
            (client) => client.id === form.client_id
        );

        if (!selectedClient) {
            showToast("Selected client not found.", "error");
            return;
        }

        setSaving(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            showToast("User session not found.", "error");
            setSaving(false);
            return;
        }

        const publicToken = crypto.randomUUID().replaceAll("-", "");
        const siteUrl =
            process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

        const publicInvoiceLink = `${siteUrl}/public-invoice/${publicToken}`;

        const { data, error } = await supabase
            .from("invoices")
            .insert({
                user_id: user.id,
                organization_id: selectedClient.organization_id || null,
                client_id: selectedClient.id,

                public_token: publicToken,
                payment_link: publicInvoiceLink,

                invoice_number: form.invoice_number || generateInvoiceNumber(),
                total_amount: Number(form.total_amount || 0),
                tax: 0,
                status: form.status,
                due_date: form.due_date || null,
                notes: form.notes || null,
            })
            .select(
                `
    *,
    clients (
      id,
      name,
      email,
      hourly_rate
    )
  `
            )
            .single();

        if (!error && data) {
            await supabase.from("invoice_items").insert({
                invoice_id: data.id,
                description: form.notes || "VA services",
                quantity: 1,
                rate: Number(form.total_amount || 0),
                amount: Number(form.total_amount || 0),
            });
        }

        if (error) {
            showToast(error.message, "error");
            setSaving(false);
            return;
        }

        showToast("Invoice added successfully.", "success");

        if (onInvoiceAdded) {
            onInvoiceAdded(data);
        }

        resetForm();
        setSaving(false);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                            Add Invoice
                        </h3>
                        <p className="text-sm text-slate-500">
                            Create an invoice for one of your VA clients.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={closeDialog}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Client
                        </label>

                        <select
                            name="client_id"
                            value={form.client_id}
                            onChange={updateField}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        >
                            <option value="">Select client</option>

                            {clients.map((client) => (
                                <option key={client.id} value={client.id}>
                                    {client.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Invoice Number
                            </label>

                            <input
                                name="invoice_number"
                                value={form.invoice_number}
                                onChange={updateField}
                                placeholder="Auto-generated if empty"
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Amount
                            </label>

                            <input
                                name="total_amount"
                                type="number"
                                value={form.total_amount}
                                onChange={updateField}
                                placeholder="0"
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Status
                            </label>

                            <select
                                name="status"
                                value={form.status}
                                onChange={updateField}
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            >
                                {statusOptions.map((status) => (
                                    <option key={status.value} value={status.value}>
                                        {status.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Due Date
                            </label>

                            <input
                                name="due_date"
                                type="date"
                                value={form.due_date}
                                onChange={updateField}
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Payment Link
                        </label>

                        <input
                            name="payment_link"
                            value={form.payment_link}
                            onChange={updateField}
                            placeholder="https://..."
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Notes
                        </label>

                        <textarea
                            name="notes"
                            value={form.notes}
                            onChange={updateField}
                            rows={3}
                            placeholder="Optional invoice notes..."
                            className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={closeDialog}
                            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {saving ? "Saving..." : "Save Invoice"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}