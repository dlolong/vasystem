"use client";

import { useMemo, useState } from "react";
import {
    CalendarDays,
    Loader2,
    Plus,
    Trash2,
    Wand2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AppDialog from "@/components/ui/AppDialog";
import { formatMoney } from "@/lib/currency";

const DEFAULT_NOTES =
    "Thank you for your business. Please settle this invoice on or before the due date.";

export default function GenerateInvoiceDialog({
    open,
    onClose,
    mode = "va",
    organizationId = null,
    clients = [],
    onGenerated,
}) {
    const isAgency = mode === "agency";
    const isVA = mode === "va";

    const [generating, setGenerating] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const [form, setForm] = useState({
        client_id: "",
        start_date: "",
        end_date: "",
        due_date: "",
        status: "sent",
        notes: DEFAULT_NOTES,
    });

    const [manualItems, setManualItems] = useState([
        {
            description: "",
            quantity: 1,
            rate: 0,
        },
    ]);

    const selectedClient = useMemo(() => {
        return clients.find((client) => client.id === form.client_id) || null;
    }, [clients, form.client_id]);

    const selectedCurrency = normalizeCurrency(selectedClient?.currency || "USD");
    const manualTotal = useMemo(() => {
        return manualItems.reduce((sum, item) => {
            const quantity = Number(item.quantity || 0);
            const rate = Number(item.rate || 0);
            return sum + quantity * rate;
        }, 0);
    }, [manualItems]);

    function updateForm(e) {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    }

    function resetForm() {
        setForm({
            client_id: "",
            start_date: "",
            end_date: "",
            due_date: "",
            status: "sent",
            notes: DEFAULT_NOTES,
        });

        setManualItems([
            {
                description: "",
                quantity: 1,
                rate: 0,
            },
        ]);

        setMessage({ type: "", text: "" });
    }

    function addManualItem() {
        setManualItems((prev) => [
            ...prev,
            {
                description: "",
                quantity: 1,
                rate: 0,
            },
        ]);
    }

    function removeManualItem(index) {
        setManualItems((prev) => {
            if (prev.length === 1) return prev;
            return prev.filter((_, itemIndex) => itemIndex !== index);
        });
    }

    function updateManualItem(index, field, value) {
        setManualItems((prev) =>
            prev.map((item, itemIndex) =>
                itemIndex === index
                    ? {
                        ...item,
                        [field]: value,
                    }
                    : item
            )
        );
    }

    function generateInvoiceNumber() {
        return `INV-${Date.now().toString().slice(-8)}`;
    }

    function formatCurrency(amount) {
        return formatMoney(amount, selectedCurrency);
    }

    async function getFreshClient() {
        const { data, error } = await supabase
            .from("clients")
            .select(
                `
        id,
        name,
        email,
        currency,
        hourly_rate,
        organization_id
      `
            )
            .eq("id", form.client_id)
            .maybeSingle();

        if (error) throw error;

        return data || selectedClient;
    }

    function formatDateForDescription(date) {
        if (!date) return "";

        return new Date(date).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    function createDateRange() {
        const start = new Date(`${form.start_date}T00:00:00`);
        const end = new Date(`${form.end_date}T23:59:59`);

        return {
            start,
            end,
        };
    }

    function validate() {
        if (!form.client_id) {
            return "Please select a client.";
        }

        if (isVA) {
            if (!form.start_date) return "Start date is required.";
            if (!form.end_date) return "End date is required.";

            const { start, end } = createDateRange();

            if (end < start) {
                return "End date must be after start date.";
            }
        }

        if (isAgency) {
            const validItems = manualItems.filter((item) => {
                const description = item.description.trim();
                const quantity = Number(item.quantity || 0);
                const rate = Number(item.rate || 0);

                return description && quantity > 0 && rate >= 0;
            });

            if (validItems.length === 0) {
                return "Please add at least one invoice item.";
            }

            if (manualTotal <= 0) {
                return "Invoice total must be greater than zero.";
            }
        }

        return "";
    }

    async function fetchBillableTimeLogs(userId) {
        const { start, end } = createDateRange();

        const { data, error } = await supabase
            .from("time_logs")
            .select(
                `
        id,
        user_id,
        organization_id,
        client_id,
        start_time,
        end_time,
        duration,
        description,
        hourly_rate,
        currency,
        billable,
        invoiced
      `
            )
            .eq("client_id", form.client_id)
            .eq("user_id", userId)
            .eq("billable", true)
            .eq("invoiced", false)
            .gte("start_time", start.toISOString())
            .lte("start_time", end.toISOString())
            .order("start_time", { ascending: true });

        if (error) throw error;

        return data || [];
    }

    function buildItemsFromTimeLogs(logs, clientForInvoice) {
        return logs.map((log) => {
            const hours = Number((Number(log.duration || 0) / 3600).toFixed(2));
            const rate = Number(log.hourly_rate || clientForInvoice?.hourly_rate || 0);
            const amount = Number((hours * rate).toFixed(2));

            return {
                time_log_id: log.id,
                description: `${log.description || "VA services"} — ${formatDateForDescription(
                    log.start_time
                )}`,
                quantity: hours,
                rate,
                amount,
            };
        });
    }

    function buildManualItems() {
        return manualItems
            .filter((item) => item.description.trim())
            .map((item) => {
                const quantity = Number(item.quantity || 0);
                const rate = Number(item.rate || 0);
                const amount = Number((quantity * rate).toFixed(2));

                return {
                    time_log_id: null,
                    description: item.description.trim(),
                    quantity,
                    rate,
                    amount,
                };
            });
    }

    async function getCreatorBankSnapshot(userId, clientForInvoice) {
        if (isAgency) {
            const orgId = organizationId || clientForInvoice?.organization_id || null;

            if (!orgId) {
                return {
                    creator_type: "agency",
                    creator_id: null,
                    creator_display_name: "Agency",
                };
            }

            const { data, error } = await supabase
                .from("organizations")
                .select(
                    `
                    id,
                    name,
                    bank_name,
                    bank_account_name,
                    bank_account_number,
                    bank_account_type,
                    bank_branch,
                    bank_swift_code,
                    bank_notes
                `
                )
                .eq("id", orgId)
                .maybeSingle();

            if (error) throw error;

            return {
                creator_type: "agency",
                creator_id: data?.id || orgId,
                creator_display_name: data?.name || "Agency",
                creator_bank_name: data?.bank_name || null,
                creator_bank_account_name: data?.bank_account_name || null,
                creator_bank_account_number: data?.bank_account_number || null,
                creator_bank_account_type: data?.bank_account_type || null,
                creator_bank_branch: data?.bank_branch || null,
                creator_bank_swift_code: data?.bank_swift_code || null,
                creator_bank_notes: data?.bank_notes || null,
            };
        }

        const { data, error } = await supabase
            .from("users")
            .select(
                `
            id,
            email,
            full_name,
            bank_name,
            bank_account_name,
            bank_account_number,
            bank_account_type,
            bank_branch,
            bank_swift_code,
            bank_notes
            `
            )
            .eq("id", userId)
            .maybeSingle();

        if (error) throw error;

        return {
            creator_type: "va",
            creator_id: userId,
            creator_display_name: data?.full_name || data?.email || "Virtual Assistant",
            creator_bank_name: data?.bank_name || null,
            creator_bank_account_name: data?.bank_account_name || null,
            creator_bank_account_number: data?.bank_account_number || null,
            creator_bank_account_type: data?.bank_account_type || null,
            creator_bank_branch: data?.bank_branch || null,
            creator_bank_swift_code: data?.bank_swift_code || null,
            creator_bank_notes: data?.bank_notes || null,
        };
    }

    async function handleGenerate(e) {
        e.preventDefault();

        setMessage({ type: "", text: "" });

        const validationError = validate();

        if (validationError) {
            setMessage({ type: "error", text: validationError });
            return;
        }

        setGenerating(true);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                throw new Error("User session not found.");
            }

            const clientForInvoice = await getFreshClient();

            if (!clientForInvoice) {
                throw new Error("Selected client was not found.");
            }

            const invoiceCurrency = normalizeCurrency(clientForInvoice.currency);
            const creatorBankSnapshot = await getCreatorBankSnapshot(
                user.id,
                clientForInvoice
            );

            let invoiceItems = [];
            let timeLogs = [];

            if (isVA) {
                timeLogs = await fetchBillableTimeLogs(user.id);

                if (timeLogs.length === 0) {
                    throw new Error(
                        "No uninvoiced billable time logs found for this client and date range."
                    );
                }

                invoiceItems = buildItemsFromTimeLogs(timeLogs, clientForInvoice);
            }

            if (isAgency) {
                invoiceItems = buildManualItems();
            }

            const subtotal = invoiceItems.reduce((sum, item) => {
                return sum + Number(item.amount || 0);
            }, 0);

            const tax = 0;
            const total = subtotal + tax;

            const publicToken = crypto.randomUUID().replaceAll("-", "");
            const publicLink = `${window.location.origin}/public-invoice/${publicToken}`;

            const invoicePayload = {
                user_id: isVA ? user.id : null,
                created_by: user.id,
                organization_id: isAgency
                    ? organizationId
                    : selectedClient?.recipient_type === "agency"
                        ? selectedClient.recipient_id
                        : clientForInvoice?.organization_id || null,

                client_id:
                    selectedClient?.recipient_type === "agency"
                        ? null
                        : form.client_id,
                currency: invoiceCurrency || "USD",
                invoice_number: generateInvoiceNumber(),
                public_token: publicToken,
                payment_link: publicLink,
                period_start: form.start_date || null,
                period_end: form.end_date || null,
                due_date: form.due_date || null,
                total_amount: total,
                tax,
                status: form.status,
                notes: form.notes || null,
                creator_type: creatorBankSnapshot.creator_type,
                creator_id: creatorBankSnapshot.creator_id,
                creator_display_name: creatorBankSnapshot.creator_display_name,
                creator_bank_name: creatorBankSnapshot.creator_bank_name,
                creator_bank_account_name: creatorBankSnapshot.creator_bank_account_name,
                creator_bank_account_number: creatorBankSnapshot.creator_bank_account_number,
                creator_bank_account_type: creatorBankSnapshot.creator_bank_account_type,
                creator_bank_branch: creatorBankSnapshot.creator_bank_branch,
                creator_bank_swift_code: creatorBankSnapshot.creator_bank_swift_code,
                creator_bank_notes: creatorBankSnapshot.creator_bank_notes,
                payment_method: "bank_transfer",

                bill_to_type: isVA
                    ? selectedClient?.recipient_type || "client"
                    : "client",

                bill_to_client_id:
                    isAgency || selectedClient?.recipient_type === "client"
                        ? form.client_id
                        : null,

                bill_to_organization_id:
                    isVA && selectedClient?.recipient_type === "agency"
                        ? selectedClient.recipient_id
                        : null,

                va_connection_id: selectedClient?.va_connection_id || null,
            };

            const { data: invoice, error: invoiceError } = await supabase
                .from("invoices")
                .insert({
                    user_id: isVA ? user.id : null,
                    created_by: user.id,
                    organization_id: isAgency
                        ? organizationId
                        : selectedClient?.organization_id || null,
                    client_id: form.client_id,
                    bill_to_type: "client",
                    bill_to_client_id: form.client_id,
                    currency: selectedClient?.currency || "USD",
                    invoice_number: generateInvoiceNumber(),
                    public_token: publicToken,
                    payment_link: publicLink,
                    period_start: form.start_date || null,
                    period_end: form.end_date || null,
                    due_date: form.due_date || null,
                    total_amount: total,
                    tax,
                    status: form.status,
                    notes: form.notes || null,
                })
                .select("*")
                .single();

            if (invoiceError) throw invoiceError;

            /*
              VA invoice:
              - Source of truth is time_logs.
              - Do NOT create invoice_items.
              - Link the selected time logs to the invoice.
            */
            if (isVA && timeLogs.length > 0) {
                const logIds = timeLogs.map((log) => log.id);

                const { error: logsError } = await supabase
                    .from("time_logs")
                    .update({
                        invoiced: true,
                        invoice_id: invoice.id,
                        currency: invoiceCurrency,
                    })
                    .in("id", logIds);

                if (logsError) throw logsError;
            }

            /*
              Agency invoice:
              - Source of truth is invoice_items.
              - Do NOT touch time_logs.
            */
            if (isAgency) {
                const invoiceItemsPayload = invoiceItems.map((item) => ({
                    invoice_id: invoice.id,
                    time_log_id: null,
                    description: item.description,
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: item.amount,
                }));

                const { error: itemsError } = await supabase
                    .from("invoice_items")
                    .insert(invoiceItemsPayload);

                if (itemsError) throw itemsError;
            }

            const generatedInvoice = {
                ...invoice,
                client: clientForInvoice,
                clients: clientForInvoice,
                currency: invoice.currency || clientForInvoice?.currency || "USD",
                subtotal,
                tax,
                total,
                };

            resetForm();

            if (onGenerated) {
                onGenerated(generatedInvoice);
            }
        } catch (error) {
            setMessage({
                type: "error",
                text: error.message || "Unable to generate invoice.",
            });
        }

        setGenerating(false);
    }

    return (
        <AppDialog
            open={open}
            title={isAgency ? "Create Agency Invoice" : "Generate VA Invoice"}
            description={
                isAgency
                    ? "Create an agency invoice using manual invoice items."
                    : "Create a VA invoice from uninvoiced billable time logs."
            }
            onClose={onClose}
        >
            <form onSubmit={handleGenerate} className="space-y-5">
                {message.text && (
                    <div
                        className={`rounded-2xl border px-4 py-3 text-sm ${message.type === "error"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-green-200 bg-green-50 text-green-700"
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Client
                    </label>

                    <select
                        name="client_id"
                        value={form.client_id}
                        onChange={updateForm}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                        <option value="">Select client</option>
                        {clients.map((client) => {
                            const currency = normalizeCurrency(client.currency);

                            return (
                                <option key={client.id} value={client.id}>
                                    {client.name} · {currency} ·{" "}
                                    {formatMoney(client.hourly_rate || 0, currency)}/hr
                                </option>
                            );
                        })}
                    </select>

                    {selectedClient && (
                        <p className="mt-2 text-xs text-slate-500">
                            Currency:{" "}
                            <span className="font-semibold text-slate-700">
                                {selectedCurrency}
                            </span>
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DateField
                        label={isVA ? "Start Date" : "Period Start"}
                        name="start_date"
                        value={form.start_date}
                        onChange={updateForm}
                        required={isVA}
                    />

                    <DateField
                        label={isVA ? "End Date" : "Period End"}
                        name="end_date"
                        value={form.end_date}
                        onChange={updateForm}
                        required={isVA}
                    />

                    <DateField
                        label="Due Date"
                        name="due_date"
                        value={form.due_date}
                        onChange={updateForm}
                    />

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                            Status
                        </label>

                        <select
                            name="status"
                            value={form.status}
                            onChange={updateForm}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        >
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                        </select>
                    </div>
                </div>

                {isVA && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <div className="flex items-start gap-3">
                            <CalendarDays className="mt-0.5 text-blue-600" size={20} />

                            <div>
                                <p className="text-sm font-semibold text-blue-900">
                                    VA invoice rule
                                </p>
                                <p className="mt-1 text-sm text-blue-700">
                                    This invoice will use billable time logs with{" "}
                                    <strong>invoiced = false</strong> inside the selected date
                                    range. The generated invoice will link those logs through{" "}
                                    <strong>time_logs.invoice_id</strong>.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {isAgency && (
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Invoice Items
                                </h3>
                                <p className="text-sm text-slate-500">
                                    Add manual line items for this agency invoice.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={addManualItem}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                <Plus size={16} />
                                Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {manualItems.map((item, index) => {
                                const amount =
                                    Number(item.quantity || 0) * Number(item.rate || 0);

                                return (
                                    <div
                                        key={index}
                                        className="rounded-2xl border border-slate-200 bg-white p-4"
                                    >
                                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_110px_130px_130px_44px] lg:items-end">
                                            <div>
                                                <label className="mb-2 block text-xs font-semibold text-slate-500">
                                                    Description
                                                </label>

                                                <input
                                                    value={item.description}
                                                    onChange={(e) =>
                                                        updateManualItem(
                                                            index,
                                                            "description",
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="Example: Website maintenance"
                                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-xs font-semibold text-slate-500">
                                                    Qty
                                                </label>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.quantity}
                                                    onChange={(e) =>
                                                        updateManualItem(index, "quantity", e.target.value)
                                                    }
                                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-xs font-semibold text-slate-500">
                                                    Rate
                                                </label>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.rate}
                                                    onChange={(e) =>
                                                        updateManualItem(index, "rate", e.target.value)
                                                    }
                                                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-2 block text-xs font-semibold text-slate-500">
                                                    Amount
                                                </label>

                                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                                                    {formatCurrency(amount)}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeManualItem(index)}
                                                disabled={manualItems.length === 1}
                                                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-end border-t border-slate-200 pt-3">
                            <div className="text-right">
                                <p className="text-sm text-slate-500">Manual Total</p>
                                <p className="text-xl font-bold text-slate-900">
                                    {formatCurrency(manualTotal)}
                                </p>
                                <p className="text-xs font-medium text-slate-400">
                                    {selectedCurrency}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Notes
                    </label>

                    <textarea
                        name="notes"
                        value={form.notes}
                        onChange={updateForm}
                        rows={4}
                        className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        disabled={generating}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {generating ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                {isAgency ? "Creating..." : "Generating..."}
                            </>
                        ) : (
                            <>
                                <Wand2 size={18} />
                                {isAgency ? "Create Agency Invoice" : "Generate VA Invoice"}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </AppDialog>
    );
}

function DateField({ label, name, value, onChange, required = false }) {
    return (
        <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </label>

            <input
                type="date"
                name={name}
                value={value}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
        </div>
    );
}

function normalizeCurrency(currency) {
    return currency?.trim()?.toUpperCase() || "USD";
}