"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  Mail,
  Timer,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import { formatMoney } from "@/lib/currency";

const DEFAULT_CURRENCY = "USD";

export default function VaProfilePage() {
  const params = useParams();
  const routeId = params.id;

  const { showToast, profile, membership, organization } = useAppContext();

  const organizationId =
    organization?.id ||
    membership?.organization_id ||
    profile?.organization_id ||
    null;

  const [connection, setConnection] = useState(null);
  const [va, setVa] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (routeId && organizationId) {
      loadVA();
    }

    if (routeId && !organizationId) {
      setLoading(false);
    }
  }, [routeId, organizationId]);

  async function loadVA() {
    setLoading(true);
    setNotFound(false);

    /*
      Preferred:
      routeId = va_connections.id

      Fallback:
      routeId = users.id
    */
    let selectedConnection = null;
    let selectedVa = null;

    const { data: connectionData, error: connectionError } = await supabase
      .from("va_connections")
      .select(
        `
        id,
        connection_type,
        organization_id,
        client_id,
        va_user_id,
        va_email,
        status,
        hourly_rate,
        currency,
        created_at
      `
      )
      .eq("id", routeId)
      .eq("connection_type", "agency")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (connectionError) {
      showToast(connectionError.message, "error");
      setLoading(false);
      return;
    }

    selectedConnection = connectionData || null;

    if (selectedConnection?.va_user_id) {
      selectedVa = await loadVaUser(selectedConnection.va_user_id);
    }

    /*
      Backward support:
      If old links use /agency/vas/[users.id],
      still load the VA user and connection.
    */
    if (!selectedConnection) {
      const fallbackVa = await loadVaUser(routeId);

      if (fallbackVa) {
        selectedVa = fallbackVa;

        const { data: fallbackConnection } = await supabase
          .from("va_connections")
          .select(
            `
            id,
            connection_type,
            organization_id,
            client_id,
            va_user_id,
            va_email,
            status,
            hourly_rate,
            currency,
            created_at
          `
          )
          .eq("connection_type", "agency")
          .eq("organization_id", organizationId)
          .eq("va_user_id", fallbackVa.id)
          .maybeSingle();

        selectedConnection =
          fallbackConnection ||
          {
            id: null,
            connection_type: "agency",
            organization_id: organizationId,
            va_user_id: fallbackVa.id,
            va_email: fallbackVa.email,
            status: "active",
            hourly_rate: 0,
            currency: DEFAULT_CURRENCY,
            created_at: fallbackVa.created_at,
          };
      }
    }

    if (!selectedConnection && !selectedVa) {
      setConnection(null);
      setVa(null);
      setTasks([]);
      setTimeLogs([]);
      setInvoices([]);
      setNotFound(true);
      setLoading(false);
      return;
    }

    setConnection(selectedConnection);
    setVa(selectedVa);

    const vaUserId = selectedConnection?.va_user_id || selectedVa?.id || null;
    const connectionId = selectedConnection?.id || null;

    await Promise.all([
      loadTasks({ vaUserId, connectionId }),
      loadTimeLogs({ vaUserId }),
      loadInvoices({ vaUserId }),
    ]);

    setLoading(false);
  }

  async function loadVaUser(userId) {
    if (!userId) return null;

    const { data, error } = await supabase
      .from("users")
      .select(
        `
        id,
        email,
        full_name,
        role,
        organization_id,
        last_active,
        created_at,
        bank_name,
        bank_account_name,
        bank_account_number,
        bank_account_type
      `
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      showToast(error.message, "error");
      return null;
    }

    return data || null;
  }

  async function loadTasks({ vaUserId, connectionId }) {
    let query = supabase
      .from("tasks")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (vaUserId && connectionId) {
      query = query.or(
        `assigned_to.eq.${vaUserId},va_connection_id.eq.${connectionId}`
      );
    } else if (vaUserId) {
      query = query.eq("assigned_to", vaUserId);
    } else if (connectionId) {
      query = query.eq("va_connection_id", connectionId);
    } else {
      setTasks([]);
      return;
    }

    const { data, error } = await query;

    if (error) {
      showToast(error.message, "error");
      setTasks([]);
      return;
    }

    setTasks(data || []);
  }

  async function loadTimeLogs({ vaUserId }) {
    if (!vaUserId) {
      setTimeLogs([]);
      return;
    }

    let query = supabase
      .from("time_logs")
      .select("*")
      .eq("user_id", vaUserId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;

    if (error) {
      showToast(error.message, "error");
      setTimeLogs([]);
      return;
    }

    setTimeLogs(data || []);
  }

  async function loadInvoices({ vaUserId }) {
    if (!vaUserId) {
      setInvoices([]);
      return;
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", vaUserId)
      .or(`organization_id.eq.${organizationId},bill_to_organization_id.eq.${organizationId}`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      showToast(error.message, "error");
      setInvoices([]);
      return;
    }

    setInvoices(data || []);
  }

  function formatDate(date) {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(date) {
    if (!date) return "—";

    return new Date(date).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const summary = useMemo(() => {
    const completedTasks = tasks.filter((task) => task.status === "done").length;

    const activeTasks = tasks.filter(
      (task) => task.status !== "done" && task.status !== "completed"
    ).length;

    const totalSeconds = timeLogs.reduce((sum, log) => {
      return sum + Number(log.duration_seconds || log.duration || 0);
    }, 0);

    const totalInvoiceAmount = invoices.reduce((sum, invoice) => {
      return sum + Number(invoice.total_amount || 0);
    }, 0);

    return {
      totalTasks: tasks.length,
      activeTasks,
      completedTasks,
      totalHours: totalSeconds / 3600,
      totalInvoiceAmount,
    };
  }, [tasks, timeLogs, invoices]);

  const currency = normalizeCurrency(
    connection?.currency || va?.currency || DEFAULT_CURRENCY
  );

  const displayName =
    va?.full_name || va?.email || connection?.va_email || "Virtual Assistant";

  const displayEmail = va?.email || connection?.va_email || "No email";

  const isPending = connection?.status === "pending" || !connection?.va_user_id;

  if (loading) {
    return (
      <main className="p-6 text-sm text-slate-500">
        Loading VA profile...
      </main>
    );
  }

  if (!organizationId) {
    return (
      <main className="space-y-6">
        <WarningBox
          title="Agency workspace not found"
          message="Your account does not have an organization connected yet."
        />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="space-y-6">
        <Link
          href="/agency/vas"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to VAs
        </Link>

        <WarningBox
          title="VA not found"
          message="This VA connection does not exist or does not belong to your agency."
        />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <Link
        href="/agency/vas"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back to VAs
      </Link>

      {isPending && (
        <WarningBox
          title="Pending VA invitation"
          message="This VA has not registered yet. Once they create a VA account using this email, this profile will automatically become active."
        />
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold uppercase text-white">
              {displayEmail?.charAt(0) || "V"}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  {displayName}
                </h1>

                <StatusBadge status={connection?.status} />
              </div>

              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <Mail size={15} />
                {displayEmail}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <InfoPill
                  icon={<Building2 size={14} />}
                  label="Agency VA"
                />

                <InfoPill
                  icon={<Wallet size={14} />}
                  label={`${formatMoney(connection?.hourly_rate || 0, currency)} / hr`}
                />

                <InfoPill
                  icon={<BadgeCheck size={14} />}
                  label={currency}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-700">Connection Details</p>

            <div className="mt-3 space-y-1 text-slate-500">
              <p>
                <span className="font-medium text-slate-700">Status:</span>{" "}
                {connection?.status || "pending"}
              </p>

              <p>
                <span className="font-medium text-slate-700">Added:</span>{" "}
                {formatDate(connection?.created_at)}
              </p>

              <p>
                <span className="font-medium text-slate-700">Registered:</span>{" "}
                {va ? "Yes" : "No"}
              </p>

              {va?.last_active && (
                <p>
                  <span className="font-medium text-slate-700">
                    Last active:
                  </span>{" "}
                  {formatDateTime(va.last_active)}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <StatCard
          title="Total Tasks"
          value={summary.totalTasks}
          icon={<ClipboardList size={20} />}
        />

        <StatCard
          title="Active Tasks"
          value={summary.activeTasks}
          icon={<ClipboardList size={20} />}
        />

        <StatCard
          title="Completed"
          value={summary.completedTasks}
          icon={<CheckCircle size={20} />}
        />

        <StatCard
          title="Total Hours"
          value={`${summary.totalHours.toFixed(1)}h`}
          icon={<Clock size={20} />}
        />

        <StatCard
          title="VA Invoices"
          value={formatMoney(summary.totalInvoiceAmount, currency)}
          icon={<FileText size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Selected VA Info
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <Detail label="Name" value={va?.full_name || "Not registered yet"} />
            <Detail label="Email" value={displayEmail} />
            <Detail label="Role" value={va?.role || "VA"} />
            <Detail label="User ID" value={va?.id || "Pending signup"} />
            <Detail
              label="Connection ID"
              value={connection?.id || "Legacy user link"}
            />
            <Detail
              label="Bank"
              value={
                va?.bank_name
                  ? `${va.bank_name} • ${va.bank_account_name || ""}`
                  : "No bank details yet"
              }
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Invoices
          </h2>

          <div className="mt-4 space-y-3">
            {invoices.length === 0 ? (
              <EmptyText text="No VA invoices from this VA yet." />
            ) : (
              invoices.map((invoice) => (
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
                      <p className="mt-1 text-xs text-slate-500">
                        Due: {formatDate(invoice.due_date)}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {invoice.status || "draft"}
                    </span>
                  </div>

                  <p className="mt-3 font-semibold text-slate-900">
                    {formatMoney(
                      invoice.total_amount || 0,
                      normalizeCurrency(invoice.currency || currency)
                    )}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Assigned Tasks</h2>

        <div className="mt-4 space-y-3">
          {tasks.length === 0 ? (
            <EmptyText text="No tasks assigned yet." />
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-slate-900">
                      {task.title}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      {task.description || "No description"}
                    </p>

                    {task.due_date && (
                      <p className="mt-2 text-xs text-slate-400">
                        Due: {formatDate(task.due_date)}
                      </p>
                    )}
                  </div>

                  <StatusBadge status={task.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Recent Time Logs
        </h2>

        <div className="mt-4 space-y-3">
          {timeLogs.length === 0 ? (
            <EmptyText text="No time logs yet." />
          ) : (
            timeLogs.map((log) => {
              const seconds = Number(log.duration_seconds || log.duration || 0);

              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatDateTime(log.start_time || log.created_at)}
                    </p>

                    <p className="text-xs text-slate-500">
                      {log.description ||
                        (log.end_time
                          ? `Ended ${formatDateTime(log.end_time)}`
                          : "Running / not ended")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      {(seconds / 3600).toFixed(2)}h
                    </p>

                    {log.hourly_rate && (
                      <p className="text-xs text-slate-400">
                        {formatMoney(
                          log.hourly_rate,
                          normalizeCurrency(log.currency || currency)
                        )}{" "}
                        / hr
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <div className="text-indigo-600">{icon}</div>
      </div>

      <h2 className="mt-3 text-2xl font-bold text-slate-900">{value}</h2>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-all font-medium text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}

function InfoPill({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
      {icon}
      {label}
    </span>
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
    cancelled: "bg-slate-200 text-slate-600",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] || styles.pending
      }`}
    >
      {status || "pending"}
    </span>
  );
}

function EmptyText({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function WarningBox({ title, message }) {
  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-1 text-orange-600" size={22} />

        <div>
          <h1 className="text-xl font-bold text-orange-900">{title}</h1>

          <p className="mt-2 text-sm text-orange-700">{message}</p>
        </div>
      </div>
    </div>
  );
}

function normalizeCurrency(currency) {
  return currency?.trim()?.toUpperCase() || DEFAULT_CURRENCY;
}