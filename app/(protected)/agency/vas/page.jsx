"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Mail,
  Plus,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import AddVaByEmailDialog from "@/components/vas/AddVaByEmailDialog";
import { formatMoney } from "@/lib/currency";

const PAGE_SIZE = 8;

function isOnline(lastActive) {
  if (!lastActive) return false;

  const diff = Date.now() - new Date(lastActive).getTime();
  return diff < 60 * 1000;
}

export default function VasPage() {
  const { showToast, profile, membership, organization } = useAppContext();

  const [vas, setVas] = useState([]);
  const [totalVas, setTotalVas] = useState(0);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [showAddVaDialog, setShowAddVaDialog] = useState(false);

  const organizationId =
    organization?.id ||
    membership?.organization_id ||
    profile?.organization_id ||
    null;

  const totalPages = useMemo(() => {
    return Math.max(Math.ceil(totalVas / PAGE_SIZE), 1);
  }, [totalVas]);

  useEffect(() => {
    if (organizationId) {
      loadVas();
      return;
    }

    setVas([]);
    setTotalVas(0);
    setLoading(false);
  }, [organizationId, page, search]);

  async function loadVas() {
    if (!organizationId) {
      setVas([]);
      setTotalVas(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: connections, error } = await supabase
      .from("app_connections")
      .select(`
      id,
      source_type,
      source_organization_id,
      target_type,
      target_actual_type,
      target_user_id,
      target_organization_id,
      target_email,
      status,
      hourly_rate,
      currency,
      created_at
    `)
      .eq("source_type", "agency")
      .eq("source_organization_id", organizationId)
      .eq("target_type", "va")
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadVas app_connections error:", error);
      showToast(error.message, "error");
      setVas([]);
      setTotalVas(0);
      setLoading(false);
      return;
    }

    console.log("Agency VA app_connections:", connections);

    const userIds = (connections || [])
      .map((connection) => connection.target_user_id)
      .filter(Boolean);

    let usersById = {};

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email, role, last_active")
        .in("id", userIds);

      if (usersError) {
        console.error("loadVas users error:", usersError);
      }

      usersById = (users || []).reduce((map, user) => {
        map[user.id] = user;
        return map;
      }, {});
    }

    let rows = (connections || []).map((connection) => {
      const user = usersById[connection.target_user_id];

      return {
        key: connection.id,
        id: connection.id,
        app_connection_id: connection.id,
        user_id: connection.target_user_id || null,
        full_name:
          user?.full_name ||
          user?.email ||
          connection.target_email ||
          "Pending VA",
        email: user?.email || connection.target_email || "",
        role: user?.role || "va",
        status: connection.status || "pending",
        hourly_rate: Number(connection.hourly_rate || 0),
        currency: normalizeCurrency(connection.currency),
        created_at: connection.created_at,
        last_active: user?.last_active || null,
      };
    });

    const keyword = search.trim().toLowerCase();

    if (keyword) {
      rows = rows.filter((va) => {
        return (
          String(va.full_name || "").toLowerCase().includes(keyword) ||
          String(va.email || "").toLowerCase().includes(keyword) ||
          String(va.status || "").toLowerCase().includes(keyword)
        );
      });
    }

    setTotalVas(rows.length);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;

    setVas(rows.slice(from, to));
    setLoading(false);
  }

  async function loadUsersById(ids = []) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);

    if (uniqueIds.length === 0) return {};

    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, role, last_active")
      .in("id", uniqueIds);

    if (error) {
      showToast(error.message, "error");
      return {};
    }

    return (data || []).reduce((map, user) => {
      map[user.id] = user;
      return map;
    }, {});
  }

  async function loadOrganizationsById(ids = []) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);

    if (uniqueIds.length === 0) return {};

    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .in("id", uniqueIds);

    if (error) {
      showToast(error.message, "error");
      return {};
    }

    return (data || []).reduce((map, organization) => {
      map[organization.id] = organization;
      return map;
    }, {});
  }

  function handleSearch(value) {
    setSearch(value);
    setPage(1);
  }

  return (
    <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
      <AddVaByEmailDialog
        open={showAddVaDialog}
        onClose={() => setShowAddVaDialog(false)}
        mode="agency"
        organizationId={organizationId}
        onAdded={() => {
          setShowAddVaDialog(false);
          setPage(1);
          loadVas();
        }}
      />

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Virtual Assistants
          </h1>
          <p className="text-sm text-slate-500">
            Manage the VAs connected to your agency workspace.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setShowAddVaDialog(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={18} />
            Add VA
          </button>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-600 p-3 text-white">
                <Users size={20} />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                  Total VAs
                </p>
                <p className="text-2xl font-bold text-indigo-900">
                  {totalVas}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">VA List</h2>
              <p className="text-sm text-slate-500">
                Search, view, and manage your agency VAs.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search VA name or email..."
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : vas.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {vas.map((va) => {
              const online = isOnline(va.last_active);
              const currency = normalizeCurrency(va.currency);
               const CardWrapper = va.status !== "pending" ? Link : "div";

              return (
                <CardWrapper
                  key={va.key}
                   href={va.status !== "pending" ? `/agency/vas/${va.id}` : undefined}
                  className={`block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition ${va.status !== "pending"
                      ? "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                      : "opacity-80"
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold uppercase text-white ${va.kind === "agency_as_va"
                          ? "bg-slate-800"
                          : "bg-indigo-600"
                          }`}
                      >
                        {va.name?.charAt(0) || "V"}
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900">
                          {va.name}
                        </h3>

                        <p className="truncate text-sm text-slate-500">
                          {va.email || "No email"}
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
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Type</p>
                      <p className="mt-1 text-sm font-semibold uppercase text-slate-900">
                        {va.kind === "agency_as_va" ? "Agency" : "VA"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Status</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {va.status || "pending"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <Wallet size={14} />
                      Hourly Rate
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {formatMoney(va.hourly_rate || 0, currency)} / hr
                    </p>

                    <p className="mt-1 text-xs text-slate-400">{currency}</p>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-400">
                      Added{" "}
                      {va.created_at
                        ? new Date(va.created_at).toLocaleDateString()
                        : "recently"}
                    </p>
                  </div>



                  {va.status === "pending" ? (
                    <p className="mt-3 flex items-center gap-2 text-xs text-orange-600">
                      <Mail size={14} />
                      Waiting for VA signup.
                    </p>
                  ) : (
                    <p className="mt-4 text-sm font-semibold text-blue-600">
                      View client details →
                    </p>
                  )}
                </CardWrapper>
              );
            })}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          totalVas={totalVas}
          onPrev={() => setPage((prev) => Math.max(prev - 1, 1))}
          onNext={() => setPage((prev) => Math.min(prev + 1, totalPages))}
        />
      </section>
    </main>
  );
}

function normalizeAppConnection(connection, usersById, organizationsById) {
  const user = usersById[connection.target_user_id] || null;
  const organization = organizationsById[connection.target_organization_id];

  const isAgencyAsVa =
    connection.target_actual_type === "agency" ||
    Boolean(connection.target_organization_id);

  return {
    key: `app:${connection.id}`,
    id: connection.id,
    source_table: "app_connections",
    kind: isAgencyAsVa ? "agency_as_va" : "va",
    name: isAgencyAsVa
      ? organization?.name || connection.target_email || "Agency Provider"
      : user?.full_name ||
      user?.email ||
      connection.target_email ||
      "Virtual Assistant",
    email: user?.email || connection.target_email || "",
    status: connection.status || "pending",
    role: isAgencyAsVa ? "agency" : "va",
    hourly_rate: Number(connection.hourly_rate || 0),
    currency: normalizeCurrency(connection.currency),
    created_at: connection.created_at,
    last_active: user?.last_active || null,
    user_id: connection.target_user_id || null,
    organization_id: connection.target_organization_id || null,
  };
}

function normalizeLegacyConnection(connection, usersById) {
  const user = usersById[connection.va_user_id] || null;

  return {
    key: `legacy:${connection.id}`,
    id: connection.id,
    source_table: "va_connections",
    kind: "va",
    name:
      user?.full_name ||
      user?.email ||
      connection.va_email ||
      "Virtual Assistant",
    email: user?.email || connection.va_email || "",
    status: connection.status || "pending",
    role: "va",
    hourly_rate: Number(connection.hourly_rate || 0),
    currency: normalizeCurrency(connection.currency),
    created_at: connection.created_at,
    last_active: user?.last_active || null,
    user_id: connection.va_user_id || null,
    organization_id: connection.organization_id || null,
  };
}

function dedupeVas(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.user_id
      ? `user:${row.user_id}`
      : row.organization_id && row.kind === "agency_as_va"
        ? `agency:${row.organization_id}`
        : `email:${row.email || row.id}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, row);
      return;
    }

    if (existing.source_table === "va_connections" && row.source_table === "app_connections") {
      map.set(key, row);
      return;
    }

    if (existing.status === "pending" && row.status === "active") {
      map.set(key, row);
    }
  });

  return [...map.values()].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;

    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}

function normalizeCurrency(currency) {
  return currency?.trim()?.toUpperCase() || "USD";
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

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Users size={24} />
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">No VAs found</h3>

      <p className="mt-1 text-sm text-slate-500">
        Add a VA using their email or try another search keyword.
      </p>
    </div>
  );
}

function Pagination({ page, totalPages, totalVas, onPrev, onNext }) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages} · {totalVas} VA
        {totalVas === 1 ? "" : "s"}
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