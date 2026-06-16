"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  FileText,
  Wallet,
  Clock,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";

const PAGE_SIZE = 8;

const statusOptions = [
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
  { label: "Cancelled", value: "cancelled" },
];

export default function ClientInvoicesPage() {
  const { showToast } = useAppContext();

  const [authUser, setAuthUser] = useState(null);
  const [clientRecord, setClientRecord] = useState(null);

  const [invoices, setInvoices] = useState([]);
  const [totalInvoices, setTotalInvoices] = useState(0);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const totalPages = useMemo(() => {
    return Math.max(Math.ceil(totalInvoices / PAGE_SIZE), 1);
  }, [totalInvoices]);

  const summary = useMemo(() => {
    const visibleTotal = invoices.reduce((sum, invoice) => {
      return sum + Number(invoice.total_amount || 0);
    }, 0);

    const unpaidAmount = invoices.reduce((sum, invoice) => {
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
      unpaidAmount,
      unpaidCount,
    };
  }, [invoices]);

  useEffect(() => {
    loadClient();
  }, []);

  useEffect(() => {
    if (clientRecord?.id) {
      loadInvoices();
    }
  }, [clientRecord, page, search, statusFilter]);

  async function loadClient() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setAuthUser(user);

    const { data: userRow } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const orgId = userRow?.organization_id || null;

    let foundClient = null;

    const { data: clientByUser } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user.id)
      .limit(1);

    if (clientByUser?.length > 0) {
      foundClient = clientByUser[0];
    }

    if (!foundClient && user.email) {
      let emailQuery = supabase
        .from("clients")
        .select("*")
        .eq("email", user.email)
        .limit(1);

      if (orgId) {
        emailQuery = emailQuery.eq("organization_id", orgId);
      }

      const { data: clientByEmail } = await emailQuery;

      if (clientByEmail?.length > 0) {
        foundClient = clientByEmail[0];
      }
    }

    setClientRecord(foundClient || null);
    setLoading(false);
  }

  async function loadInvoices() {
    if (!clientRecord?.id) return;

    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("invoices")
      .select("*", { count: "exact" })
      .eq("client_id", clientRecord.id)
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

  if (!loading && !clientRecord) {
    return (
      <main className="space-y-6">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 text-orange-600" size={22} />

            <div>
              <h1 className="text-xl font-bold text-orange-900">
                Client record not found
              </h1>

              <p className="mt-2 text-sm text-orange-700">
                Your login is active, but no client profile is connected to{" "}
                <strong>{authUser?.email}</strong>.
              </p>

              <p className="mt-2 text-sm text-orange-700">
                Ask the agency to add your email as a client.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <div className="flex shrink-0 flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">
            View invoices sent to {clientRecord?.name || "your account"}.
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Visible Total"
          value={formatCurrency(summary.visibleTotal)}
          description="Invoices on this page"
          icon={<FileText size={20} />}
          color="blue"
        />

        <StatCard
          title="Unpaid Amount"
          value={formatCurrency(summary.unpaidAmount)}
          description="Waiting for payment"
          icon={<Wallet size={20} />}
          color="orange"
        />

        <StatCard
          title="Unpaid Invoices"
          value={summary.unpaidCount}
          description="Open balance count"
          icon={<Clock size={20} />}
          color="emerald"
        />
      </div>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="shrink-0 border-b border-slate-200 p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <SkeletonList />
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={<FileText size={24} />}
              title="No invoices found"
              description="There are no invoices assigned to you yet."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[1.2fr_1fr_160px_170px]"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {invoice.invoice_number ||
                        `Invoice ${invoice.id.slice(0, 8)}`}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Created {formatDate(invoice.created_at)}
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

                  <div className="flex items-start lg:justify-end">
                    {invoice.public_token ? (
                      <a
                        href={`/public-invoice/${invoice.public_token}`}
                        target="_blank"
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        View Invoice
                        <ExternalLink size={15} />
                      </a>
                    ) : (
                      <span className="text-sm text-slate-400">
                        No public link
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

function StatCard({ title, value, description, icon, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 border-blue-100 text-blue-600",
    orange: "bg-orange-50 border-orange-100 text-orange-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{value}</h3>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>

        <div className={`rounded-2xl border p-3 ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3 p-5">
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
    <div className="shrink-0 flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages} · {total} {label}
        {total === 1 ? "" : "s"}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}