"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserRound,
  FolderKanban,
  FileText,
  ArrowRight,
  Plus,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useAppContext } from "@/context/AppContext";
import { formatMoney } from "@/lib/currency";

const DEFAULT_CURRENCY = "USD";

function isOnline(lastActive) {
  if (!lastActive) return false;

  const diff = Date.now() - new Date(lastActive).getTime();
  return diff < 60 * 1000;
}

function getRelatedClient(row) {
  if (row?.client) return row.client;
  if (!row?.clients) return null;

  return Array.isArray(row.clients) ? row.clients[0] : row.clients;
}

function getInvoiceCurrency(invoice) {
  const client = getRelatedClient(invoice);

  return (
    invoice?.currency ||
    client?.currency ||
    DEFAULT_CURRENCY
  );
}

function safeFormatMoney(amount, currency = DEFAULT_CURRENCY) {
  const cleanCurrency = currency || DEFAULT_CURRENCY;

  try {
    return formatMoney(Number(amount || 0), cleanCurrency);
  } catch {
    return formatMoney(Number(amount || 0), DEFAULT_CURRENCY);
  }
}

function getInvoiceTotalsByCurrency(invoices, type) {
  const totals = invoices.reduce((acc, invoice) => {
    const status = invoice.status || "draft";

    if (type === "paid" && status !== "paid") return acc;
    if (type === "unpaid" && ["paid", "cancelled"].includes(status)) {
      return acc;
    }

    const currency = getInvoiceCurrency(invoice);
    const currentAmount = Number(invoice.total_amount || 0);

    acc[currency] = (acc[currency] || 0) + currentAmount;
    return acc;
  }, {});

  return Object.entries(totals)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export default function AgencyDashboardPage() {
  const { showToast, profile } = useAppContext();

  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    vas: 0,
    clients: 0,
    projects: 0,
    invoices: 0,
    unpaidTotals: [],
    paidTotals: [],
  });

  const [recentVas, setRecentVas] = useState([]);
  const [recentClients, setRecentClients] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadDashboard();
    } else {
      setLoading(false);
    }
  }, [profile]);

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
    }));
  }

  const clientsById = (clientRows || []).reduce((map, client) => {
    map[client.id] = {
      ...client,
      currency: client.currency || DEFAULT_CURRENCY,
    };

    return map;
  }, {});

  return invoiceRows.map((invoice) => {
    const clientId = invoice.client_id || invoice.bill_to_client_id;
    const client = clientsById[clientId] || null;

    return {
      ...invoice,
      currency: invoice.currency || client?.currency || DEFAULT_CURRENCY,
      client,
      clients: client,
    };
  });
}

  async function loadDashboard() {
    if (!profile?.organization_id) return;

    setLoading(true);

    const orgId = profile.organization_id;

    const [
      vasCountResult,
      clientsCountResult,
      projectsCountResult,
      invoicesCountResult,
      invoicesAmountResult,
      vasResult,
      clientsResult,
      projectsResult,
      invoicesResult,
    ] = await Promise.all([
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("role", "va"),

      supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),

      supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),

      supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),

      supabase
        .from("invoices")
        .select(
          `
    id,
    total_amount,
    status,
    currency,
    client_id,
    bill_to_client_id
  `
        )
        .eq("organization_id", orgId),

      supabase
        .from("users")
        .select("id, email, role, last_active, created_at")
        .eq("organization_id", orgId)
        .eq("role", "va")
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("clients")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("projects")
        .select(
          `
          id,
          name,
          description,
          status,
          created_at,
          clients (
            id,
            name,
            email,
            currency
          )
        `
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("invoices")
        .select(
          `
    id,
    invoice_number,
    total_amount,
    status,
    due_date,
    public_token,
    created_at,
    currency,
    client_id,
    bill_to_client_id
  `
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const errors = [
      vasCountResult.error,
      clientsCountResult.error,
      projectsCountResult.error,
      invoicesCountResult.error,
      invoicesAmountResult.error,
      vasResult.error,
      clientsResult.error,
      projectsResult.error,
      invoicesResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      showToast(errors[0].message, "error");
      setLoading(false);
      return;
    }

    const invoiceAmounts = await attachClientsToInvoices(
      invoicesAmountResult.data || []
    );

    const recentInvoicesWithClients = await attachClientsToInvoices(
      invoicesResult.data || []
    );

    setStats({
      vas: vasCountResult.count || 0,
      clients: clientsCountResult.count || 0,
      projects: projectsCountResult.count || 0,
      invoices: invoicesCountResult.count || 0,
      unpaidTotals: getInvoiceTotalsByCurrency(invoiceAmounts, "unpaid"),
      paidTotals: getInvoiceTotalsByCurrency(invoiceAmounts, "paid"),
    });

    setRecentVas(vasResult.data || []);
    setRecentClients(clientsResult.data || []);
    setRecentProjects(projectsResult.data || []);
    setRecentInvoices(recentInvoicesWithClients);
    setLoading(false);
  }

  function formatDate(date) {
    if (!date) return "No date";

    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getInvoiceBadge(status) {
    const styles = {
      draft: "bg-slate-100 text-slate-700",
      sent: "bg-blue-100 text-blue-700",
      paid: "bg-green-100 text-green-700",
      overdue: "bg-red-100 text-red-700",
      cancelled: "bg-slate-200 text-slate-600",
    };

    return styles[status] || styles.draft;
  }

  function getProjectBadge(status) {
    const styles = {
      active: "bg-green-100 text-green-700",
      paused: "bg-orange-100 text-orange-700",
      completed: "bg-blue-100 text-blue-700",
      archived: "bg-slate-100 text-slate-600",
    };

    return styles[status] || styles.active;
  }

  const onlineVas = useMemo(() => {
    return recentVas.filter((va) => isOnline(va.last_active)).length;
  }, [recentVas]);

  if (!profile?.organization_id && !loading) {
    return (
      <main className="space-y-6">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
          <h1 className="text-xl font-bold text-orange-900">
            Agency workspace not found
          </h1>
          <p className="mt-2 text-sm text-orange-700">
            Your account does not have an organization connected yet.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Agency Dashboard
          </h1>

          <p className="text-sm text-slate-500">
            Monitor your VAs, clients, projects, and invoices in one place.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/agency/vas"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Users size={18} />
            Manage VAs
          </Link>

          <Link
            href="/agency/projects"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={18} />
            Add Project
          </Link>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Virtual Assistants"
              value={stats.vas}
              description={`${onlineVas} recently online`}
              icon={<Users size={20} />}
              color="indigo"
            />

            <StatCard
              title="Clients"
              value={stats.clients}
              description="Agency clients"
              icon={<UserRound size={20} />}
              color="blue"
            />

            <StatCard
              title="Projects"
              value={stats.projects}
              description="Total projects"
              icon={<FolderKanban size={20} />}
              color="violet"
            />

            <StatCard
              title="Invoices"
              value={stats.invoices}
              description="Total invoices"
              icon={<FileText size={20} />}
              color="emerald"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MoneyCard
              title="Unpaid Amount"
              value={<CurrencyTotals totals={stats.unpaidTotals} />}
              description="Grouped by client invoice currency"
              icon={<AlertCircle size={22} />}
              tone="orange"
            />

            <MoneyCard
              title="Paid Amount"
              value={<CurrencyTotals totals={stats.paidTotals} />}
              description="Grouped by client invoice currency"
              icon={<CheckCircle size={22} />}
              tone="green"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DashboardPanel
              title="Recent VAs"
              description="Newest virtual assistants in your agency."
              href="/agency/vas"
            >
              {recentVas.length === 0 ? (
                <EmptyText text="No VAs yet." />
              ) : (
                <div className="space-y-3">
                  {recentVas.map((va) => {
                    const online = isOnline(va.last_active);

                    return (
                      <Link
                        key={va.id}
                        href={`/agency/vas/${va.id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 font-bold uppercase text-white">
                            {va.email?.charAt(0) || "V"}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {va.full_name || "Virtual Assistant"}
                            </p>
                            <p className="truncate text-sm text-slate-500">
                              {va.email}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${online
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-600"
                            }`}
                        >
                          {online ? "Online" : "Offline"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </DashboardPanel>

            <DashboardPanel
              title="Recent Projects"
              description="Latest project activity."
              href="/agency/projects"
            >
              {recentProjects.length === 0 ? (
                <EmptyText text="No projects yet." />
              ) : (
                <div className="space-y-3">
                  {recentProjects.map((project) => {
                    const client = getRelatedClient(project);

                    return (
                      <div
                        key={project.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold text-slate-900">
                              {project.name}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              {client?.name || "No client"}
                              {client?.currency ? ` • ${client.currency}` : ""}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getProjectBadge(
                              project.status
                            )}`}
                          >
                            {project.status || "active"}
                          </span>
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                          {project.description || "No description"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </DashboardPanel>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DashboardPanel
              title="Recent Clients"
              description="Newest clients in your workspace."
              href="/agency/clients"
            >
              {recentClients.length === 0 ? (
                <EmptyText text="No clients yet." />
              ) : (
                <div className="space-y-3">
                  {recentClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 font-bold uppercase text-white">
                          {client.name?.charAt(0) || "C"}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {client.name}
                          </p>
                          <p className="truncate text-sm text-slate-500">
                            {client.email || "No details"}
                          </p>
                        </div>
                      </div>

                      <p className="shrink-0 text-sm font-semibold text-slate-700">
                        {safeFormatMoney(
                          client.hourly_rate,
                          client.currency || DEFAULT_CURRENCY
                        )} / hr
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </DashboardPanel>

            <DashboardPanel
              title="Recent Invoices"
              description="Latest invoices created."
              href="/agency/invoices"
            >
              {recentInvoices.length === 0 ? (
                <EmptyText text="No invoices yet." />
              ) : (
                <div className="space-y-3">
                  {recentInvoices.map((invoice) => {
                    const client = getRelatedClient(invoice);
                    const currency = getInvoiceCurrency(invoice);

                    return (
                      <div
                        key={invoice.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              {invoice.invoice_number ||
                                `Invoice ${invoice.id.slice(0, 8)}`}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              {client?.name || "No client"} • {currency}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${getInvoiceBadge(
                              invoice.status
                            )}`}
                          >
                            {invoice.status || "draft"}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <p className="font-semibold text-slate-900">
                            {safeFormatMoney(invoice.total_amount, currency)}
                          </p>

                          <p className="text-xs text-slate-400">
                            Due: {formatDate(invoice.due_date)}
                          </p>
                        </div>

                        {invoice.public_token && (
                          <a
                            href={`/public-invoice/${invoice.public_token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-block text-xs font-medium text-blue-600 hover:underline"
                          >
                            View public invoice
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </DashboardPanel>
          </div>
        </>
      )}
    </main>
  );
}

function StatCard({ title, value, description, icon, color = "indigo" }) {
  const colors = {
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-600",
    blue: "bg-blue-50 border-blue-100 text-blue-600",
    violet: "bg-violet-50 border-violet-100 text-violet-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-3 text-3xl font-bold text-slate-900">{value}</h3>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>

        <div
          className={`rounded-2xl border p-3 ${colors[color] || colors.indigo
            }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function MoneyCard({ title, value, description, icon, tone }) {
  const tones = {
    orange: "border-orange-100 bg-orange-50 text-orange-600",
    green: "border-green-100 bg-green-50 text-green-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="mt-3">{value}</div>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>

        <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function CurrencyTotals({ totals }) {
  if (!totals || totals.length === 0) {
    return <p className="text-3xl font-bold text-slate-900">—</p>;
  }

  return (
    <div className="space-y-1">
      {totals.map((item) => (
        <p key={item.currency} className="text-2xl font-bold text-slate-900">
          {safeFormatMoney(item.amount, item.currency)}
          <span className="ml-2 align-middle text-xs font-semibold uppercase text-slate-400">
            {item.currency}
          </span>
        </p>
      ))}
    </div>
  );
}

function DashboardPanel({ title, description, href, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>

        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          View all
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyText({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-2xl bg-slate-100"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-80 animate-pulse rounded-2xl bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
}
