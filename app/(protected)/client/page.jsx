"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  FileText,
  Wallet,
  Clock,
  ArrowRight,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";

export default function ClientDashboardPage() {
  const { showToast } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [userRow, setUserRow] = useState(null);
  const [clientRecord, setClientRecord] = useState(null);

  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setAuthUser(user);

    const { data: foundUserRow } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    setUserRow(foundUserRow || null);

    const orgId = foundUserRow?.organization_id || null;

    let clientQuery = supabase
      .from("clients")
      .select("id, name, email, organization_id, user_id, status")
      .limit(1);

    if (orgId) {
      clientQuery = clientQuery
        .eq("organization_id", orgId)
        .or(`user_id.eq.${user.id},email.eq.${user.email}`);
    } else {
      clientQuery = clientQuery.or(`user_id.eq.${user.id},email.eq.${user.email}`);
    }

    const { data: clientData, error: clientError } = await clientQuery.maybeSingle();

    if (clientError) {
      showToast(clientError.message, "error");
      setLoading(false);
      return;
    }

    setClientRecord(clientData || null);

    if (!clientData) {
      setProjects([]);
      setInvoices([]);
      setLoading(false);
      return;
    }

    const [projectsResult, invoicesResult] = await Promise.all([
      supabase
        .from("projects")
        .select(
          `
          id,
          name,
          description,
          status,
          created_at,
          client_id
        `
        )
        .eq("client_id", clientData.id)
        .order("created_at", { ascending: false })
        .limit(6),

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
          payment_link,
          created_at,
          client_id
        `
        )
        .eq("client_id", clientData.id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    if (projectsResult.error) {
      showToast(projectsResult.error.message, "error");
    }

    if (invoicesResult.error) {
      showToast(invoicesResult.error.message, "error");
    }

    setProjects(projectsResult.data || []);
    setInvoices(invoicesResult.data || []);
    setLoading(false);
  }

  const summary = useMemo(() => {
    const unpaidInvoices = invoices.filter(
      (invoice) =>
        invoice.status !== "paid" && invoice.status !== "cancelled"
    );

    const unpaidAmount = unpaidInvoices.reduce((sum, invoice) => {
      return sum + Number(invoice.total_amount || 0);
    }, 0);

    const paidAmount = invoices.reduce((sum, invoice) => {
      if (invoice.status !== "paid") return sum;
      return sum + Number(invoice.total_amount || 0);
    }, 0);

    return {
      totalProjects: projects.length,
      totalInvoices: invoices.length,
      unpaidInvoices: unpaidInvoices.length,
      unpaidAmount,
      paidAmount,
    };
  }, [projects, invoices]);

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

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!clientRecord) {
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
                Ask the agency to add your email as a client or connect your
                account to an existing client record.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Client Dashboard
          </h1>

          <p className="text-sm text-slate-500">
            Welcome, {clientRecord.name || authUser?.email}. View your projects
            and invoices here.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/client/projects"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FolderKanban size={18} />
            View Projects
          </Link>

          <Link
            href="/client/invoices"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <FileText size={18} />
            View Invoices
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Projects"
          value={summary.totalProjects}
          description="Assigned projects"
          icon={<FolderKanban size={20} />}
          color="violet"
        />

        <StatCard
          title="Invoices"
          value={summary.totalInvoices}
          description="Total invoices"
          icon={<FileText size={20} />}
          color="blue"
        />

        <StatCard
          title="Unpaid"
          value={summary.unpaidInvoices}
          description="Waiting for payment"
          icon={<Clock size={20} />}
          color="orange"
        />

        <StatCard
          title="Amount Due"
          value={formatCurrency(summary.unpaidAmount)}
          description="Unpaid balance"
          icon={<Wallet size={20} />}
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardPanel
          title="Recent Projects"
          description="Latest projects assigned to you."
          href="/client/projects"
        >
          {projects.length === 0 ? (
            <EmptyText text="No projects yet." />
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900">
                        {project.name}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {project.description || "No description"}
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
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Recent Invoices"
          description="Latest invoices from your agency."
          href="/client/invoices"
        >
          {invoices.length === 0 ? (
            <EmptyText text="No invoices yet." />
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
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
                        Due: {formatDate(invoice.due_date)}
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

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">
                      {formatCurrency(invoice.total_amount)}
                    </p>

                    {invoice.public_token && (
                      <a
                        href={`/public-invoice/${invoice.public_token}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      >
                        View invoice
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>
    </main>
  );
}

function StatCard({ title, value, description, icon, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 border-blue-100 text-blue-600",
    violet: "bg-violet-50 border-violet-100 text-violet-600",
    orange: "bg-orange-50 border-orange-100 text-orange-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <h3 className="mt-3 text-2xl font-bold text-slate-900">
            {value}
          </h3>

          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>

        <div className={`rounded-2xl border p-3 ${colors[color]}`}>
          {icon}
        </div>
      </div>
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
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
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
    <main className="space-y-6">
      <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-2xl bg-slate-100"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {[1, 2].map((item) => (
          <div
            key={item}
            className="h-80 animate-pulse rounded-2xl bg-slate-100"
          />
        ))}
      </div>
    </main>
  );
}