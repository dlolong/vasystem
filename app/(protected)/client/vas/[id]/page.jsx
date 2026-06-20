"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Mail,
  Plus,
  ReceiptText,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import { formatMoney } from "@/lib/currency";
import AddClientTaskDialog from "@/components/tasks/AddClientTaskDialog";

export default function ClientVaDetailsPage() {
  const params = useParams();
  const connectionId = params.id;

  const { showToast } = useAppContext();

  const [authUser, setAuthUser] = useState(null);
  const [clientRecord, setClientRecord] = useState(null);
  const [connection, setConnection] = useState(null);
  const [provider, setProvider] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  useEffect(() => {
    if (connectionId) {
      loadPage();
    }
  }, [connectionId]);

  async function loadPage() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setAuthUser(user);

    await supabase.rpc("ensure_client_record", {
      p_name: user.user_metadata?.full_name || user.email,
      p_currency: "USD",
    });

    await supabase.rpc("claim_app_connections");

    const { data: clientRows, error: clientError } = await supabase
      .from("clients")
      .select("id, name, email, currency, user_id")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .limit(1);

    if (clientError) {
      showToast(clientError.message, "error");
      setLoading(false);
      return;
    }

    const client = clientRows?.[0] || null;

    if (!client) {
      setClientRecord(null);
      setLoading(false);
      return;
    }

    setClientRecord(client);

    const { data: connectionData, error: connectionError } = await supabase
      .from("app_connections")
      .select("*")
      .eq("id", connectionId)
      .maybeSingle();

    if (connectionError) {
      showToast(connectionError.message, "error");
      setLoading(false);
      return;
    }

    if (!connectionData) {
      setConnection(null);
      setLoading(false);
      return;
    }

    const belongsToClient =
      connectionData.source_client_id === client.id ||
      connectionData.target_client_id === client.id;

    if (!belongsToClient) {
      showToast("This connection does not belong to your client account.", "error");
      setConnection(null);
      setLoading(false);
      return;
    }

    setConnection(connectionData);

    const providerDetails = await loadProviderDetails(connectionData, client.id);
    setProvider(providerDetails);

    await Promise.all([
      loadTasks(connectionData.id),
      loadInvoices(client.id, providerDetails),
    ]);

    setLoading(false);
  }

  async function loadProviderDetails(connection, clientId) {
    const clientIsSource =
      connection.source_type === "client" && connection.source_client_id === clientId;

    const providerUserId = clientIsSource
      ? connection.target_user_id
      : connection.source_user_id;

    const providerOrganizationId = clientIsSource
      ? connection.target_organization_id
      : connection.source_organization_id;

    const providerEmail = clientIsSource
      ? connection.target_email
      : null;

    let userRow = null;
    let organizationRow = null;

    if (providerUserId) {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .eq("id", providerUserId)
        .maybeSingle();

      userRow = data || null;
    }

    if (providerOrganizationId) {
      const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", providerOrganizationId)
        .maybeSingle();

      organizationRow = data || null;
    }

    const isAgency =
      Boolean(providerOrganizationId) ||
      connection.target_actual_type === "agency" ||
      connection.source_type === "agency";

    return {
      kind: isAgency ? "agency_as_va" : "va",
      name: isAgency
        ? organizationRow?.name || providerEmail || "Agency"
        : userRow?.full_name || userRow?.email || providerEmail || "Virtual Assistant",
      email: userRow?.email || providerEmail || null,
      status: connection.status || "pending",
      hourly_rate: Number(connection.hourly_rate || 0),
      currency: normalizeCurrency(connection.currency || clientRecord?.currency),
      provider_user_id: providerUserId || null,
      provider_organization_id: providerOrganizationId || null,
    };
  }

  async function loadTasks(appConnectionId) {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("app_connection_id", appConnectionId)
      .order("created_at", { ascending: false });

    if (error) {
      showToast(error.message, "error");
      setTasks([]);
      return;
    }

    setTasks(data || []);
  }

  async function loadInvoices(clientId, providerDetails) {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        total_amount,
        status,
        due_date,
        created_at,
        currency,
        user_id,
        created_by,
        creator_type,
        creator_id,
        organization_id,
        client_id,
        bill_to_client_id,
        bill_to_organization_id,
        public_token,
        payment_link
      `
      )
      .or(`client_id.eq.${clientId},bill_to_client_id.eq.${clientId}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      showToast(error.message, "error");
      setInvoices([]);
      return;
    }

    const providerInvoices = (data || []).filter((invoice) => {
      if (providerDetails?.provider_user_id) {
        return (
          invoice.user_id === providerDetails.provider_user_id ||
          invoice.created_by === providerDetails.provider_user_id ||
          invoice.creator_id === providerDetails.provider_user_id
        );
      }

      if (providerDetails?.provider_organization_id) {
        return (
          invoice.organization_id === providerDetails.provider_organization_id ||
          invoice.creator_id === providerDetails.provider_organization_id
        );
      }

      return false;
    });

    setInvoices(providerInvoices);
  }

  function formatDate(date) {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const stats = useMemo(() => {
    const unpaidInvoices = invoices.filter(
      (invoice) => !["paid", "cancelled"].includes(invoice.status)
    );

    const unpaidTotal = unpaidInvoices.reduce((sum, invoice) => {
      return sum + Number(invoice.total_amount || 0);
    }, 0);

    const openTasks = tasks.filter(
      (task) => !["done", "completed", "cancelled"].includes(task.status)
    ).length;

    return {
      tasks: tasks.length,
      openTasks,
      invoices: invoices.length,
      unpaidInvoices: unpaidInvoices.length,
      unpaidTotal,
    };
  }, [tasks, invoices]);

  const currency = normalizeCurrency(provider?.currency || clientRecord?.currency);

  if (loading) {
    return (
      <main className="p-6 text-sm text-slate-500">
        Loading VA details...
      </main>
    );
  }

  if (!connection || !provider) {
    return (
      <main className="space-y-6">
        <BackLink />

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
          <h1 className="text-xl font-bold text-orange-900">
            VA/provider not found
          </h1>
          <p className="mt-2 text-sm text-orange-700">
            This connection was not found or does not belong to your account.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <AddClientTaskDialog
        open={showTaskDialog}
        onClose={() => setShowTaskDialog(false)}
        clientRecord={clientRecord}
        connection={connection}
        provider={provider}
        onCreated={() => {
          setShowTaskDialog(false);
          loadTasks(connection.id);
        }}
      />

      <BackLink />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                provider.kind === "agency_as_va"
                  ? "bg-indigo-50 text-indigo-600"
                  : "bg-blue-50 text-blue-600"
              }`}
            >
              {provider.kind === "agency_as_va" ? (
                <Building2 size={26} />
              ) : (
                <UserRound size={26} />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  {provider.name}
                </h1>

                <StatusBadge status={provider.status} />

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {provider.kind === "agency_as_va" ? "Agency as VA" : "VA"}
                </span>
              </div>

              {provider.email && (
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <Mail size={15} />
                  {provider.email}
                </p>
              )}

              <p className="mt-3 text-sm font-semibold text-slate-700">
                {formatMoney(provider.hourly_rate || 0, currency)} / hr
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={provider.status !== "active"}
            onClick={() => setShowTaskDialog(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            <Plus size={18} />
            Assign Task
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="Total Tasks"
          value={stats.tasks}
          icon={<CalendarDays size={20} />}
        />

        <StatCard
          title="Open Tasks"
          value={stats.openTasks}
          icon={<Clock size={20} />}
        />

        <StatCard
          title="Invoices"
          value={stats.invoices}
          icon={<ReceiptText size={20} />}
        />

        <StatCard
          title="Unpaid"
          value={formatMoney(stats.unpaidTotal, currency)}
          icon={<Wallet size={20} />}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader title="Tasks" description="Tasks for this VA/provider." />

        {tasks.length === 0 ? (
          <EmptyText text="No tasks yet." />
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} formatDate={formatDate} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          title="Invoices Created by this VA"
          description="Invoices sent to you by this selected VA/provider."
        />

        {invoices.length === 0 ? (
          <EmptyText text="No invoices from this VA/provider yet." />
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function BackLink() {
  return (
    <Link
      href="/client/vas"
      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
    >
      <ArrowLeft size={16} />
      Back to My VAs
    </Link>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div className="border-b border-slate-200 px-5 py-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}

function TaskRow({ task, formatDate }) {
  return (
    <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div>
        <h3 className="font-semibold text-slate-900">{task.title}</h3>

        <p className="mt-1 text-sm text-slate-500">
          {task.description || "No description"}
        </p>

        {task.due_date && (
          <p className="mt-1 text-xs text-slate-400">
            Due: {formatDate(task.due_date)}
          </p>
        )}
      </div>

      <StatusBadge status={task.status} />
    </div>
  );
}

function InvoiceRow({ invoice, formatDate }) {
  const currency = normalizeCurrency(invoice.currency);

  return (
    <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div>
        <h3 className="font-semibold text-slate-900">
          {invoice.invoice_number || `Invoice ${invoice.id.slice(0, 8)}`}
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Due: {formatDate(invoice.due_date)}
        </p>

        {invoice.public_token && (
          <Link
            href={`/public-invoice/${invoice.public_token}`}
            target="_blank"
            className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline"
          >
            View public invoice
          </Link>
        )}
      </div>

      <div className="sm:text-right">
        <p className="font-semibold text-slate-900">
          {formatMoney(invoice.total_amount || 0, currency)}
        </p>

        <div className="mt-2">
          <StatusBadge status={invoice.status} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <div className="text-blue-600">{icon}</div>
      </div>

      <h2 className="mt-3 text-2xl font-bold text-slate-900">{value}</h2>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active: "bg-green-100 text-green-700",
    pending: "bg-orange-100 text-orange-700",
    inactive: "bg-slate-100 text-slate-600",
    todo: "bg-slate-100 text-slate-700",
    doing: "bg-blue-100 text-blue-700",
    in_progress: "bg-blue-100 text-blue-700",
    done: "bg-green-100 text-green-700",
    completed: "bg-green-100 text-green-700",
    sent: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    draft: "bg-slate-100 text-slate-700",
    cancelled: "bg-slate-200 text-slate-600",
  };

  return (
    <span
      className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] || styles.pending
      }`}
    >
      {status || "pending"}
    </span>
  );
}

function EmptyText({ text }) {
  return <div className="p-8 text-center text-sm text-slate-500">{text}</div>;
}

function normalizeCurrency(currency) {
  return currency?.trim()?.toUpperCase() || "USD";
}