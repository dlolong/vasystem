"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  FileText,
  Wallet,
  Clock,
  ExternalLink,
  AlertCircle,
  CheckCircle2, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import { formatMoney } from "@/lib/currency";

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
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);

  const selectedCurrency = normalizeCurrency(clientRecord?.currency);

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
  }, [clientRecord?.id, page, search, statusFilter]);

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
      .select(
        `
        id,
        name,
        email,
        currency,
        organization_id,
        user_id,
        status
      `
      )
      .eq("user_id", user.id)
      .limit(1);

    if (clientByUser?.length > 0) {
      foundClient = clientByUser[0];
    }

    if (!foundClient && user.email) {
      let emailQuery = supabase
        .from("clients")
        .select(
          `
          id,
          name,
          email,
          currency,
          organization_id,
          user_id,
          status
        `
        )
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

    setClientRecord(
      foundClient
        ? {
            ...foundClient,
            currency: normalizeCurrency(foundClient.currency),
          }
        : null
    );

    setLoading(false);
  }

  async function loadInvoices() {
    if (!clientRecord?.id) return;

    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

   let query = supabase
  .from("invoices")
  .select(
    `
    id,
    invoice_number,
    total_amount,
    status,
    due_date,
    public_token,
    payment_link,
    created_at,
    client_id,
    currency,
    creator_type,
    creator_id,
    creator_display_name,
    creator_bank_name,
    creator_bank_account_name,
    creator_bank_account_number,
    creator_bank_account_type,
    creator_bank_branch,
    creator_bank_swift_code,
    creator_bank_notes,
    payment_method,
    payment_reference,
    payment_notes,
    paid_at
  `,
    { count: "exact" }
  )
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

    setInvoices(
      (data || []).map((invoice) => ({
        ...invoice,
        currency: normalizeCurrency(invoice.currency || clientRecord.currency),
      }))
    );

    setTotalInvoices(count || 0);
    setLoading(false);
  }

  async function markInvoicePaid(invoice) {
  if (!invoice?.id) return;

  const reference = window.prompt(
    "Enter your bank transfer reference number, receipt number, or note:"
  );

  if (reference === null) return;

  setPayingInvoiceId(invoice.id);

  const { data, error } = await supabase.rpc("mark_invoice_paid", {
    p_invoice_id: invoice.id,
    p_payment_reference: reference,
    p_payment_notes: "Marked as paid by client.",
  });

  if (error) {
    showToast(error.message, "error");
    setPayingInvoiceId(null);
    return;
  }

  showToast("Invoice marked as paid.", "success");

  setInvoices((prev) =>
    prev.map((item) =>
      item.id === invoice.id
        ? {
            ...item,
            ...data,
            status: "paid",
            payment_reference: reference,
            paid_at: new Date().toISOString(),
          }
        : item
    )
  );

  setPayingInvoiceId(null);
}

const creatorGroups = useMemo(() => {
  const groups = {};

  invoices.forEach((invoice) => {
    const type = invoice.creator_type || (invoice.user_id ? "va" : "agency");
    const name =
      invoice.creator_display_name ||
      (type === "va" ? "Virtual Assistant" : "Agency");

    const key = `${type}-${invoice.creator_id || name}`;

    if (!groups[key]) {
      groups[key] = {
        key,
        type,
        name,
        bank: {
          bank_name: invoice.creator_bank_name,
          bank_account_name: invoice.creator_bank_account_name,
          bank_account_number: invoice.creator_bank_account_number,
          bank_account_type: invoice.creator_bank_account_type,
          bank_branch: invoice.creator_bank_branch,
          bank_swift_code: invoice.creator_bank_swift_code,
          bank_notes: invoice.creator_bank_notes,
        },
        invoices: [],
      };
    }

    groups[key].invoices.push(invoice);
  });

  return Object.values(groups);
}, [invoices]);

  function formatCurrency(amount) {
    return formatMoney(amount, selectedCurrency);
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
    <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
      <div className="flex shrink-0 flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">
            View invoices sent to {clientRecord?.name || "your account"}.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Selected Currency
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-900">
            {selectedCurrency}
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Amounts are displayed using your client currency.
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Visible Total"
          value={formatCurrency(summary.visibleTotal)}
          description={`Invoices on this page in ${selectedCurrency}`}
          icon={<FileText size={20} />}
          color="blue"
        />

        <StatCard
          title="Unpaid Amount"
          value={formatCurrency(summary.unpaidAmount)}
          description={`Waiting for payment in ${selectedCurrency}`}
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

      <section className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
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

        <div className="">
          {loading ? (
            <SkeletonList />
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={<FileText size={24} />}
              title="No invoices found"
              description="There are no invoices assigned to you yet."
            />
          ) : (
           <div className="space-y-5 p-5">
  {creatorGroups.map((group) => (
    <section
      key={group.key}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.type === "va" ? "Virtual Assistant" : "Agency"}
            </p>

            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {group.name}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {group.invoices.length} invoice
              {group.invoices.length === 1 ? "" : "s"} created
            </p>
          </div>

          <BankMiniDetails bank={group.bank} />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {group.invoices.map((invoice) => {
          const invoiceCurrency = normalizeCurrency(
            clientRecord?.currency || invoice.currency
          );

          return (
            <div
              key={invoice.id}
              className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[1.3fr_1fr_150px_230px]"
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

                {invoice.payment_reference && (
                  <p className="mt-2 text-xs font-medium text-green-700">
                    Payment ref: {invoice.payment_reference}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm text-slate-500">Amount</p>
                <p className="font-semibold text-slate-900">
                  {formatMoney(invoice.total_amount, invoiceCurrency)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {invoiceCurrency}
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

              <div className="flex flex-col gap-2 lg:items-end">
                {invoice.public_token && (
                  <a
                    href={`/public-invoice/${invoice.public_token}`}
                    target="_blank"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View Invoice
                    <ExternalLink size={15} />
                  </a>
                )}

                {invoice.status !== "paid" &&
                  invoice.status !== "cancelled" && (
                    <button
                      type="button"
                      onClick={() => markInvoicePaid(invoice)}
                      disabled={payingInvoiceId === invoice.id}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {payingInvoiceId === invoice.id ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} />
                          I Paid This
                        </>
                      )}
                    </button>
                  )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
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

function normalizeCurrency(currency) {
  return currency?.trim()?.toUpperCase() || "USD";
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
    <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
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

function BankMiniDetails({ bank }) {
  const hasBank =
    bank?.bank_name || bank?.bank_account_name || bank?.bank_account_number;

  if (!hasBank) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
        No bank details provided yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
      <p className="font-semibold text-blue-700">Bank Transfer Details</p>

      {bank.bank_name && <p className="mt-1">Bank: {bank.bank_name}</p>}
      {bank.bank_account_name && (
        <p>Account Name: {bank.bank_account_name}</p>
      )}
      {bank.bank_account_number && (
        <p>Account No: {bank.bank_account_number}</p>
      )}
      {bank.bank_account_type && <p>Type: {bank.bank_account_type}</p>}
      {bank.bank_branch && <p>Branch: {bank.bank_branch}</p>}
      {bank.bank_swift_code && <p>Code: {bank.bank_swift_code}</p>}

      {bank.bank_notes && (
        <p className="mt-2 whitespace-pre-line text-blue-800">
          {bank.bank_notes}
        </p>
      )}
    </div>
  );
}
