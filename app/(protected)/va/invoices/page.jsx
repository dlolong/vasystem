"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Wallet,
    Clock,
    Wand2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";

import GenerateInvoiceDialog from "@/components/invoices/GenerateInvoiceDialog";
import InvoicePreviewDialog from "@/components/invoices/InvoicePreviewDialog";
import InvoiceListItem from "@/components/invoices/InvoiceListItem";
import { formatMoney } from "@/lib/currency";
import BankAccountSettings from "@/components/settings/BankAccountSettings";

const PAGE_SIZE = 10;

export default function VaInvoicesPage() {
    const { showToast } = useAppContext();

    const [user, setUser] = useState(null);
    const [organizationId, setOrganizationId] = useState(null);

    const [clients, setClients] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [totalInvoices, setTotalInvoices] = useState(0);

    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    const [showGenerateDialog, setShowGenerateDialog] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [recipients, setRecipients] = useState([]);

    const totalPages = useMemo(() => {
        return Math.max(Math.ceil(totalInvoices / PAGE_SIZE), 1);
    }, [totalInvoices]);

    const summary = useMemo(() => {
        const unpaidInvoices = invoices.filter(
            (invoice) =>
                invoice.status !== "paid" && invoice.status !== "cancelled"
        );

        return {
            visibleTotals: groupTotalsByInvoiceCurrency(invoices),
            unpaidTotals: groupTotalsByInvoiceCurrency(unpaidInvoices),
            unpaidCount: unpaidInvoices.length,
        };
    }, [invoices]);

    useEffect(() => {
        loadUserAndClients();
    }, []);

    useEffect(() => {
        if (user) {
            loadInvoices();
        }
    }, [user, page]);

    async function loadUserAndClients() {
        setLoading(true);

        const {
            data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
            setLoading(false);
            return;
        }

        setUser(authUser);

        const { data: membership } = await supabase
            .from("memberships")
            .select("organization_id")
            .eq("user_id", authUser.id)
            .eq("status", "active")
            .maybeSingle();

        const { data: userRow } = await supabase
            .from("users")
            .select("organization_id")
            .eq("id", authUser.id)
            .maybeSingle();

        const orgId =
            membership?.organization_id || userRow?.organization_id || null;

        setOrganizationId(orgId);

       await loadInvoiceRecipients(authUser.id, authUser.email, orgId);

        setLoading(false);
    }

   async function loadInvoiceRecipients(userId, email, orgId = null) {
  const ownedClientsQuery = supabase
    .from("clients")
    .select(
      `
      id,
      name,
      email,
      currency,
      hourly_rate,
      organization_id,
      user_id,
      status
    `
    )
    .eq("user_id", userId)
    .eq("status", "active");

  const connectionsQuery = supabase
    .from("va_connections")
    .select(
      `
      id,
      connection_type,
      organization_id,
      client_id,
      hourly_rate,
      currency,
      status,
      organizations (
        id,
        name
      ),
      clients (
        id,
        name,
        email,
        currency,
        hourly_rate
      )
    `
    )
    .or(`va_user_id.eq.${userId},va_email.eq.${email}`)
    .eq("status", "active");

  const [ownedClientsResult, connectionsResult] = await Promise.all([
    ownedClientsQuery,
    connectionsQuery,
  ]);

  if (ownedClientsResult.error) {
    showToast(ownedClientsResult.error.message, "error");
  }

  if (connectionsResult.error) {
    showToast(connectionsResult.error.message, "error");
  }

  const ownedClientRecipients = (ownedClientsResult.data || []).map(
    (client) => ({
      ...client,
      recipient_type: "client",
      recipient_id: client.id,
      va_connection_id: null,
      name: client.name,
      currency: normalizeCurrency(client.currency),
      hourly_rate: Number(client.hourly_rate || 0),
    })
  );

  const connectedRecipients = (connectionsResult.data || []).map(
    (connection) => {
      if (connection.connection_type === "agency") {
        return {
          id: connection.organization_id,
          recipient_type: "agency",
          recipient_id: connection.organization_id,
          va_connection_id: connection.id,
          name: connection.organizations?.name || "Agency",
          email: null,
          currency: normalizeCurrency(connection.currency),
          hourly_rate: Number(connection.hourly_rate || 0),
          organization_id: connection.organization_id,
        };
      }

      return {
        id: connection.client_id,
        recipient_type: "client",
        recipient_id: connection.client_id,
        va_connection_id: connection.id,
        name: connection.clients?.name || "Client",
        email: connection.clients?.email || null,
        currency: normalizeCurrency(
          connection.currency || connection.clients?.currency
        ),
        hourly_rate: Number(
          connection.hourly_rate || connection.clients?.hourly_rate || 0
        ),
        organization_id: connection.clients?.organization_id || null,
      };
    }
  );

  setRecipients([...ownedClientRecipients, ...connectedRecipients]);
}

async function loadInvoices() {
  if (!user) return;

  setLoading(true);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("invoices")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    showToast(error.message, "error");
    setInvoices([]);
    setTotalInvoices(0);
    setLoading(false);
    return;
  }

  const invoicesWithClients = await attachClientsToInvoices(data || []);

  setInvoices(invoicesWithClients);
  setTotalInvoices(count || 0);
  setLoading(false);
}

