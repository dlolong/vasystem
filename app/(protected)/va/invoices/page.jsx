"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  Wallet,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import AddInvoiceDialog from "@/components/va/AddInvoiceDialog";

const PAGE_SIZE = 10;

export default function VaInvoicesPage() {
  const { showToast } = useAppContext();

  const [user, setUser] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);

  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [totalInvoices, setTotalInvoices] = useState(0);

  const [loading, setLoading] = useState(true);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = useMemo(() => {
    return Math.max(Math.ceil(totalInvoices / PAGE_SIZE), 1);
  }, [totalInvoices]);

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

    await loadClients(authUser.id, orgId);

    setLoading(false);
  }

  async function loadClients(userId, orgId = null) {
    let query = supabase
      .from("clients")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (orgId) {
      query = query.or(`user_id.eq.${userId},organization_id.eq.${orgId}`);
    } else {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      showToast(error.message, "error");
      setClients([]);
      return;
    }

    setClients(data || []);
  }

  async function loadInvoices() {
    if (!user) return;

    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from("invoices")
      .select(
        `
        *,
        clients (
          id,
          name,
          email,
          hourly_rate
        )
      `,
        { count: "exact" }
      )
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

    setInvoices(data || []);
    setTotalInvoices(count || 0);
    setLoading(false);
  }

  async function updateInvoiceStatus(invoiceId, status) {
    const { error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", invoiceId)
      .eq("user_id", user.id);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Invoice updated.", "success");

    setInvoices((prev) =>
      prev.map((invoice) =>
        invoice.id === invoiceId
          ? {
              ...invoice,
              status,
            }
          : invoice
      )
    );
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

  const summary = useMemo(() => {
    const visibleTotal = invoices.reduce((sum, invoice) => {
      return sum + Number(invoice.total_amount || 0);
    }, 0);

    const unpaidTotal = invoices.reduce((sum, invoice) => {
      if (invoice.status === "paid" || invoice.status === "cancelled") {
        return sum;
      }

      return sum + Number(invoice.total_amount || 0);
    }, 0);

    const unpaidCount = invoices.filter(
      (invoice) =>
        invoice.status !== "paid" && invoice.status !== "cancelled"
    ).length;

    return {
      visibleTotal,
      unpaidTotal,
      unpaidCount,
    };
  }, [invoices]);

  return (
    <main className="space-y-6">
      <AddInvoiceDialog
        open={showInvoiceDialog}
        onClose={() => setShowInvoiceDialog(false)}
        clients={clients}
        onInvoiceAdded={() => {
          setPage(1);
          loadInvoices();
        }}
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
          onClick={() => setShowInvoiceDialog(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Visible Total"
          value={formatCurrency(summary.visibleTotal)}
          description="Invoices on this page"
          icon={<FileText size={20} />}
        />

        <StatCard
          title="Unpaid Amount"
          value={formatCurrency(summary.unpaidTotal)}
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
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Invoice List
          </h2>
          <p className="text-sm text-slate-500">
            Your invoices are sorted by newest first.
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
              onClick={() => setShowInvoiceDialog(true)}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add your first invoice
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[1.2fr_1fr_140px_160px]"
              >
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {invoice.invoice_number ||
                      `Invoice ${invoice.id.slice(0, 8)}`}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {invoice.clients?.name || "No client"}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    Due: {formatDate(invoice.due_date)}
                  </p>

                </div>

                <div>
                  <p className="text-sm text-slate-500">Amount</p>
                  <p className="font-semibold text-slate-900">
                    {formatCurrency(invoice.total_amount)}
                  </p>

                  {invoice.payment_link && (
                    <a
                      href={invoice.payment_link}
                      target="_blank"
                      className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
                    >
                      Open payment link
                    </a>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm text-slate-500">Status</p>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(
                      invoice.status
                    )}`}
                  >
                    {invoice.status || "draft"}
                  </span>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-500">
                    Update Status
                  </label>

                  <select
                    value={invoice.status || "draft"}
                    onChange={(e) =>
                      updateInvoiceStatus(invoice.id, e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {invoice.public_token && (
  <a
    href={`/public-invoice/${invoice.public_token}`}
    target="_blank"
    className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
  >
    View public invoice
  </a>
)}
              </div>
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
    </main>
  );
}

function StatCard({ title, value, description, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className="text-blue-600">{icon}</div>
      </div>

      <h3 className="mt-3 text-2xl font-bold text-slate-900">{value}</h3>

      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}