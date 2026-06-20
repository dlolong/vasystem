"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

    const orgId = profile.organization_id;
    const keyword = search.trim().toLowerCase();

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    /*
      Source of truth:
      Only agency-client app_connections.
      Do NOT load direct clients.organization_id list.
    */
    let connectionsQuery = supabase
      .from("app_connections")
      .select(
        `
      id,
      target_client_id,
      target_email,
      target_user_id,
      target_actual_type,
      hourly_rate,
      currency,
      status,
      created_at
    `,
        { count: "exact" }
      )
      .eq("source_type", "agency")
      .eq("source_organization_id", orgId)
      .eq("target_type", "client")
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false });

    const { data: connections, error: connectionsError } =
      await connectionsQuery;

    if (connectionsError) {
      showToast(connectionsError.message, "error");
      setClients([]);
      setTotalClients(0);
      setLoading(false);
      return;
    }

    const connectionRows = connections || [];

    const connectionClientIds = connectionRows
      .map((connection) => connection.target_client_id)
      .filter(Boolean);

    let connectedClientsById = {};

    if (connectionClientIds.length > 0) {
      const { data: connectedClients, error: connectedClientsError } =
        await supabase
          .from("clients")
          .select(
            `
          id,
          name,
          email,
          phone,
          company_name,
          hourly_rate,
          currency,
          status,
          organization_id,
          user_id,
          created_at
        `
          )
          .in("id", [...new Set(connectionClientIds)]);

      if (connectedClientsError) {
        showToast(connectedClientsError.message, "error");
        setClients([]);
        setTotalClients(0);
        setLoading(false);
        return;
      }

      connectedClientsById = (connectedClients || []).reduce((map, client) => {
        map[client.id] = client;
        return map;
      }, {});
    }

    let mappedClients = connectionRows.map((connection) => {
      const connectedClient = connectedClientsById[connection.target_client_id];

      if (connectedClient) {
        return {
          ...connectedClient,
          row_type: "app_connection",
          app_connection_id: connection.id,
          route_id: connectedClient.id,
          hourly_rate: Number(
            connection.hourly_rate || connectedClient.hourly_rate || 0
          ),
          currency: normalizeCurrency(
            connection.currency || connectedClient.currency
          ),
          status: connection.status || "active",
          can_open: true,
        };
      }

      /*
        Pending invited client:
        There is an app_connections row, but no clients row yet.
      */
      return {
        id: connection.id,
        row_type: "pending_connection",
        app_connection_id: connection.id,
        route_id: connection.id,
        name: connection.target_email || "Pending Client",
        email: connection.target_email || "",
        phone: null,
        company_name: null,
        hourly_rate: Number(connection.hourly_rate || 0),
        currency: normalizeCurrency(connection.currency),
        status: connection.status || "pending",
        organization_id: orgId,
        user_id: connection.target_user_id || null,
        created_at: connection.created_at,
        can_open: false,
      };
    });

    if (keyword) {
      mappedClients = mappedClients.filter((client) => {
        const name = String(client.name || "").toLowerCase();
        const email = String(client.email || "").toLowerCase();
        const company = String(client.company_name || "").toLowerCase();

        return (
          name.includes(keyword) ||
          email.includes(keyword) ||
          company.includes(keyword)
        );
      });
    }

    mappedClients.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    const total = mappedClients.length;
    const paginatedClients = mappedClients.slice(from, to + 1);

    setClients(paginatedClients);
    setTotalClients(total);
    setLoading(false);
  }

  function handleSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function handleClientAdded() {
    setShowAddDialog(false);
    setPage(1);
    loadClients();
  }

  return (
    <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
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
              const CardWrapper = client.can_open ? Link : "div";

              return (
                <CardWrapper
                  key={`${client.row_type}:${client.id}`}
                  href={client.can_open ? `/agency/clients/${client.route_id}` : undefined}
                  className={`block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition ${client.can_open
                      ? "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                      : "opacity-80"
                    }`}
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

                          {client.status === "pending" && (
                            <p className="mt-1 text-xs font-medium text-orange-600">
                              Pending invitation
                            </p>
                          )}
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
                      <span className="truncate">{client.email || "No email"}</span>
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

                  <p className="mt-4 text-sm font-semibold text-blue-600">
                    {client.can_open ? "View client details →" : "Waiting for signup"}
                  </p>
                </CardWrapper>
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