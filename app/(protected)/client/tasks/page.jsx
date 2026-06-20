"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";

export default function ClientTasksPage() {
  const searchParams = useSearchParams();
  const connectionId = searchParams.get("app_connection_id");
  const openNew = searchParams.get("new") === "1";

  const { showToast } = useAppContext();

  const [authUser, setAuthUser] = useState(null);
  const [clientRecord, setClientRecord] = useState(null);
  const [connections, setConnections] = useState([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState(connectionId || "");
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(openNew);
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
  });

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (clientRecord) {
      loadTasks();
    }
  }, [selectedConnectionId, clientRecord]);

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

    const loadedConnections = await loadConnections(client.id);
    setConnections(loadedConnections);

    if (!selectedConnectionId && loadedConnections.length > 0) {
      setSelectedConnectionId(loadedConnections[0].id);
    }

    setLoading(false);
  }

  async function loadConnections(clientId) {
    const { data, error } = await supabase
      .from("app_connections")
      .select("*")
      .or(`source_client_id.eq.${clientId},target_client_id.eq.${clientId}`)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false });

    if (error) {
      showToast(error.message, "error");
      return [];
    }

    return data || [];
  }

  async function loadTasks() {
    if (!clientRecord?.id) return;

    let query = supabase
      .from("tasks")
      .select("*")
      .or(
        `source_client_id.eq.${clientRecord.id},assigned_to_client_id.eq.${clientRecord.id},client_id.eq.${clientRecord.id}`
      )
      .order("created_at", { ascending: false });

    if (selectedConnectionId) {
      query = query.eq("app_connection_id", selectedConnectionId);
    }

    const { data, error } = await query;

    if (error) {
      showToast(error.message, "error");
      setTasks([]);
      return;
    }

    setTasks(data || []);
  }

  function updateForm(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function createTask(e) {
    e.preventDefault();

    if (!authUser || !clientRecord) return;

    const connection = connections.find((item) => item.id === selectedConnectionId);

    if (!connection) {
      showToast("Please select a VA/provider.", "error");
      return;
    }

    if (!form.title.trim()) {
      showToast("Task title is required.", "error");
      return;
    }

    setSaving(true);

    const providerIsSource = connection.source_type !== "client";
    const providerUserId = providerIsSource
      ? connection.source_user_id
      : connection.target_user_id;
    const providerOrgId = providerIsSource
      ? connection.source_organization_id
      : connection.target_organization_id;
    const providerEmail = providerIsSource
      ? null
      : connection.target_email;

    const assignedToType = providerOrgId ? "agency" : "va";

    const { error } = await supabase.from("tasks").insert({
      title: form.title.trim(),
      description: form.description || null,
      due_date: form.due_date || null,
      status: "todo",

      app_connection_id: connection.id,

      source_type: "client",
      source_user_id: authUser.id,
      source_client_id: clientRecord.id,

      client_id: clientRecord.id,
      created_by: authUser.id,

      assigned_to_type: assignedToType,
      assigned_to: assignedToType === "va" ? providerUserId : null,
      assigned_to_organization_id:
        assignedToType === "agency" ? providerOrgId : null,
      organization_id: providerOrgId || null,
      target_email: providerEmail,
    });

    if (error) {
      showToast(error.message, "error");
      setSaving(false);
      return;
    }

    showToast("Task assigned.", "success");

    setForm({
      title: "",
      description: "",
      due_date: "",
    });

    setShowForm(false);
    setSaving(false);
    loadTasks();
  }

  const selectedConnection = useMemo(() => {
    return connections.find((item) => item.id === selectedConnectionId) || null;
  }, [connections, selectedConnectionId]);

  if (loading) {
    return <main className="p-6 text-sm text-slate-500">Loading tasks...</main>;
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500">
            View and assign tasks to your connected VAs or agencies.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={loadTasks}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Assign Task
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          VA / Provider
        </label>

        <select
          value={selectedConnectionId}
          onChange={(e) => setSelectedConnectionId(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="">All providers</option>

          {connections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.target_email || connection.source_type} ·{" "}
              {connection.status}
            </option>
          ))}
        </select>
      </section>

      {showForm && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <form onSubmit={createTask} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Assign New Task
              </h2>
              <p className="text-sm text-slate-500">
                Assigned to: {selectedConnection?.target_email || "Selected provider"}
              </p>
            </div>

            <input
              name="title"
              value={form.title}
              onChange={updateForm}
              placeholder="Task title"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            <textarea
              name="description"
              value={form.description}
              onChange={updateForm}
              placeholder="Task details"
              rows={4}
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            <input
              type="date"
              name="due_date"
              value={form.due_date}
              onChange={updateForm}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Save Task
                </>
              )}
            </button>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {tasks.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No tasks yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function TaskRow({ task }) {
  return (
    <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
      <div>
        <h3 className="font-semibold text-slate-900">{task.title}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {task.description || "No description"}
        </p>
        {task.due_date && (
          <p className="mt-1 text-xs text-slate-400">Due: {task.due_date}</p>
        )}
      </div>

      <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
        {task.status || "todo"}
      </span>
    </div>
  );
}