"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  Wallet,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useAppContext } from "@/context/AppContext";
import AppDialog from "@/components/ui/AppDialog";

import { Eye, Wand2 } from "lucide-react";
import GenerateInvoiceDialog from "@/components/invoices/GenerateInvoiceDialog";
import InvoicePreviewDialog from "@/components/invoices/InvoicePreviewDialog";
import InvoiceListItem from "@/components/invoices/InvoiceListItem";
import { formatMoney, groupTotalsByCurrency } from "@/lib/currency";
const PAGE_SIZE = 8;

const statusOptions = [
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
  { label: "Cancelled", value: "cancelled" },
];

export default function AgencyInvoicesPage() {
  const { profile } = useAuthUser();
  const { showToast } = useAppContext();

  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [totalInvoices, setTotalInvoices] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [showAddDialog, setShowAddDialog] = useState(false);

  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [form, setForm] = useState({
    client_id: "",
    invoice_number: "",
    total_amount: "",
    status: "draft",
    due_date: "",
    notes: "",
  });

  const totalPages = useMemo(() => {
    return Math.max(Math.ceil(totalInvoices / PAGE_SIZE), 1);
  }, [totalInvoices]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadClients();
      loadInvoices();
    }
  }, [profile, page, search, statusFilter]);

  async function loadClients() {
    if (!profile?.organization_id) return;

    const { data } = await supabase
      .from("clients")
      .select("id, name, email, currency")
      .eq("organization_id", profile.organization_id)
      .eq("status", "active")
      .order("name", { ascending: true });

    setClients(data || []);
  }

  async function loadInvoices() {
    if (!profile?.organization_id) return;

    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("invoices")
      .select(
        `
        *,
       clients (
            id,
            name,
            email,
            currency,
            hourly_rate
          )
      `,
        { count: "exact" }
      )
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search.trim()) {
      query = query.or(`invoice_number.ilike.%${search.trim()}%`);
    }

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error, count } = await query;

    if (error) {
      showToast(error.message, "error");
      setInvoices([]);
      setTotalInvoices(0);
      setLoading(false);
      return;
    }

    setInvoices(data || []);
    setTotalInvoices(count || 0);
    setLoading(false);
  }

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
      invoice_number: "",
      total_amount: "",
      status: "draft",
      due_date: "",
      notes: "",
    });
  }

  function generateInvoiceNumber() {
    return `INV-${Date.now().toString().slice(-8)}`;
  }

  async function addInvoice(e) {
    e.preventDefault();

    if (!profile?.organization_id) {
      showToast("Agency organization not found.", "error");
      return;
    }

    if (!form.client_id) {
      showToast("Please select a client.", "error");
      return;
    }

    if (!form.total_amount || Number(form.total_amount) <= 0) {
      showToast("Invoice amount is required.", "error");
      return;
    }

    setAdding(true);

    const publicToken = crypto.randomUUID().replaceAll("-", "");
    const publicLink = `${window.location.origin}/public-invoice/${publicToken}`;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        organization_id: profile.organization_id,
        user_id: null,
        created_by: profile.id,
        client_id: form.client_id,
        public_token: publicToken,
        payment_link: publicLink,
        invoice_number: form.invoice_number || generateInvoiceNumber(),
        total_amount: Number(form.total_amount || 0),
        tax: 0,
        status: form.status,
        due_date: form.due_date || null,
        notes: form.notes || null,
      })
      .select()
      .single();

    if (error) {
      showToast(error.message, "error");
      setAdding(false);
      return;
    }

    await supabase.from("invoice_items").insert({
      invoice_id: invoice.id,
      description: form.notes || "Agency services",
      quantity: 1,
      rate: Number(form.total_amount || 0),
      amount: Number(form.total_amount || 0),
    });

    showToast("Invoice added successfully.", "success");

    resetForm();
    setShowAddDialog(false);
    setPage(1);
    setAdding(false);

    await loadInvoices();
  }

  async function updateInvoiceStatus(invoiceId, status) {
    const { error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", invoiceId)
      .eq("organization_id", profile.organization_id);

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

  function handleSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  }

  function formatDate(date) {
    if (!date) return "No due date";

    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

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

  function CurrencyTotals({ totals }) {
    const entries = Object.entries(totals || {});

    if (entries.length === 0) {
      return <span>$0.00</span>;
    }

    return (
      <div className="space-y-1">
        {entries.map(([currency, amount]) => (
          <div key={currency} className="text-right">
            <p className="font-bold text-slate-900">
              {formatMoney(amount, currency)}
            </p>
            <p className="text-xs font-medium text-slate-400">{currency}</p>
          </div>
        ))}
      </div>
    );
  }

  const summary = useMemo(() => {
    const visibleTotals = groupTotalsByCurrency(invoices);

    const unpaidInvoices = invoices.filter(
      (invoice) =>
        invoice.status !== "paid" && invoice.status !== "cancelled"
    );

    const unpaidTotals = groupTotalsByCurrency(unpaidInvoices);

    return {
      visibleTotals,
      unpaidTotals,
      unpaidCount: unpaidInvoices.length,
    };
  }, [invoices]);

  return (
    <main className="space-y-6">

      <GenerateInvoiceDialog
        open={showGenerateDialog}
        mode="agency"
        organizationId={profile?.organization_id}
        clients={clients}
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

      <AppDialog
        open={showAddDialog}
        title="Add Invoice"
        description="Create a public invoice link for your agency client."
        onClose={() => setShowAddDialog(false)}
      >
        <form onSubmit={addInvoice} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Client
            </label>

            <select
              name="client_id"
              value={form.client_id}
              onChange={updateForm}
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
                onChange={updateForm}
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
                onChange={updateForm}
                placeholder="0"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Status
              </label>

              <select
                name="status"
                value={form.status}
                onChange={updateForm}
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
                onChange={updateForm}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Notes
            </label>

            <textarea
              name="notes"
              value={form.notes}
              onChange={updateForm}
              rows={4}
              placeholder="Invoice notes..."
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowAddDialog(false)}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={adding}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {adding ? "Adding..." : "Add Invoice"}
            </button>
          </div>
        </form>
      </AppDialog>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">
            Create and manage agency client invoices.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setShowGenerateDialog(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Wand2 size={18} />
            Generate Invoice
          </button>
        </div>

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

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search invoice number..."
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All Status</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<FileText size={24} />}
            title="No invoices found"
            description="Add an invoice or try another search keyword."
          />
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

        <Pagination
          page={page}
          totalPages={totalPages}
          total={totalInvoices}
          label="invoice"
          onPrev={() => setPage((prev) => Math.max(prev - 1, 1))}
          onNext={() => setPage((prev) => Math.min(prev + 1, totalPages))}
        />
      </section>
    </main>
  );
}

function StatCard({ title, value, description, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <div className="mt-3 text-2xl font-bold text-slate-900">
            {value}
          </div>

          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>

        <div className="text-blue-600">{icon}</div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="p-5 space-y-3">
      {[1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-2xl bg-slate-100"
        />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        {icon}
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function Pagination({ page, totalPages, total, label, onPrev, onNext }) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages} · {total} {label}
        {total === 1 ? "" : "s"}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={16} />
          Prev
        </button>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}