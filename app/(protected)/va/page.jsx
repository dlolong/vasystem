"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  FileText,
  Plus,
  ReceiptText,
  TimerReset,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import AddClientDialog from "@/components/AddClientDialog";
import AddTimeDialog from "@/components/va/AddTimeDialog";
import { formatMoney } from "@/lib/currency";

export default function DashboardPage() {
  const intervalRef = useRef(null);

  const { showToast } = useAppContext();

  const [user, setUser] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [clients, setClients] = useState([]);

  const [showClientDialog, setShowClientDialog] = useState(false);
  const [showTimeDialog, setShowTimeDialog] = useState(false);

  const [stats, setStats] = useState({
    totalHours: 0,
    billableTotals: {},
    unpaidInvoiceTotals: {},
    uninvoicedTotals: {},
    unpaidInvoices: 0,
    uninvoicedLogs: 0,
    activeClients: 0,
  });

  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTimerId, setActiveTimerId] = useState(null);
  const [timerStatus, setTimerStatus] = useState("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerStartDate, setTimerStartDate] = useState(null);
  const [timerError, setTimerError] = useState("");
  const [timerSuccess, setTimerSuccess] = useState("");

  const [timerForm, setTimerForm] = useState({
    client_id: "",
    description: "",
  });

  useEffect(() => {
    loadDashboard();

    return () => {
      clearTimerInterval();
    };
  }, []);

  const clearTimerInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startLocalInterval = () => {
    clearTimerInterval();

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const loadDashboard = async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      return;
    }

    const currentUser = session.user;
    setUser(currentUser);

    await supabase.rpc("claim_app_connections");

    const { data: userRow } = await supabase
      .from("users")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    const { data: membershipRow } = await supabase
      .from("memberships")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("status", "active")
      .maybeSingle();

    const orgId =
      membershipRow?.organization_id || userRow?.organization_id || null;

    setOrganizationId(orgId);

    const loadedClients = await loadClients(currentUser.id);

    await Promise.all([
      loadDashboardData(currentUser.id, orgId, loadedClients),
      loadActiveTimer(currentUser.id, loadedClients),
    ]);

    setLoading(false);
  };

  const loadClients = async (userId) => {
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
      .eq("status", "active")
      .order("name", { ascending: true });

    const outgoingConnectionsQuery = supabase
      .from("app_connections")
      .select(
        `
      id,
      source_type,
      source_user_id,
      source_organization_id,
      source_client_id,
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
      .eq("source_type", "va")
      .eq("source_user_id", userId)
      .eq("target_type", "client")
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false });

    const incomingConnectionsQuery = supabase
      .from("app_connections")
      .select(
        `
      id,
      source_type,
      source_user_id,
      source_organization_id,
      source_client_id,
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
      .eq("target_type", "va")
      .eq("target_user_id", userId)
      .in("source_type", ["agency", "client"])
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false });

    const [ownedClientsResult, outgoingResult, incomingResult] =
      await Promise.all([
        ownedClientsQuery,
        outgoingConnectionsQuery,
        incomingConnectionsQuery,
      ]);

    const errors = [
      ownedClientsResult.error,
      outgoingResult.error,
      incomingResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      showToast(errors[0].message, "error");
      setClients([]);
      return [];
    }

    const ownedClients = ownedClientsResult.data || [];
    const outgoingConnections = outgoingResult.data || [];
    const incomingConnections = incomingResult.data || [];

    const clientIds = [
      ...ownedClients.map((client) => client.id),
      ...outgoingConnections.map((connection) => connection.target_client_id),
      ...incomingConnections.map((connection) => connection.source_client_id),
    ].filter(Boolean);

    const organizationIds = [
      ...outgoingConnections.map((connection) => connection.target_organization_id),
      ...incomingConnections.map((connection) => connection.source_organization_id),
    ].filter(Boolean);

    const uniqueClientIds = [...new Set(clientIds)];
    const uniqueOrganizationIds = [...new Set(organizationIds)];

    let clientsById = {};
    let organizationsById = {};

    if (uniqueClientIds.length > 0) {
      const { data: clientRows, error } = await supabase
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
        .in("id", uniqueClientIds);

      if (error) {
        showToast(error.message, "error");
      }

      clientsById = (clientRows || []).reduce((map, client) => {
        map[client.id] = client;
        return map;
      }, {});
    }

    if (uniqueOrganizationIds.length > 0) {
      const { data: organizationRows, error } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", uniqueOrganizationIds);

      if (error) {
        showToast(error.message, "error");
      }

      organizationsById = (organizationRows || []).reduce((map, organization) => {
        map[organization.id] = organization;
        return map;
      }, {});
    }

    const recipients = [];

    ownedClients.forEach((client) => {
      recipients.push(createClientRecipientFromClient(client));
    });

    outgoingConnections.forEach((connection) => {
      const isAgency =
        connection.target_actual_type === "agency" ||
        Boolean(connection.target_organization_id);

      if (isAgency) {
        const organization = organizationsById[connection.target_organization_id];

        recipients.push({
          id: `agency:${connection.target_organization_id || connection.id}`,
          connection_id: connection.id,
          source: "app_connection",
          direction: "outgoing",
          recipient_kind: "agency_as_client",
          name: organization?.name || connection.target_email || "Agency",
          email: connection.target_email,
          status: connection.status,
          client_id: null,
          organization_id: connection.target_organization_id || null,
          hourly_rate: Number(connection.hourly_rate || 0),
          currency: normalizeCurrency(connection.currency),
          can_track: connection.status === "active" && Boolean(connection.target_organization_id),
        });

        return;
      }

      const client = clientsById[connection.target_client_id];

      recipients.push({
        id: `client:${connection.target_client_id || connection.id}`,
        connection_id: connection.id,
        source: "app_connection",
        direction: "outgoing",
        recipient_kind: "client",
        name: client?.name || connection.target_email || "Client",
        email: client?.email || connection.target_email,
        status: connection.status,
        client_id: connection.target_client_id || null,
        organization_id: client?.organization_id || null,
        hourly_rate: Number(connection.hourly_rate || client?.hourly_rate || 0),
        currency: normalizeCurrency(connection.currency || client?.currency),
        can_track: connection.status === "active" && Boolean(connection.target_client_id),
      });
    });

    incomingConnections.forEach((connection) => {
      if (connection.source_type === "agency") {
        const organization = organizationsById[connection.source_organization_id];

        recipients.push({
          id: `agency:${connection.source_organization_id || connection.id}`,
          connection_id: connection.id,
          source: "app_connection",
          direction: "incoming",
          recipient_kind: "agency_as_client",
          name: organization?.name || "Agency",
          email: null,
          status: connection.status,
          client_id: null,
          organization_id: connection.source_organization_id || null,
          hourly_rate: Number(connection.hourly_rate || 0),
          currency: normalizeCurrency(connection.currency),
          can_track: connection.status === "active" && Boolean(connection.source_organization_id),
        });

        return;
      }

      const client = clientsById[connection.source_client_id];

      recipients.push({
        id: `client:${connection.source_client_id || connection.id}`,
        connection_id: connection.id,
        source: "app_connection",
        direction: "incoming",
        recipient_kind: "client",
        name: client?.name || "Client",
        email: client?.email || null,
        status: connection.status,
        client_id: connection.source_client_id || null,
        organization_id: client?.organization_id || null,
        hourly_rate: Number(connection.hourly_rate || client?.hourly_rate || 0),
        currency: normalizeCurrency(connection.currency || client?.currency),
        can_track: connection.status === "active" && Boolean(connection.source_client_id),
      });
    });

    const uniqueRecipients = dedupeRecipients(recipients);

    setClients(uniqueRecipients);

    const firstTrackableClient = uniqueRecipients.find(
      (recipient) => recipient.can_track
    );

    if (firstTrackableClient) {
      setTimerForm((prev) => ({
        ...prev,
        client_id: prev.client_id || firstTrackableClient.id,
      }));
    }

    return uniqueRecipients;
  };

  const loadActiveTimer = async (userId, loadedClients = []) => {
    const { data, error } = await supabase
      .from("active_timers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      setTimerError(error.message);
      return;
    }

    if (!data) {
      setActiveTimerId(null);
      setTimerStatus("idle");
      setElapsedSeconds(0);
      clearTimerInterval();
      return;
    }

    const selectedRecipient = findRecipientForTimer(data, loadedClients);
    const firstTrackableClient = loadedClients.find((item) => item.can_track);

    setActiveTimerId(data.id);
    setTimerStatus(data.status);
    setTimerStartDate(new Date(data.started_at));

    setTimerForm({
      client_id: selectedRecipient?.id || firstTrackableClient?.id || "",
      description: data.description || "",
    });

    const calculatedSeconds = calculateElapsedSecondsFromTimer(data);
    setElapsedSeconds(calculatedSeconds);

    if (data.status === "running") {
      startLocalInterval();
    } else {
      clearTimerInterval();
    }
  };

  const calculateElapsedSecondsFromTimer = (timer) => {
    const accumulated = Number(timer.accumulated_seconds || 0);

    if (timer.status === "paused") {
      return accumulated;
    }

    const lastResumedAt = new Date(timer.last_resumed_at);
    const now = new Date();
    const runningSeconds = Math.floor((now - lastResumedAt) / 1000);

    return accumulated + Math.max(runningSeconds, 0);
  };

  const loadDashboardData = async (userId, orgId = null, loadedClients = clients) => {
    const startOfWeek = getStartOfWeek(new Date());
    const endOfWeek = getEndOfWeek(new Date());

    const { data: timeLogs } = await supabase
      .from("time_logs")
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
    `
      )
      .eq("user_id", userId)
      .gte("start_time", startOfWeek.toISOString())
      .lte("start_time", endOfWeek.toISOString())
      .order("start_time", { ascending: false });

    const { data: invoices } = await supabase
      .from("invoices")
      .select(
        `
      id,
      total_amount,
      status,
      currency,
      client_id,
      bill_to_client_id,
      bill_to_organization_id,
      organization_id
    `
      )
      .eq("user_id", userId)
      .neq("status", "paid")
      .neq("status", "cancelled");

    const normalizedTimeLogs = attachRecipientToLogs(timeLogs || [], loadedClients);

    const totalHours = normalizedTimeLogs.reduce((sum, log) => {
      return sum + getHours(log.duration);
    }, 0);

    const billableLogs = normalizedTimeLogs.filter(
      (log) => log.billable !== false
    );

    const uninvoicedLogs = billableLogs.filter(
      (log) => log.invoiced !== true
    );

    setStats({
      totalHours: totalHours || 0,
      billableTotals: groupTotalsByLogCurrency(billableLogs),
      unpaidInvoiceTotals: groupTotalsByInvoiceCurrency(invoices || []),
      uninvoicedTotals: groupTotalsByLogCurrency(uninvoicedLogs),
      unpaidInvoices: invoices?.length || 0,
      uninvoicedLogs: uninvoicedLogs.length,
      activeClients: loadedClients.filter((client) => client.status === "active").length,
    });

    setRecentEntries(normalizedTimeLogs.slice(0, 5));
  };

  const handleTimerFormChange = (e) => {
    const { name, value } = e.target;

    setTimerForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const startTimer = async () => {
    setTimerError("");
    setTimerSuccess("");

    if (!user) {
      setTimerError("User session not found.");
      return;
    }

    if (!timerForm.client_id) {
      setTimerError("Please select a client first.");
      return;
    }

    const selectedClient = clients.find(
      (client) => client.id === timerForm.client_id
    );

    if (!selectedClient) {
      setTimerError("Selected client was not found.");
      return;
    }

    if (!selectedClient.can_track) {
      setTimerError("This connection is still pending and cannot be tracked yet.");
      return;
    }

    const now = new Date();

    const { data, error } = await supabase
      .from("active_timers")
      .insert({
        user_id: user.id,
        organization_id: selectedClient.organization_id || null,
        client_id: selectedClient.client_id || null,
        description: timerForm.description || "",
        hourly_rate: Number(selectedClient.hourly_rate || 0),
        currency: normalizeCurrency(selectedClient.currency),
        status: "running",
        started_at: now.toISOString(),
        last_resumed_at: now.toISOString(),
        accumulated_seconds: 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        setTimerError(
          "You already have an active timer. Refresh the page to reload it."
        );
      } else {
        setTimerError(error.message);
      }

      return;
    }

    setActiveTimerId(data.id);
    setTimerStatus("running");
    setTimerStartDate(now);
    setElapsedSeconds(0);
    startLocalInterval();
  };

  const pauseTimer = async () => {
    if (timerStatus !== "running" || !activeTimerId) return;

    setTimerError("");
    setTimerSuccess("");

    clearTimerInterval();

    const { error } = await supabase
      .from("active_timers")
      .update({
        status: "paused",
        paused_at: new Date().toISOString(),
        accumulated_seconds: elapsedSeconds,
      })
      .eq("id", activeTimerId);

    if (error) {
      setTimerError(error.message);
      startLocalInterval();
      return;
    }

    setTimerStatus("paused");
  };

  const resumeTimer = async () => {
    if (timerStatus !== "paused" || !activeTimerId) return;

    setTimerError("");
    setTimerSuccess("");

    const now = new Date();

    const { error } = await supabase
      .from("active_timers")
      .update({
        status: "running",
        last_resumed_at: now.toISOString(),
        paused_at: null,
        accumulated_seconds: elapsedSeconds,
      })
      .eq("id", activeTimerId);

    if (error) {
      setTimerError(error.message);
      return;
    }

    setTimerStatus("running");
    startLocalInterval();
  };

  const stopAndSaveTimer = async () => {
    setTimerError("");
    setTimerSuccess("");

    if (!user) {
      setTimerError("User session not found.");
      return;
    }

    if (!activeTimerId) {
      setTimerError("No active timer found.");
      return;
    }

    if (!timerForm.client_id) {
      setTimerError("Please select a client.");
      return;
    }

    if (elapsedSeconds <= 0) {
      setTimerError("Timer has no tracked time.");
      return;
    }

    clearTimerInterval();

    const { data: activeTimer, error: timerErrorResult } = await supabase
      .from("active_timers")
      .select("*")
      .eq("id", activeTimerId)
      .eq("user_id", user.id)
      .single();

    if (timerErrorResult || !activeTimer) {
      setTimerError(timerErrorResult?.message || "Active timer not found.");
      return;
    }

    const selectedClient =
      findRecipientForTimer(activeTimer, clients) ||
      clients.find((client) => client.id === timerForm.client_id);

    const finalSeconds = calculateElapsedSecondsFromTimer(activeTimer);
    const now = new Date();

    const { error: insertError } = await supabase.from("time_logs").insert({
      user_id: user.id,
      organization_id:
        activeTimer.organization_id || selectedClient?.organization_id || null,
      client_id: activeTimer.client_id || selectedClient?.client_id || null,
      project_id: activeTimer.project_id || null,
      start_time: new Date(activeTimer.started_at).toISOString(),
      end_time: now.toISOString(),
      duration: finalSeconds,
      description: activeTimer.description || "Timed work session",
      hourly_rate: Number(
        activeTimer.hourly_rate || selectedClient?.hourly_rate || 0
      ),
      currency: normalizeCurrency(
        activeTimer.currency || selectedClient?.currency
      ),
      billable: true,
      invoiced: false,
    });

    if (insertError) {
      setTimerError(insertError.message);

      if (activeTimer.status === "running") {
        startLocalInterval();
      }

      return;
    }

    const { error: deleteError } = await supabase
      .from("active_timers")
      .delete()
      .eq("id", activeTimerId)
      .eq("user_id", user.id);

    if (deleteError) {
      setTimerError(deleteError.message);
      return;
    }

    setActiveTimerId(null);
    setTimerStatus("idle");
    setElapsedSeconds(0);
    setTimerStartDate(null);
    setTimerForm((prev) => ({
      ...prev,
      description: "",
    }));

    setTimerSuccess("Time entry saved successfully.");

    await loadDashboardData(user.id, organizationId);
  };

  const cancelTimer = async () => {
    setTimerError("");
    setTimerSuccess("");

    clearTimerInterval();

    if (activeTimerId) {
      const { error } = await supabase
        .from("active_timers")
        .delete()
        .eq("id", activeTimerId);

      if (error) {
        setTimerError(error.message);
        return;
      }
    }

    setActiveTimerId(null);
    setTimerStatus("idle");
    setElapsedSeconds(0);
    setTimerStartDate(null);

    setTimerSuccess("Timer cancelled.");
  };

  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);

    return new Date(d.setDate(diff));
  };

  const getEndOfWeek = (date) => {
    const start = getStartOfWeek(date);
    const end = new Date(start);

    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return end;
  };

  const formatTimer = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [hrs, mins, secs]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="text-slate-500">Loading dashboard...</div>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
      <AddClientDialog
        open={showClientDialog}
        onClose={() => setShowClientDialog(false)}
        onClientAdded={(newClient) => {
          const normalizedClient = {
            ...newClient,
            currency: normalizeCurrency(newClient.currency),
          };

          setClients((prev) => [normalizedClient, ...prev]);

          setTimerForm((prev) => ({
            ...prev,
            client_id: prev.client_id || normalizedClient.id,
          }));

          loadDashboardData(user.id, organizationId);
        }}
      />

      <AddTimeDialog
        open={showTimeDialog}
        onClose={() => setShowTimeDialog(false)}
        clients={clients}
        onTimeAdded={() => {
          if (user) {
            loadDashboardData(user.id, organizationId);
          }
        }}
      />

      <div className="mb-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-5 flex flex-col gap-3 text-right sm:flex-row">
            <button
              type="button"
              onClick={() => setShowTimeDialog(true)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add Manual Time Entry
            </button>

            <button
              type="button"
              onClick={() => setShowClientDialog(true)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Add Client
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Time Tracker
                </h3>

                <p className="text-sm text-slate-500">
                  Start, pause, and save a time entry automatically.
                </p>

                {timerStartDate && (
                  <p className="mt-1 text-xs text-slate-400">
                    Started: {timerStartDate.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="text-3xl font-bold tracking-tight text-slate-900">
                {formatTimer(elapsedSeconds)}
              </div>
            </div>

            {timerError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {timerError}
              </div>
            )}

            {timerSuccess && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {timerSuccess}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Client
                </label>

                <select
                  name="client_id"
                  value={timerForm.client_id}
                  onChange={handleTimerFormChange}
                  disabled={timerStatus !== "idle"}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  {clients.length === 0 ? (
                    <option value="">No active clients</option>
                  ) : (
                    clients.map((client) => (
                      <option
                        key={client.id}
                        value={client.id}
                        disabled={!client.can_track}
                      >
                        {client.name} ·{" "}
                        {client.recipient_kind === "agency_as_client"
                          ? "Agency as Client"
                          : "Client"}{" "}
                        · {normalizeCurrency(client.currency)} ·{" "}
                        {formatMoney(client.hourly_rate || 0, client.currency || "USD")}/hr
                        {client.status === "pending" ? " · Pending" : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <input
                  type="text"
                  name="description"
                  value={timerForm.description}
                  onChange={handleTimerFormChange}
                  disabled={timerStatus !== "idle"}
                  placeholder="Email management, admin task..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {timerStatus === "idle" && (
                <button
                  onClick={startTimer}
                  disabled={!clients.some((client) => client.can_track)}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Start
                </button>
              )}

              {timerStatus === "running" && (
                <button
                  onClick={pauseTimer}
                  className="flex-1 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-white hover:bg-yellow-600"
                >
                  Pause
                </button>
              )}

              {timerStatus === "paused" && (
                <button
                  onClick={resumeTimer}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Resume
                </button>
              )}

              {timerStatus !== "idle" && (
                <>
                  <button
                    onClick={stopAndSaveTimer}
                    className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    Stop & Save
                  </button>

                  <button
                    onClick={cancelTimer}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <StatCard
            title="Hours this week"
            value={stats.totalHours.toFixed(2)}
            description="Tracked hours"
            icon={<Clock size={20} />}
          />

          <StatCard
            title="Billable amount"
            value={<CurrencyTotals totals={stats.billableTotals} />}
            description="This week by currency"
            icon={<Wallet size={20} />}
          />

          <StatCard
            title="Unpaid invoices"
            value={stats.unpaidInvoices}
            description="Waiting for payment"
            icon={<ReceiptText size={20} />}
          />

          <StatCard
            title="Active clients"
            value={stats.activeClients}
            description="Current clients"
            icon={<Users size={20} />}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Recent time entries
              </h3>

              <p className="text-sm text-slate-500">
                Your latest work logs for this week.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowTimeDialog(true)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add time
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Date</th>
                  <th className="px-6 py-3 text-left font-medium">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left font-medium">Hours</th>
                  <th className="px-6 py-3 text-left font-medium">Amount</th>
                </tr>
              </thead>

              <tbody>
                {recentEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No time entries yet.
                    </td>
                  </tr>
                ) : (
                  recentEntries.map((entry) => {
                    const currency = getLogCurrency(entry);
                    const amount = getLogAmount(entry);

                    return (
                      <tr key={entry.id} className="border-t border-slate-100">
                        <td className="px-6 py-4 text-slate-700">
                          {new Date(entry.start_time).toLocaleDateString()}
                        </td>

                        <td className="px-6 py-4 text-slate-700">
                          <p>{entry.description || "No description"}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {entry.clients?.name || "No client"}
                          </p>
                        </td>

                        <td className="px-6 py-4 text-slate-700">
                          {getHours(entry.duration).toFixed(2)}
                        </td>

                        <td className="px-6 py-4 text-slate-700">
                          {entry.billable === false ? (
                            "—"
                          ) : (
                            <>
                              <p className="font-semibold text-slate-900">
                                {formatMoney(amount, currency)}
                              </p>
                              <p className="text-xs font-medium text-slate-400">
                                {currency}
                              </p>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <BillingHealthPanel
          billableTotals={stats.billableTotals}
          unpaidTotals={stats.unpaidInvoiceTotals}
          uninvoicedTotals={stats.uninvoicedTotals}
          unpaidInvoices={stats.unpaidInvoices}
          uninvoicedLogs={stats.uninvoicedLogs}
        />
      </div>
    </main>
  );
}

function normalizeCurrency(currency) {
  return currency?.trim()?.toUpperCase() || "USD";
}

function getHours(duration) {
  return Number(duration || 0) / 3600;
}

function getLogCurrency(log) {
  return normalizeCurrency(
    log?.currency || log?.clients?.currency || log?.client?.currency || "USD"
  );
}

function getInvoiceCurrency(invoice) {
  return normalizeCurrency(
    invoice?.currency ||
    invoice?.clients?.currency ||
    invoice?.client?.currency ||
    "USD"
  );
}

function getLogAmount(log) {
  const hours = getHours(log.duration);
  const rate = Number(
    log.hourly_rate ||
    log.clients?.hourly_rate ||
    log.recipient?.hourly_rate ||
    0
  );

  return hours * rate;
}

function groupTotalsByLogCurrency(logs = []) {
  return logs.reduce((totals, log) => {
    const currency = getLogCurrency(log);
    const amount = getLogAmount(log);

    if (!totals[currency]) {
      totals[currency] = 0;
    }

    totals[currency] += amount;

    return totals;
  }, {});
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

function createClientRecipientFromClient(client) {
  return {
    id: `client:${client.id}`,
    connection_id: null,
    source: "owned_client",
    direction: "owned",
    recipient_kind: "client",
    name: client.name || client.email || "Client",
    email: client.email || null,
    status: client.status || "active",
    client_id: client.id,
    organization_id: client.organization_id || null,
    hourly_rate: Number(client.hourly_rate || 0),
    currency: normalizeCurrency(client.currency),
    can_track: true,
  };
}

function dedupeRecipients(recipients = []) {
  const map = new Map();

  recipients.forEach((recipient) => {
    const key = recipient.client_id
      ? `client:${recipient.client_id}`
      : recipient.organization_id
        ? `agency:${recipient.organization_id}`
        : `pending:${recipient.email}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...recipient,
        id: key,
      });
      return;
    }

    if (existing.status === "pending" && recipient.status === "active") {
      map.set(key, {
        ...recipient,
        id: key,
      });
    }
  });

  return [...map.values()].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function findRecipientForTimer(timer, recipients = []) {
  return recipients.find((recipient) => {
    if (timer.client_id && recipient.client_id === timer.client_id) {
      return true;
    }

    if (
      !timer.client_id &&
      timer.organization_id &&
      recipient.organization_id === timer.organization_id
    ) {
      return true;
    }

    return false;
  });
}

