"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  Mail,
  Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useAppContext } from "@/context/AppContext";

import AppDialog from "@/components/ui/AppDialog";
import AddVaByEmailDialog from '@/components/vas/AddVaByEmailDialog';

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

  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddVaDialog, setShowAddVaDialog] = useState(false);

  const totalPages = useMemo(() => {
    return Math.max(Math.ceil(totalVas / PAGE_SIZE), 1);
  }, [totalVas]);

  const organizationId =
    organization?.id ||
    membership?.organization_id ||
    profile?.organization_id ||
    null;

  useEffect(() => {
    if (profile?.organization_id) {
      loadVas();
    }
  }, [profile, page, search]);

  async function loadVas() {
    if (!organizationId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("va_connections")
      .select(
        `
      id,
      connection_type,
      organization_id,
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
      .order("created_at", { ascending: false });

    if (error) {
      showToast(error.message, "error");
      setVas([]);
      setLoading(false);
      return;
    }

    const rows = data || [];

    const vaUserIds = rows.map((item) => item.va_user_id).filter(Boolean);

    let vaUsersById = {};

    if (vaUserIds.length > 0) {
      const { data: vaUsers, error: vaUsersError } = await supabase
        .from("users")
        .select("id, full_name, email, last_active")
        .in("id", vaUserIds);

      if (vaUsersError) {
        showToast(vaUsersError.message, "error");
      }

      vaUsersById = (vaUsers || []).reduce((map, va) => {
        map[va.id] = va;
        return map;
      }, {});
    }

    setVas(
      rows.map((connection) => ({
        ...connection,
        va: connection.va_user_id
          ? vaUsersById[connection.va_user_id] || null
          : null,
      }))
    );

    setLoading(false);
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
            className="h-content inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
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
                <p className="text-2xl font-bold text-indigo-900">{totalVas}</p>
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
                placeholder="Search VA email..."
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-40 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : vas.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Users size={24} />
            </div>

            <h3 className="mt-4 font-semibold text-slate-900">
              No VAs found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Add a VA using their email or try another search keyword.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {vas.map((va) => {
              const online = isOnline(va.last_active);
              const vaId = va.id || va.user_id;

              return (
                <div
                  key={vaId}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold uppercase text-white">
                        {va.email?.charAt(0) || "V"}
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900">
                          {va.full_name || "Virtual Assistant"}
                        </h3>

                        <p className="truncate text-sm text-slate-500">
                          {va.email}
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
                      <p className="text-xs text-slate-500">Role</p>
                      <p className="mt-1 text-sm font-semibold uppercase text-slate-900">
                        {va.role || "VA"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Status</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {va.status || "Active"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-400">
                      Added{" "}
                      {va.created_at
                        ? new Date(va.created_at).toLocaleDateString()
                        : "recently"}
                    </p>

                    <Link
                      href={`/agency/vas/${vaId}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Eye size={16} />
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} · {totalVas} VA
            {totalVas === 1 ? "" : "s"}
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
      </section>
    </main>
  );
}