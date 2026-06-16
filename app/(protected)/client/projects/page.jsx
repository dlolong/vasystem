"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";

const PAGE_SIZE = 8;

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

export default function ClientProjectsPage() {
  const { showToast } = useAppContext();

  const [authUser, setAuthUser] = useState(null);
  const [clientRecord, setClientRecord] = useState(null);

  const [projects, setProjects] = useState([]);
  const [totalProjects, setTotalProjects] = useState(0);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const totalPages = useMemo(() => {
    return Math.max(Math.ceil(totalProjects / PAGE_SIZE), 1);
  }, [totalProjects]);

  useEffect(() => {
    loadClient();
  }, []);

  useEffect(() => {
    if (clientRecord?.id) {
      loadProjects();
    }
  }, [clientRecord, page, search, statusFilter]);

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
      .select("*")
      .eq("user_id", user.id)
      .limit(1);

    if (clientByUser?.length > 0) {
      foundClient = clientByUser[0];
    }

    if (!foundClient && user.email) {
      let emailQuery = supabase
        .from("clients")
        .select("*")
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

    setClientRecord(foundClient || null);
    setLoading(false);
  }

  async function loadProjects() {
    if (!clientRecord?.id) return;

    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("projects")
      .select("*", { count: "exact" })
      .eq("client_id", clientRecord.id)
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

  function getStatusBadge(status) {
    const styles = {
      active: "bg-green-100 text-green-700",
      paused: "bg-orange-100 text-orange-700",
      completed: "bg-blue-100 text-blue-700",
      archived: "bg-slate-100 text-slate-600",
    };

    return styles[status] || styles.active;
  }

  function formatDate(date) {
    if (!date) return "No date";

    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
    <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <div className="flex shrink-0 flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">
            View projects assigned to {clientRecord?.name || "your account"}.
          </p>
        </div>

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

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <SkeletonGrid />
          ) : projects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban size={24} />}
              title="No projects found"
              description="There are no projects assigned to you yet."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 2xl:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900">
                        {project.name}
                      </h3>

                      <p className="mt-1 text-xs text-slate-400">
                        Created {formatDate(project.created_at)}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(
                        project.status
                      )}`}
                    >
                      {project.status || "active"}
                    </span>
                  </div>

                  <p className="mt-4 line-clamp-4 text-sm text-slate-500">
                    {project.description || "No description"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

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
    <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 2xl:grid-cols-3">
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
    <div className="shrink-0 flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
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