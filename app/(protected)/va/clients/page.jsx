"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Eye,
  Grid2X2,
  List,
  Mail,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AddClientDialog from "@/components/AddClientDialog";
import { formatMoney } from "@/lib/currency";

export default function VaClientsPage() {
  const router = useRouter();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("thumbnail");

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return clients;

    return clients.filter((client) => {
      return (
        String(client.name || "").toLowerCase().includes(keyword) ||
        String(client.email || "").toLowerCase().includes(keyword) ||
        String(client.status || "").toLowerCase().includes(keyword) ||
        String(client.kind || "").toLowerCase().includes(keyword)
      );
    });
  }, [clients, search]);

  async function loadClients() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setClients([]);
      setLoading(false);
      return;
    }

    await supabase.rpc("claim_app_connections");

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
        status,
        created_at
      `
      )
      .eq("user_id", user.id)
      .in("status", ["active", "pending"])
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
      .eq("source_user_id", user.id)
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
      .eq("target_user_id", user.id)
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
      console.error(errors[0].message);
      setClients([]);
      setLoading(false);
      return;
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
      ...outgoingConnections.map(
        (connection) => connection.target_organization_id
      ),
      ...incomingConnections.map(
        (connection) => connection.source_organization_id
      ),
    ].filter(Boolean);

    const clientsById = await loadClientsById(clientIds);
    const organizationsById = await loadOrganizationsById(organizationIds);

    const rows = [];

    ownedClients.forEach((client) => {
      rows.push(createOwnedClientRow(client));
    });

    outgoingConnections.forEach((connection) => {
      rows.push(
        createOutgoingConnectionRow({
          connection,
          clientsById,
          organizationsById,
        })
      );
    });

    incomingConnections.forEach((connection) => {
      rows.push(
        createIncomingConnectionRow({
          connection,
          clientsById,
          organizationsById,
        })
      );
    });

    setClients(dedupeClientRows(rows));
    setLoading(false);
  }

  async function loadClientsById(ids = []) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);

    if (uniqueIds.length === 0) return {};

    const { data, error } = await supabase
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
        status,
        created_at
      `
      )
      .in("id", uniqueIds);

    if (error) {
      console.error(error.message);
      return {};
    }

    return (data || []).reduce((map, client) => {
      map[client.id] = client;
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
      console.error(error.message);
      return {};
    }

    return (data || []).reduce((map, organization) => {
      map[organization.id] = organization;
      return map;
    }, {});
  }

  return (
    <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
      <AddClientDialog
        open={showClientDialog}
        onClose={() => setShowClientDialog(false)}
        onClientAdded={() => {
          setShowClientDialog(false);
          loadClients();
        }}
      />

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Clients</h1>
          <p className="text-sm text-slate-500">
            Clients and agencies connected to your VA workspace.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={loadClients}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowClientDialog(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Client
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Active Clients"
          value={clients.filter((client) => client.status === "active").length}
          icon={<Users size={20} />}
        />

        <SummaryCard
          title="Pending Invites"
          value={clients.filter((client) => client.status === "pending").length}
          icon={<Mail size={20} />}
        />

        <SummaryCard
          title="Agency Clients"
          value={
            clients.filter((client) => client.kind === "agency_as_client")
              .length
          }
          icon={<Building2 size={20} />}
        />
      </div>

      <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-md">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client name, email, or status..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode("thumbnail")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                viewMode === "thumbnail"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              <Grid2X2 size={16} />
              Thumbnail
            </button>

            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                viewMode === "table"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              <List size={16} />
              Table
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading clients...
          </div>
        ) : filteredClients.length === 0 ? (
          <EmptyState onAdd={() => setShowClientDialog(true)} />
        ) : viewMode === "table" ? (
          <div className="max-h-full overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Rate</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredClients.map((client) => (
                  <tr
                    key={client.key}
                    onClick={() => router.push(`/va/clients/${client.route_id}`)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <ClientIcon client={client} />

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {client.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {client.email || "No email"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {client.kind === "agency_as_client"
                        ? "Agency as Client"
                        : "Client"}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={client.status} />
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-slate-900">
                      {formatMoney(
                        client.hourly_rate || 0,
                        normalizeCurrency(client.currency)
                      )}
                      <span className="text-xs font-normal text-slate-400">
                        {" "}
                        / hr
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                        <Eye size={16} />
                        View
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredClients.map((client) => (
              <ClientCard key={client.key} client={client} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ClientCard({ client }) {
  const currency = normalizeCurrency(client.currency);

  return (
    <Link
      href={`/va/clients/${client.route_id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ClientIcon client={client} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold text-slate-900">
                {client.name}
              </h3>

              <StatusBadge status={client.status} />
            </div>

            <p className="mt-1 truncate text-sm text-slate-500">
              {client.email || "No email"}
            </p>

            {client.direction === "incoming" && (
              <p className="mt-1 text-xs text-purple-600">Added you</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Hourly Rate</p>
        <p className="mt-1 font-semibold text-slate-900">
          {formatMoney(client.hourly_rate || 0, currency)} / hr
        </p>
        <p className="mt-1 text-xs text-slate-400">{currency}</p>
      </div>

      <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
        <Eye size={16} />
        View client details
      </p>
    </Link>
  );
}

function ClientIcon({ client }) {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
        client.kind === "agency_as_client"
          ? "bg-indigo-100 text-indigo-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {client.kind === "agency_as_client" ? (
        <Building2 size={20} />
      ) : (
        <UserRound size={20} />
      )}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Users size={24} />
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">No clients found</h3>

      <p className="mt-1 text-sm text-slate-500">
        Add a client by email or change your search keyword.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <Plus size={16} />
        Add Client
      </button>
    </div>
  );
}

function SummaryCard({ title, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className="text-blue-600">{icon}</div>
      </div>

      <h2 className="mt-3 text-2xl font-bold text-slate-900">{value}</h2>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active: "bg-green-100 text-green-700",
    pending: "bg-orange-100 text-orange-700",
    inactive: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] || styles.pending
      }`}
    >
      {status || "pending"}
    </span>
  );
}

function createOwnedClientRow(client) {
  return {
    key: `owned-client:${client.id}`,
    route_id: client.id,
    id: client.id,
    client_id: client.id,
    organization_id: client.organization_id || null,
    connection_id: null,
    direction: "owned",
    source: "clients",
    kind: "client",
    name: client.name || client.email || "Client",
    email: client.email || null,
    status: client.status || "active",
    hourly_rate: Number(client.hourly_rate || 0),
    currency: normalizeCurrency(client.currency),
    created_at: client.created_at,
  };
}

function createOutgoingConnectionRow({
  connection,
  clientsById,
  organizationsById,
}) {
  const isAgency =
    connection.target_actual_type === "agency" ||
    Boolean(connection.target_organization_id);

  if (isAgency) {
    const organization = organizationsById[connection.target_organization_id];

    return {
      key: `outgoing-agency:${connection.id}`,
      route_id: connection.id,
      id: connection.target_organization_id || connection.id,
      client_id: null,
      organization_id: connection.target_organization_id || null,
      connection_id: connection.id,
      direction: "outgoing",
      source: "app_connections",
      kind: "agency_as_client",
      name: organization?.name || connection.target_email || "Agency",
      email: connection.target_email || null,
      status: connection.status || "pending",
      hourly_rate: Number(connection.hourly_rate || 0),
      currency: normalizeCurrency(connection.currency),
      created_at: connection.created_at,
    };
  }

  const client = clientsById[connection.target_client_id];

  return {
    key: `outgoing-client:${connection.id}`,
    route_id: connection.id,
    id: connection.target_client_id || connection.id,
    client_id: connection.target_client_id || null,
    organization_id: client?.organization_id || null,
    connection_id: connection.id,
    direction: "outgoing",
    source: "app_connections",
    kind: "client",
    name: client?.name || connection.target_email || "Client",
    email: client?.email || connection.target_email || null,
    status: connection.status || "pending",
    hourly_rate: Number(connection.hourly_rate || client?.hourly_rate || 0),
    currency: normalizeCurrency(connection.currency || client?.currency),
    created_at: connection.created_at,
  };
}

function createIncomingConnectionRow({
  connection,
  clientsById,
  organizationsById,
}) {
  if (connection.source_type === "agency") {
    const organization = organizationsById[connection.source_organization_id];

    return {
      key: `incoming-agency:${connection.id}`,
      route_id: connection.id,
      id: connection.source_organization_id || connection.id,
      client_id: null,
      organization_id: connection.source_organization_id || null,
      connection_id: connection.id,
      direction: "incoming",
      source: "app_connections",
      kind: "agency_as_client",
      name: organization?.name || "Agency",
      email: connection.target_email || null,
      status: connection.status || "pending",
      hourly_rate: Number(connection.hourly_rate || 0),
      currency: normalizeCurrency(connection.currency),
      created_at: connection.created_at,
    };
  }

  const client = clientsById[connection.source_client_id];

  return {
    key: `incoming-client:${connection.id}`,
    route_id: connection.id,
    id: connection.source_client_id || connection.id,
    client_id: connection.source_client_id || null,
    organization_id: client?.organization_id || null,
    connection_id: connection.id,
    direction: "incoming",
    source: "app_connections",
    kind: "client",
    name: client?.name || "Client",
    email: client?.email || null,
    status: connection.status || "pending",
    hourly_rate: Number(connection.hourly_rate || client?.hourly_rate || 0),
    currency: normalizeCurrency(connection.currency || client?.currency),
    created_at: connection.created_at,
  };
}

function dedupeClientRows(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.client_id
      ? `client:${row.client_id}`
      : row.organization_id
      ? `agency:${row.organization_id}`
      : `pending:${row.email || row.connection_id}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...row,
        key,
      });
      return;
    }

    if (existing.status === "pending" && row.status === "active") {
      map.set(key, {
        ...row,
        key,
      });
    }

    if (!existing.connection_id && row.connection_id) {
      map.set(key, {
        ...row,
        key,
      });
    }
  });

  return [...map.values()].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function normalizeCurrency(currency) {
  return currency?.trim()?.toUpperCase() || "USD";
}