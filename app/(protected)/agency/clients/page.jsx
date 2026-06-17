"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  UserRound,
  Mail,
  Phone,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useAppContext } from "@/context/AppContext";
import AddClientDialog from "@/components/AddClientDialog";
import { formatMoney } from "@/lib/currency";

const PAGE_SIZE = 8;

export default function AgencyClientsPage() {
  const { profile } = useAuthUser();
  const { showToast } = useAppContext();

  const [clients, setClients] = useState([]);
  const [totalClients, setTotalClients] = useState(0);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [showAddDialog, setShowAddDialog] = useState(false);

  const totalPages = useMemo(() => {
    return Math.max(Math.ceil(totalClients / PAGE_SIZE), 1);
  }, [totalClients]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadClients();
    }
  }, [profile?.organization_id, page, search]);

  async function loadClients() {
    if (!profile?.organization_id) return;

    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("clients")
      .select(
        `
        id,
        name,
        email,
        hourly_rate,
        currency,
        status,
        organization_id,
        user_id,
        created_at
      `,
        { count: "exact" }
      )
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search.trim()) {
      const keyword = search.trim();

      query = query.or(
        `name.ilike.%${keyword}%,email.ilike.%${keyword}%,company_name.ilike.%${keyword}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      showToast(error.message, "error");
      setClients([]);
      setTotalClients(0);
      setLoading(false);
      return;
    }

    setClients(
      (data || []).map((client) => ({
        ...client,
        currency: normalizeCurrency(client.currency),
      }))
    );

    setTotalClients(count || 0);
    setLoading(false);
  }

  function handleSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function handleClientAdded(newClient) {
    const normalizedClient = {
      ...newClient,
      currency: normalizeCurrency(newClient?.currency),
    };

    setClients((prev) => [normalizedClient, ...prev]);
    setShowAddDialog(false);
    setPage(1);
    loadClients();
  }

  return (
    <main className="space-y-6">
      <AddClientDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onClientAdded={handleClientAdded}
        mode="agency"
        organizationId={profile?.organization_id}
      />

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">
            Manage clients connected to your agency workspace.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Client
          </button>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-600 p-3 text-white">
                <UserRound size={20} />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Total Clients
                </p>
                <p className="text-2xl font-bold text-blue-900">
                  {totalClients}
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
              <h2 className="text-lg font-semibold text-slate-900">
                Client List
              </h2>
              <p className="text-sm text-slate-500">
                Search and manage your agency clients with their preferred
                currency.
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
                placeholder="Search clients..."
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <SkeletonGrid />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<UserRound size={24} />}
            title="No clients found"
            description="Add a client or try another search keyword."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => {
              const currency = normalizeCurrency(client.currency);

              return (
                <div
                  key={client.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-2xl bg-blue-600 text-sm uppercase text-white">
                      {client.name?.charAt(0) || "C"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-slate-900">
                            {client.name}
                          </h3>
                        </div>

                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2">
                      <Mail size={15} />
                      <span className="truncate">
                        {client.email || "No email"}
                      </span>
                    </p>
                  </div>

                  <div className="mt-5 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Hourly Rate</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {formatMoney(client.hourly_rate || 0, currency)} / hr
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      Preferred currency: {currency}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={totalClients}
          label="client"
          onPrev={() => setPage((prev) => Math.max(prev - 1, 1))}
          onNext={() => setPage((prev) => Math.min(prev + 1, totalPages))}
        />
      </section>
    </main>
  );
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