async function attachClientsToInvoices(invoiceRows = []) {
  const clientIds = [
    ...new Set(
      invoiceRows
        .map((invoice) => invoice.client_id || invoice.bill_to_client_id)
        .filter(Boolean)
    ),
  ];

  if (clientIds.length === 0) {
    return invoiceRows.map((invoice) => ({
      ...invoice,
      client: null,
      clients: null,
      currency: normalizeCurrency(invoice.currency),
    }));
  }

  const { data: clientRows, error } = await supabase
    .from("clients")
    .select(
      `
      id,
      name,
      email,
      phone,
      company_name,
      billing_address,
      currency,
      hourly_rate
    `
    )
    .in("id", clientIds);

  if (error) {
    showToast(error.message, "error");

    return invoiceRows.map((invoice) => ({
      ...invoice,
      client: null,
      clients: null,
      currency: normalizeCurrency(invoice.currency),
    }));
  }

  const clientsById = (clientRows || []).reduce((map, client) => {
    map[client.id] = {
      ...client,
      currency: normalizeCurrency(client.currency),
    };

    return map;
  }, {});

  return invoiceRows.map((invoice) => {
    const clientId = invoice.client_id || invoice.bill_to_client_id;
    const client = clientsById[clientId] || null;

    return {
      ...invoice,
      currency: normalizeCurrency(invoice.currency || client?.currency),
      client,
      clients: client,
    };
  });
}

    async function updateInvoiceStatus(invoiceId, status) {
        const {
            data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
            showToast("User session not found.", "error");
            return;
        }

        const { error } = await supabase
            .from("invoices")
            .update({ status })
            .eq("id", invoiceId)
            .eq("user_id", authUser.id);

        if (error) {
            showToast(error.message, "error");
            return;
        }

        showToast("Invoice status updated.", "success");

        setInvoices((prev) =>
            prev.map((invoice) =>
                invoice.id === invoiceId ? { ...invoice, status } : invoice
            )
        );
    }

    function formatDate(date) {
        if (!date) return "No due date";

        return new Date(date).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    function handleGeneratedInvoice(invoice) {
        const currency =
            invoice?.currency ||
            invoice?.client?.currency ||
            invoice?.clients?.currency ||
            "USD";

        const normalizedInvoice = {
            ...invoice,
            currency: normalizeCurrency(currency),
            client: invoice.client
                ? {
                    ...invoice.client,
                    currency: normalizeCurrency(invoice.client.currency),
                }
                : invoice.client,
            clients: invoice.clients
                ? {
                    ...invoice.clients,
                    currency: normalizeCurrency(invoice.clients.currency),
                }
                : invoice.clients,
        };

        setShowGenerateDialog(false);
        setSelectedInvoice(normalizedInvoice);
        setPage(1);
        loadInvoices();
    }

    return (
       <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
            <GenerateInvoiceDialog
  open={showGenerateDialog}
  mode="va"
  clients={recipients}
  onClose={() => setShowGenerateDialog(false)}
  onGenerated={(invoice) => {
    setShowGenerateDialog(false);
    setSelectedInvoice(invoice);
    loadInvoices();
  }}
/>

            <InvoicePreviewDialog
                open={!!selectedInvoice}
                invoice={selectedInvoice}
                onClose={() => setSelectedInvoice(null)}
            />

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
                    <p className="text-sm text-slate-500">
                        Create, track, and manage invoices for your VA clients.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setShowGenerateDialog(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                    <Wand2 size={18} />
                    Generate Invoice
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                    title="Visible Total"
                    value={<CurrencyTotals totals={summary.visibleTotals} />}
                    description="Invoices on this page"
                    icon={<FileText size={20} />}
                />

                <StatCard
                    title="Unpaid Amount"
                    value={<CurrencyTotals totals={summary.unpaidTotals} />}
                    description="Unpaid on this page"
                    icon={<Wallet size={20} />}
                />

                <StatCard
                    title="Unpaid Invoices"
                    value={summary.unpaidCount}
                    description="Waiting for payment"
                    icon={<Clock size={20} />}
                />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                        <h2 className="text-lg font-semibold text-slate-900">
                            Invoice List
                        </h2>
                        <p className="text-sm text-slate-500">
                            Each invoice displays using its saved invoice currency.
                        </p>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-sm text-slate-500">
                            Loading invoices...
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-sm text-slate-500">No invoices yet.</p>

                            <button
                                type="button"
                                onClick={() => setShowGenerateDialog(true)}
                                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                <Wand2 size={18} />
                                Generate Invoice
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {invoices.map((invoice) => (
                                <InvoiceListItem
                                    key={invoice.id}
                                    invoice={invoice}
                                    formatDate={formatDate}
                                    onView={setSelectedInvoice}
                                    onStatusChange={updateInvoiceStatus}
                                />
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
                        <p className="text-sm text-slate-500">
                            Page {page} of {totalPages} · {totalInvoices} invoice
                            {totalInvoices === 1 ? "" : "s"}
                        </p>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <ChevronLeft size={16} />
                                Prev
                            </button>

                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </section>

                <div className="xl:sticky xl:top-24 xl:self-start">
                    <BankAccountSettings mode="va" compact />
                </div>
            </div>

        </main>
    );
}

function normalizeCurrency(currency) {
    return currency?.trim()?.toUpperCase() || "USD";
}

function getInvoiceCurrency(invoice) {
    return normalizeCurrency(
        invoice?.currency ||
        invoice?.clients?.currency ||
        invoice?.client?.currency ||
        "USD"
    );
}

function groupTotalsByInvoiceCurrency(invoices = []) {
    return invoices.reduce((totals, invoice) => {
        const currency = getInvoiceCurrency(invoice);
        const amount = Number(invoice.total_amount || 0);

        if (!totals[currency]) {
            totals[currency] = 0;
        }

        totals[currency] += amount;

        return totals;
    }, {});
}

function CurrencyTotals({ totals }) {
    const entries = Object.entries(totals || {});

    if (entries.length === 0) {
        return (
            <div className="text-left">
                <p className="font-bold text-slate-900">{formatMoney(0, "USD")}</p>
                <p className="text-xs font-medium text-slate-400">USD</p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {entries.map(([currency, amount]) => (
                <div key={currency} className="text-left">
                    <p className="font-bold text-slate-900">
                        {formatMoney(amount, currency)}
                    </p>
                    <p className="text-xs font-medium text-slate-400">{currency}</p>
                </div>
            ))}
        </div>
    );
}

function StatCard({ title, value, description, icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500">{title}</p>

                    <div className="mt-3 text-2xl font-bold text-slate-900">
                        {value}
                    </div>

                    <p className="mt-1 text-sm text-slate-400">{description}</p>
                </div>

                <div className="shrink-0 text-blue-600">{icon}</div>
            </div>
        </div>
    );
}