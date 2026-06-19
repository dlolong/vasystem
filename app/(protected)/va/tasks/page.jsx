"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";

const PAGE_SIZE = 8;

const statusOptions = [
  { label: "Todo", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "Review", value: "review" },
  { label: "Done", value: "done" },
];

const priorityOptions = [
  { label: "Low", value: "low" },
  { label: "Normal", value: "normal" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

export default function VaTasksPage() {
  const { showToast } = useAppContext();

  const [user, setUser] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [totalTasks, setTotalTasks] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [showTaskDialog, setShowTaskDialog] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: "normal",
    due_date: "",
  });

  const totalPages = useMemo(() => {
    return Math.max(Math.ceil(totalTasks / PAGE_SIZE), 1);
  }, [totalTasks]);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user, organizationId, page, search, statusFilter]);

  async function loadUser() {
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

    setOrganizationId(
      membership?.organization_id || userRow?.organization_id || null
    );

    setLoading(false);
  }

  async function loadTasks() {
    if (!user) return;

    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("tasks")
      .select("*", { count: "exact" })
      .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search.trim()) {
      query = query.or(
        `title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
      );
    }

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error, count } = await query;

    if (error) {
      showToast(error.message, "error");
      setTasks([]);
      setTotalTasks(0);
      setLoading(false);
      return;
    }

    setTasks(data || []);
    setTotalTasks(count || 0);
    setLoading(false);
  }

  function updateTaskForm(e) {
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
      status: "todo",
      priority: "normal",
      due_date: "",
    });
  }

  function closeTaskDialog() {
    resetTaskForm();
    setShowTaskDialog(false);
  }

  async function addTask(e) {
    e.preventDefault();

    if (!user) {
      showToast("User session not found.", "error");
      return;
    }

    if (!taskForm.title.trim()) {
      showToast("Task title is required.", "error");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("tasks").insert({
      organization_id: organizationId || null,
      assigned_to: user.id,
      created_by: user.id,
      title: taskForm.title.trim(),
      description: taskForm.description || null,
      status: taskForm.status,
      priority: taskForm.priority,
      due_date: taskForm.due_date || null,
    });

    if (error) {
      showToast(error.message, "error");
      setSaving(false);
      return;
    }

    showToast("Task added successfully.", "success");

    resetTaskForm();
    setShowTaskDialog(false);
    setSaving(false);
    setPage(1);

    await loadTasks();
  }

  async function updateTaskStatus(taskId, nextStatus) {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: nextStatus,
      })
      .eq("id", taskId);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Task updated.", "success");

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: nextStatus,
            }
          : task
      )
    );
  }

  function formatDate(date) {
    if (!date) return "No due date";

    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getStatusBadge(status) {
    const styles = {
      todo: "bg-slate-100 text-slate-700",
      in_progress: "bg-blue-100 text-blue-700",
      review: "bg-purple-100 text-purple-700",
      done: "bg-green-100 text-green-700",
    };

    return styles[status] || styles.todo;
  }

  function getPriorityBadge(priority) {
    const styles = {
      low: "bg-slate-100 text-slate-600",
      normal: "bg-indigo-100 text-indigo-700",
      high: "bg-orange-100 text-orange-700",
      urgent: "bg-red-100 text-red-700",
    };

    return styles[priority] || styles.normal;
  }

  return (
 <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
      {showTaskDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Add Task
                </h3>
                <p className="text-sm text-slate-500">
                  Create a personal VA task.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTaskDialog}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={addTask} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Task Title
                </label>

                <input
                  name="title"
                  value={taskForm.title}
                  onChange={updateTaskForm}
                  placeholder="Example: Prepare weekly client report"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  name="description"
                  value={taskForm.description}
                  onChange={updateTaskForm}
                  rows={4}
                  placeholder="Add task details..."
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={taskForm.status}
                    onChange={updateTaskForm}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Priority
                  </label>

                  <select
                    name="priority"
                    value={taskForm.priority}
                    onChange={updateTaskForm}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    {priorityOptions.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Due Date
                  </label>

                  <input
                    type="date"
                    name="due_date"
                    value={taskForm.due_date}
                    onChange={updateTaskForm}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeTaskDialog}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-sm text-slate-500">
            Manage your VA tasks, personal work, and agency-assigned tasks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowTaskDialog(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Task
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
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
              placeholder="Search tasks..."
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

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No tasks found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <div key={task.id} className="p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {task.title}
                      </h3>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(
                          task.status
                        )}`}
                      >
                        {task.status || "todo"}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityBadge(
                          task.priority
                        )}`}
                      >
                        {task.priority || "normal"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      {task.description || "No description"}
                    </p>

                    <p className="mt-3 text-xs text-slate-400">
                      Due: {formatDate(task.due_date)}
                    </p>
                  </div>

                  <div className="w-full lg:w-52">
                    <label className="mb-2 block text-xs font-medium text-slate-500">
                      Update Status
                    </label>

                    <select
                      value={task.status || "todo"}
                      onChange={(e) =>
                        updateTaskStatus(task.id, e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} · {totalTasks} task
            {totalTasks === 1 ? "" : "s"}
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
      </div>
    </main>
  );
}