function attachRecipientToLogs(logs = [], recipients = []) {
  return logs.map((log) => {
    const recipient = recipients.find((item) => {
      if (log.client_id && item.client_id === log.client_id) {
        return true;
      }

      if (
        !log.client_id &&
        log.organization_id &&
        item.organization_id === log.organization_id
      ) {
        return true;
      }

      return false;
    });

    return {
      ...log,
      recipient: recipient || null,
      clients: log.clients || recipient || null,
    };
  });
}

function CurrencyTotals({ totals }) {
  const entries = Object.entries(totals || {});

  if (entries.length === 0) {
    return (
      <div>
        <p className="font-bold text-slate-900">{formatMoney(0, "USD")}</p>
        <p className="text-xs font-medium text-slate-400">USD</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map(([currency, amount]) => (
        <div key={currency}>
          <p className="font-bold text-slate-900">
            {formatMoney(amount, currency)}
          </p>
          <p className="text-xs font-medium text-slate-400">{currency}</p>
        </div>
      ))}
    </div>
  );
}

function BillingHealthPanel({
  billableTotals,
  unpaidTotals,
  uninvoicedTotals,
  unpaidInvoices,
  uninvoicedLogs,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
          <FileText size={22} />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Billing Health
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Important billing status grouped by currency.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <HealthRow
          icon={<Wallet size={18} />}
          title="Billable this week"
          description="Tracked billable work"
          totals={billableTotals}
        />

        <HealthRow
          icon={<ReceiptText size={18} />}
          title="Unpaid invoices"
          description={`${unpaidInvoices} invoice${unpaidInvoices === 1 ? "" : "s"
            } waiting for payment`}
          totals={unpaidTotals}
        />

        <HealthRow
          icon={<TimerReset size={18} />}
          title="Ready to invoice"
          description={`${uninvoicedLogs} uninvoiced billable time log${uninvoicedLogs === 1 ? "" : "s"
            }`}
          totals={uninvoicedTotals}
        />

        {uninvoicedLogs > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle
                size={20}
                className="mt-0.5 shrink-0 text-amber-600"
              />

              <div>
                <p className="text-sm font-semibold text-amber-900">
                  You have billable work not yet invoiced.
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  Go to invoices and generate an invoice from your time logs
                  before the billing period ends.
                </p>
              </div>
            </div>
          </div>
        )}

        {uninvoicedLogs === 0 && unpaidInvoices === 0 && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">
              Your billing looks clean.
            </p>
            <p className="mt-1 text-sm text-green-700">
              No unpaid invoices and no uninvoiced billable logs this week.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthRow({ icon, title, description, totals }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-xl bg-slate-50 p-2 text-blue-600">{icon}</div>

        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>

      <CurrencyTotals totals={totals} />
    </div>
  );
}

function StatCard({ title, value, description, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <div className="mt-3 text-3xl font-bold text-slate-900">
            {value}
          </div>

          <p className="mt-2 text-sm text-slate-400">{description}</p>
        </div>

        {icon && <div className="shrink-0 text-blue-600">{icon}</div>}
      </div>
    </div>
  );
}