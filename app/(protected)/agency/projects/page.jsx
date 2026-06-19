"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useAppContext } from "@/context/AppContext";

import AppDialog from "@/components/ui/AppDialog";

const PAGE_SIZE = 8;

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

export default function AgencyProjectsPage() {
  const { profile } = useAuthUser();
  const { showToast } = useAppContext();

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [totalProjects, setTotalProjects] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [form, setForm] = useState({
    name: "",
    client_id: "",
    description: "",
    status: "active",
  });

  const totalPages = useMemo(() => {
    return Math.max(Math.ceil(totalProjects / PAGE_SIZE), 1);
  }, [totalProjects]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadClients();
      loadProjects();
    }
  }, [profile, page, search, statusFilter]);

  async function loadClients() {
    if (!profile?.organization_id) return;

    const { data } = await supabase
      .from("clients")
      .select("id, name, email, currency")
      .eq("organization_id", profile.organization_id)
      .eq("status", "active")
      .order("name", { ascending: true });

    setClients(data || []);
  }

  async function loadProjects() {
    if (!profile?.organization_id) return;

    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("projects")
      .select(
        `
        *,
        clients (
          id,
          name,
          email,
          currency
        )
      `,
        { count: "exact" }
      )
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search.trim()) {
      query = query.or(
        `name.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
      );
    }

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error, count } = await query;

    if (error) {
      showToast(error.message, "error");
      setProjects([]);
      setTotalProjects(0);
      setLoading(false);
      return;
    }

    setProjects(data || []);
    setTotalProjects(count || 0);
    setLoading(false);
  }

  function updateForm(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({
      name: "",
      client_id: "",
      description: "",
      status: "active",
    });
  }

  async function addProject(e) {
    e.preventDefault();

    if (!profile?.organization_id) {
      showToast("Agency organization not found.", "error");
      return;
    }

    if (!form.name.trim()) {
      showToast("Project name is required.", "error");
      return;
    }

    setAdding(true);

    const { error } = await supabase.from("projects").insert({
      organization_id: profile.organization_id,
      client_id: form.client_id || null,
      created_by: profile.id,
      name: form.name.trim(),
      description: form.description || null,
      status: form.status,
    });

    if (error) {
      showToast(error.message, "error");
      setAdding(false);
      return;
    }

    showToast("Project added successfully.", "success");

    resetForm();
    setShowAddDialog(false);
    setPage(1);
    setAdding(false);

    await loadProjects();
  }

  async function updateProjectStatus(projectId, status) {
    const { error } = await supabase
      .from("projects")
      .update({ status })
      .eq("id", projectId)
      .eq("organization_id", profile.organization_id);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Project updated.", "success");

    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, status } : project
      )
    );
  }

  function handleSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function getStatusBadge(status) {
    const styles = {
      active: "bg-green-100 text-green-700",
      paused: "bg-orange-100 text-orange-700",
      completed: "bg-blue-100 text-blue-700",
      archived: "bg-slate-100 text-slate-600",
    };

    return styles[status] || styles.active;
  }

  return (
   <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">

      <AppDialog
        open={showAddDialog}
        title="Add Project"
        description="Create a project under your agency workspace."
        onClose={() => setShowAddDialog(false)}
      >
        <form onSubmit={addProject} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Project Name
            </label>

            <input
              name="name"
              value={form.name}
              onChange={updateForm}
              placeholder="Project name"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Client
              </label>

              <select
                name="client_id"
                value={form.client_id}
                onChange={updateForm}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              >
                <option value="">No client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Status
              </label>

              <select
                name="status"
                value={form.status}
                onChange={updateForm}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Description
            </label>

            <textarea
              name="description"
              value={form.description}
              onChange={updateForm}
              rows={4}
              placeholder="Project description..."
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowAddDialog(false)}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={adding}
              className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {adding ? "Adding..." : "Add Project"}
            </button>
          </div>
        </form>
      </AppDialog>

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">
            Manage agency projects and client work.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setShowAddDialog(true)}
            className="h-content inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <Plus size={18} />
            Add Project
          </button>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-600 p-3 text-white">
                <FolderKanban size={20} />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
                  Total Projects
                </p>
                <p className="text-2xl font-bold text-violet-900">
                  {totalProjects}
                </p>
              </div>
            </div>
          </div>
        </div>


      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
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

        {loading ? (
          <SkeletonGrid />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={24} />}
            title="No projects found"
            description="Add a project or try another search keyword."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {project.name}
                    </h3>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                      <UserRound size={15} />
                      {project.clients?.name || "No client"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(
                      project.status
                    )}`}
                  >
                    {project.status || "active"}
                  </span>
                </div>

                <p className="mt-4 line-clamp-3 text-sm text-slate-500">
                  {project.description || "No description"}
                </p>

                <div className="mt-5">
                  <label className="mb-2 block text-xs font-medium text-slate-500">
                    Update Status
                  </label>

                  <select
                    value={project.status || "active"}
                    onChange={(e) =>
                      updateProjectStatus(project.id, e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={totalProjects}
          label="project"
          onPrev={() => setPage((prev) => Math.max(prev - 1, 1))}
          onNext={() => setPage((prev) => Math.min(prev + 1, totalPages))}
        />
      </section>
    </main>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div
          key={item}
          className="h-44 animate-pulse rounded-2xl bg-slate-100"
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
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages} · {total} {label}
        {total === 1 ? "" : "s"}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={16} />
          Prev
        </button>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}