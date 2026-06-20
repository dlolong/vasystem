"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  Info,
  Loader2,
  Mail,
  Plus,
  Timer,
  UserRound,
  Wallet,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import { formatMoney } from "@/lib/currency";

const DEFAULT_CURRENCY = "USD";

export default function VaProfilePage() {
  const params = useParams();
  const router = useRouter();
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
  const [deleting, setDeleting] = useState(false);

  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    due_date: "",
  });

  useEffect(() => {
    if (routeId && organizationId) {
      loadVA();
    }

    if (routeId && !organizationId) {
      setLoading(false);
    }
  }, [routeId, organizationId]);

  async function handleDeleteVA() {
    if (!connection?.id) {
      showToast("This VA connection cannot be deleted because no connection ID was found.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove ${displayName} from your agency?\n\nThis will only remove the VA connection. It will not delete the VA user account.`
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      /*
        Delete old/legacy connection.
        This page currently uses va_connections as its source.
      */
      const { error: vaConnectionError } = await supabase
        .from("va_connections")
        .delete()
        .eq("id", connection.id)
        .eq("connection_type", "agency")
        .eq("organization_id", organizationId);

      if (vaConnectionError) throw vaConnectionError;

      /*
        Also clean app_connections if this VA was added using the new connection system.
        This is safe even if no matching app_connections row exists.
      */
      if (connection.va_user_id) {
        const { error: appConnectionUserError } = await supabase
          .from("app_connections")
          .delete()
          .eq("source_type", "agency")
          .eq("source_organization_id", organizationId)
          .eq("target_type", "va")
          .eq("target_user_id", connection.va_user_id);

        if (appConnectionUserError) throw appConnectionUserError;
      }

      if (connection.va_email) {
        const { error: appConnectionEmailError } = await supabase
          .from("app_connections")
          .delete()
          .eq("source_type", "agency")
          .eq("source_organization_id", organizationId)
          .eq("target_type", "va")
          .eq("target_email", connection.va_email.toLowerCase());

        if (appConnectionEmailError) throw appConnectionEmailError;
      }

      showToast("VA removed from agency.", "success");
      router.replace("/agency/vas");
    } catch (error) {
      showToast(error.message || "Unable to delete VA.", "error");
    }

    setDeleting(false);
  }

  async function loadVA() {
    setLoading(true);
    setNotFound(false);

    let selectedConnection = null;
    let selectedVa = null;

    /*
      1. New system:
      routeId = app_connections.id
    */
    const { data: appConnectionData, error: appConnectionError } = await supabase
      .from("app_connections")
      .select(
        `
      id,
      source_type,
      source_organization_id,
      target_type,
      target_actual_type,
      target_user_id,
      target_organization_id,
      target_client_id,
      target_email,
      status,
      hourly_rate,
      currency,
      created_at
    `
      )
      .eq("id", routeId)
      .eq("source_type", "agency")
      .eq("source_organization_id", organizationId)
      .eq("target_type", "va")
      .maybeSingle();

    if (appConnectionError) {
      showToast(appConnectionError.message, "error");
      setLoading(false);
      return;
    }

    if (appConnectionData) {
      selectedConnection = {
        id: appConnectionData.id,
        source_table: "app_connections",
        app_connection_id: appConnectionData.id,

        connection_type: "agency",
        organization_id: appConnectionData.source_organization_id,

        va_user_id: appConnectionData.target_user_id,
        va_email: appConnectionData.target_email,

        target_actual_type: appConnectionData.target_actual_type,
        target_organization_id: appConnectionData.target_organization_id,

        status: appConnectionData.status,
        hourly_rate: Number(appConnectionData.hourly_rate || 0),
        currency: normalizeCurrency(appConnectionData.currency),
        created_at: appConnectionData.created_at,
      };

      if (appConnectionData.target_user_id) {
        selectedVa = await loadVaUser(appConnectionData.target_user_id);
      }

      /*
        If the provider is actually an agency treated as VA,
        create a display object so the page can still show details.
      */
      if (!selectedVa && appConnectionData.target_organization_id) {
        const { data: organizationData } = await supabase
          .from("organizations")
          .select("id, name")
          .eq("id", appConnectionData.target_organization_id)
          .maybeSingle();

        selectedVa = {
          id: appConnectionData.target_organization_id,
          email: appConnectionData.target_email,
          full_name: organizationData?.name || "Agency Provider",
          role: "agency",
          organization_id: appConnectionData.target_organization_id,
          created_at: appConnectionData.created_at,
        };
      }
    }

    /*
      2. Legacy system:
      routeId = va_connections.id
    */
    if (!selectedConnection) {
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

      selectedConnection = connectionData
        ? {
          ...connectionData,
          source_table: "va_connections",
          app_connection_id: null,
        }
        : null;

      if (selectedConnection?.va_user_id) {
        selectedVa = await loadVaUser(selectedConnection.va_user_id);
      }
    }

    /*
      3. Backward support:
      routeId = users.id
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
            source_table: "legacy_user",
            app_connection_id: null,
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
    const legacyConnectionId =
      selectedConnection?.source_table === "va_connections"
        ? selectedConnection?.id
        : null;
    const appConnectionId =
      selectedConnection?.source_table === "app_connections"
        ? selectedConnection?.id
        : null;

    await Promise.all([
      loadTasks({ vaUserId, connectionId: legacyConnectionId, appConnectionId }),
      loadTimeLogs({ vaUserId }),
      loadInvoices({
        vaUserId,
        providerOrganizationId: selectedConnection?.target_organization_id,
      }),
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

  async function loadTasks({ vaUserId, connectionId, appConnectionId }) {
    let query = supabase
      .from("tasks")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    const filters = [];

    if (vaUserId) {
      filters.push(`assigned_to.eq.${vaUserId}`);
    }

    if (connectionId) {
      filters.push(`va_connection_id.eq.${connectionId}`);
    }

    if (appConnectionId) {
      filters.push(`app_connection_id.eq.${appConnectionId}`);
    }

    if (filters.length === 0) {
      setTasks([]);
      return;
    }

    query = query.or(filters.join(","));

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

  function updateTaskField(e) {
    const { name, value } = e.target;

    setTaskForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function resetTaskForm() {
    setTaskForm({
      title: "",
      description: "",
      due_date: "",
    });
  }

  async function handleAddTask(e) {
    e.preventDefault();

    if (!taskForm.title.trim()) {
      showToast("Task title is required.", "error");
      return;
    }

    if (!organizationId) {
      showToast("Agency organization not found.", "error");
      return;
    }

    if (!selectedVaUserId && !selectedLegacyConnectionId && !selectedAppConnectionId) {
      showToast("VA connection not found.", "error");
      return;
    }

    setSavingTask(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("User session not found.");
      }

      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        due_date: taskForm.due_date || null,
        status: "todo",

        organization_id: organizationId,
        assigned_to: selectedVaUserId || null,

        va_connection_id: selectedLegacyConnectionId || null,
        app_connection_id: selectedAppConnectionId || null,

        assigned_to_type: "va",
        source_type: "agency",
        source_user_id: user.id,
        source_organization_id: organizationId,
        target_email: connection?.va_email || va?.email || null,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

      setTasks((prev) => [data, ...prev]);
      resetTaskForm();
      setShowTaskDialog(false);
      showToast("Task assigned to VA successfully.", "success");
    } catch (error) {
      showToast(error.message || "Unable to add task.", "error");
    }

    setSavingTask(false);
  }

  async function handleRemoveTask(task) {
    if (!task?.id) return;

    const confirmed = window.confirm(
      `Remove this task from ${displayName}?\n\nThis will delete the task assignment from this VA.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id)
        .eq("organization_id", organizationId);

      if (error) throw error;

      setTasks((prev) => prev.filter((item) => item.id !== task.id));
      showToast("Task removed from VA.", "success");
    } catch (error) {
      showToast(error.message || "Unable to remove task.", "error");
    }
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
  const selectedVaUserId = connection?.va_user_id || va?.id || null;

  const selectedLegacyConnectionId =
    connection?.source_table === "va_connections" ? connection?.id : null;

  const selectedAppConnectionId =
    connection?.source_table === "app_connections" ? connection?.id : null;

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
    <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
      {showTaskDialog && (
        <AddTaskDialog
          taskForm={taskForm}
          savingTask={savingTask}
          displayName={displayName}
          onClose={() => {
            resetTaskForm();
            setShowTaskDialog(false);
          }}
          onSubmit={handleAddTask}
          onChange={updateTaskField}
        />
      )}

      {showInfoDialog && (
        <VaInfoDialog
          va={va}
          connection={connection}
          displayName={displayName}
          displayEmail={displayEmail}
          currency={currency}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          onClose={() => setShowInfoDialog(false)}
        />
      )}

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <Link
            href="/agency/vas"
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Back to VAs
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold uppercase text-white">
              {displayEmail?.charAt(0) || "V"}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold text-slate-900">
                  {displayName}
                </h1>

                <StatusBadge status={connection?.status} />
              </div>

              <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <Mail size={15} />
                {displayEmail}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setShowInfoDialog(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Info size={17} />
            VA Info
          </button>

          <button
            type="button"
            onClick={() => setShowTaskDialog(true)}
            disabled={
              !selectedVaUserId &&
              !selectedLegacyConnectionId &&
              !selectedAppConnectionId
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={17} />
            Add Task
          </button>

          <button
            type="button"
            onClick={handleDeleteVA}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={17} />
            {deleting ? "Removing..." : "Remove VA"}
          </button>
        </div>
      </div>

      {isPending && (
        <WarningBox
          title="Pending VA invitation"
          message="This VA has not registered yet. Once they create a VA account using this email, this profile will automatically become active."
        />
      )}

      {/* PRIORITY 4: SUMMARY */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
          <p className="text-sm text-slate-500">
            Quick performance snapshot for this VA.
          </p>
        </div>

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
      </section>

      {/* PRIORITY 1: VA TASKS */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">VA Tasks</h2>
            <p className="text-sm text-slate-500">
              Tasks assigned by your agency to this VA.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowTaskDialog(true)}
            disabled={
              !selectedVaUserId &&
              !selectedLegacyConnectionId &&
              !selectedAppConnectionId
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={16} />
            Add Task
          </button>
        </div>

        <div className="p-6">
          {tasks.length === 0 ? (
            <EmptyText text="No tasks assigned yet." />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900">
                        {task.title}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {task.description || "No description"}
                      </p>

                      {task.due_date && (
                        <p className="mt-3 text-xs font-medium text-slate-400">
                          Due: {formatDate(task.due_date)}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={task.status} />

                      <button
                        type="button"
                        onClick={() => handleRemoveTask(task)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                        title="Remove task"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* PRIORITY 2 + 3: TIME LOGS + INVOICES */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Time Logs</h2>
            <p className="text-sm text-slate-500">
              Recent tracked work from this VA.
            </p>
          </div>

          <div className="max-h-[520px] overflow-y-auto p-6">
            {timeLogs.length === 0 ? (
              <EmptyText text="No time logs yet." />
            ) : (
              <div className="space-y-3">
                {timeLogs.map((log) => {
                  const seconds = Number(log.duration_seconds || log.duration || 0);

                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {formatDateTime(log.start_time || log.created_at)}
                        </p>

                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {log.description ||
                            (log.end_time
                              ? `Ended ${formatDateTime(log.end_time)}`
                              : "Running / not ended")}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-bold text-slate-900">
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
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Invoices</h2>
            <p className="text-sm text-slate-500">
              Recent invoices connected to this VA.
            </p>
          </div>

          <div className="max-h-[520px] overflow-y-auto p-6">
            {invoices.length === 0 ? (
              <EmptyText text="No VA invoices from this VA yet." />
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900">
                          {invoice.invoice_number ||
                            `Invoice ${invoice.id.slice(0, 8)}`}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Due: {formatDate(invoice.due_date)}
                        </p>
                      </div>

                      <StatusBadge status={invoice.status || "draft"} />
                    </div>

                    <p className="mt-4 text-lg font-bold text-slate-900">
                      {formatMoney(
                        invoice.total_amount || 0,
                        normalizeCurrency(invoice.currency || currency)
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function VaInfoDialog({
  va,
  connection,
  displayName,
  displayEmail,
  currency,
  formatDate,
  formatDateTime,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              VA Information
            </h3>
            <p className="text-sm text-slate-500">
              Full connection and profile details for {displayName}.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          <div className="mb-5 flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold uppercase text-white">
              {displayEmail?.charAt(0) || "V"}
            </div>

            <div className="min-w-0">
              <h4 className="font-semibold text-slate-900">{displayName}</h4>
              <p className="mt-1 text-sm text-slate-500">{displayEmail}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <InfoPill icon={<Building2 size={14} />} label="Agency VA" />
                <InfoPill
                  icon={<Wallet size={14} />}
                  label={`${formatMoney(
                    connection?.hourly_rate || 0,
                    currency
                  )} / hr`}
                />
                <InfoPill icon={<BadgeCheck size={14} />} label={currency} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Detail label="Name" value={va?.full_name || "Not registered yet"} />
            <Detail label="Email" value={displayEmail} />
            <Detail label="Role" value={va?.role || "VA"} />
            <Detail label="User ID" value={va?.id || "Pending signup"} />
            <Detail
              label="Connection ID"
              value={connection?.id || "Legacy user link"}
            />
            <Detail
              label="Connection Source"
              value={connection?.source_table || "Unknown"}
            />
            <Detail label="Status" value={connection?.status || "pending"} />
            <Detail label="Added" value={formatDate(connection?.created_at)} />
            <Detail label="Registered" value={va ? "Yes" : "No"} />
            <Detail
              label="Last Active"
              value={va?.last_active ? formatDateTime(va.last_active) : "—"}
            />
            <Detail
              label="Bank"
              value={
                va?.bank_name
                  ? `${va.bank_name} • ${va.bank_account_name || ""}`
                  : "No bank details yet"
              }
            />
            <Detail
              label="Bank Account Type"
              value={va?.bank_account_type || "—"}
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Close
          </button>
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
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${styles[status] || styles.pending
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

function AddTaskDialog({
  taskForm,
  savingTask,
  displayName,
  onClose,
  onSubmit,
  onChange,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Add Task to VA
            </h3>
            <p className="text-sm text-slate-500">
              Assign a new task to {displayName}.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Task Title
            </label>

            <input
              name="title"
              value={taskForm.title}
              onChange={onChange}
              placeholder="Example: Update client spreadsheet"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Description
            </label>

            <textarea
              name="description"
              value={taskForm.description}
              onChange={onChange}
              rows={4}
              placeholder="Task details..."
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Due Date
            </label>

            <input
              name="due_date"
              type="date"
              value={taskForm.due_date}
              onChange={onChange}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
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
              disabled={savingTask}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingTask ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Add Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}