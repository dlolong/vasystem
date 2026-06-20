"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  Clock,
  Mail,
  Plus,
  Search,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import { formatMoney } from "@/lib/currency";
import AddConnectionDialog from "@/components/connections/AddConnectionDialog";

export default function ClientVasPage() {
  const { showToast } = useAppContext();

  const [authUser, setAuthUser] = useState(null);
  const [clientRecord, setClientRecord] = useState(null);

  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadClientAndProviders();
  }, []);

  async function loadClientAndProviders() {
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
      .select(
        `
        id,
        name,
        email,
        currency,
        organization_id,
        user_id,
        status
      `
      )
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .limit(1);

    if (clientError) {
      showToast(clientError.message, "error");
      setClientRecord(null);
      setConnections([]);
      setLoading(false);
      return;
    }

    const foundClient = clientRows?.[0] || null;

    if (!foundClient) {
      setClientRecord(null);
      setConnections([]);
      setLoading(false);
      return;
    }

    const normalizedClient = {
      ...foundClient,
      currency: normalizeCurrency(foundClient.currency),
    };

    setClientRecord(normalizedClient);

    await loadProviders(normalizedClient);

    setLoading(false);
  }

  async function loadProviders(client = clientRecord) {
    if (!client?.id) return;

    const outgoingQuery = supabase
      .from("app_connections")
      .select(
        `
        id,
        source_type,
        source_user_id,
        source_client_id,
        source_organization_id,
        target_type,
        target_actual_type,
        target_user_id,
        target_client_id,
        target_organization_id,
        target_email,
        status,
        hourly_rate,
        currency,
        created_at
      `
      )
      .eq("source_type", "client")
      .eq("source_client_id", client.id)
      .eq("target_type", "va")
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false });

    const incomingQuery = supabase
      .from("app_connections")
      .select(
        `
        id,
        source_type,
        source_user_id,
        source_client_id,
        source_organization_id,
        target_type,
        target_actual_type,
        target_user_id,
        target_client_id,
        target_organization_id,
        target_email,
        status,
        hourly_rate,
        currency,
        created_at
      `
      )
      .eq("target_type", "client")
      .eq("target_client_id", client.id)
      .in("source_type", ["va", "agency"])
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false });

    const [outgoingResult, incomingResult] = await Promise.all([
      outgoingQuery,
      incomingQuery,
    ]);

    const errors = [outgoingResult.error, incomingResult.error].filter(Boolean);

    if (errors.length > 0) {
      showToast(errors[0].message, "error");
      setConnections([]);
      return;
    }

    const rows = [...(outgoingResult.data || []), ...(incomingResult.data || [])];

    const userIds = rows
      .flatMap((connection) => [
        connection.source_user_id,
        connection.target_user_id,
      ])
      .filter(Boolean);

    const organizationIds = rows
      .flatMap((connection) => [
        connection.source_organization_id,
        connection.target_organization_id,
      ])
      .filter(Boolean);

    const usersById = await loadUsersById(userIds);
    const organizationsById = await loadOrganizationsById(organizationIds);

    const normalizedRows = rows.map((connection) =>
      normalizeProviderConnection({
        connection,
        client,
        usersById,
        organizationsById,
      })
    );

    setConnections(dedupeConnections(normalizedRows));
  }

  async function loadUsersById(ids = []) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);

    if (uniqueIds.length === 0) return {};

    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .in("id", uniqueIds);

    if (error) {
      showToast(error.message, "error");
      return {};
    }

    return (data || []).reduce((map, item) => {
      map[item.id] = item;
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

    return (data || []).reduce((map, item) => {
      map[item.id] = item;
      return map;
    }, {});
  }

  const filteredConnections = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return connections;

    return connections.filter((connection) => {
      return (
        connection.name.toLowerCase().includes(keyword) ||
        String(connection.email || "").toLowerCase().includes(keyword)
      );
    });
  }, [connections, search]);

  const stats = useMemo(() => {
    return {
      total: connections.length,
      active: connections.filter((item) => item.status === "active").length,
      pending: connections.filter((item) => item.status === "pending").length,
    };
  }, [connections]);

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
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <AddConnectionDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        sourceType="client"
        targetType="va"
        sourceClientId={clientRecord?.id}
        title="Add VA / Provider"
        description="Add a VA by email. If the email belongs to an agency, it will still appear as a VA/provider."
        submitLabel="Add VA"
        onAdded={() => {
          setShowAddDialog(false);
          loadClientAndProviders();
        }}
      />

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My VAs</h1>

          <p className="text-sm text-slate-500">
            Manage VAs and agencies treated as providers for{" "}
            {clientRecord?.name || "your client account"}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Add VA by Email
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Total Providers"
          value={stats.total}
          description="VAs and agencies"
          icon={<Users size={20} />}
          color="blue"
        />

        <StatCard
          title="Active"
          value={stats.active}
          description="Registered and active"
          icon={<UserCheck size={20} />}
          color="emerald"
        />

        <StatCard
          title="Pending"
          value={stats.pending}
          description="Waiting for signup"
          icon={<Clock size={20} />}
          color="orange"
        />
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search VA, provider, agency, or email..."
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <button
              type="button"
              onClick={() => loadProviders(clientRecord)}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading VAs...
          </div>
        ) : filteredConnections.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredConnections.map((connection) => (
              <ProviderRow
                key={connection.key}
                connection={connection}
                clientCurrency={clientRecord?.currency}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function normalizeProviderConnection({
  connection,
  client,
  usersById,
  organizationsById,
}) {
  const isOutgoing = connection.source_type === "client";

  const providerUserId = isOutgoing
    ? connection.target_user_id
    : connection.source_user_id;

  const providerOrganizationId = isOutgoing
    ? connection.target_organization_id
    : connection.source_organization_id;

  const actualType = isOutgoing
    ? connection.target_actual_type
    : connection.source_type;

  const providerUser = usersById[providerUserId];
  const providerOrganization = organizationsById[providerOrganizationId];

  const isAgency =
    actualType === "agency" || Boolean(providerOrganizationId);

  return {
    key: `connection:${connection.id}`,
    id: connection.id,
    app_connection_id: connection.id,
    direction: isOutgoing ? "outgoing" : "incoming",
    kind: isAgency ? "agency_as_va" : "va",
    name: isAgency
      ? providerOrganization?.name || connection.target_email || "Agency"
      : providerUser?.full_name ||
        providerUser?.email ||
        connection.target_email ||
        "Virtual Assistant",
    email: isOutgoing
      ? connection.target_email
      : providerUser?.email || null,
    status: connection.status || "pending",
    hourly_rate: Number(connection.hourly_rate || 0),
    currency: normalizeCurrency(connection.currency || client?.currency),
    provider_user_id: providerUserId || null,
    provider_organization_id: providerOrganizationId || null,
  };
}

function dedupeConnections(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.provider_organization_id
      ? `agency:${row.provider_organization_id}`
      : row.provider_user_id
      ? `user:${row.provider_user_id}`
      : `pending:${row.email || row.id}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...row, key });
      return;
    }

    if (existing.status === "pending" && row.status === "active") {
      map.set(key, { ...row, key });
    }
  });

  return [...map.values()];
}

function StatusBadge({ status }) {
  const styles = {
    active: "bg-green-100 text-green-700",
    pending: "bg-orange-100 text-orange-700",
    inactive: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        styles[status] || styles.pending
      }`}
    >
      {status || "pending"}
    </span>
  );
}

function StatCard({ title, value, description, icon, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 border-blue-100 text-blue-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    orange: "bg-orange-50 border-orange-100 text-orange-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{value}</h3>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>

        <div className={`rounded-2xl border p-3 ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Users size={24} />
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">No VAs yet</h3>

      <p className="mt-1 text-sm text-slate-500">
        Add a VA or agency by email so you can assign tasks and receive
        invoices.
      </p>
    </div>
  );
}

function normalizeCurrency(currency) {
  return currency?.trim()?.toUpperCase() || "USD";
}

function ProviderRow({ connection, clientCurrency }) {
  const currency = normalizeCurrency(connection.currency || clientCurrency);

  return (
    <Link
      href={`/client/vas/${connection.id}`}
      className="grid grid-cols-1 gap-4 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[1.5fr_1fr_150px] lg:items-center"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            connection.kind === "agency_as_va"
              ? "bg-indigo-50 text-indigo-600"
              : "bg-blue-50 text-blue-600"
          }`}
        >
          {connection.kind === "agency_as_va" ? (
            <Building2 size={20} />
          ) : (
            <UserRound size={20} />
          )}
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{connection.name}</h3>

          {connection.email && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500">
              <Mail size={14} />
              {connection.email}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={connection.status} />

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {connection.kind === "agency_as_va" ? "Agency as VA" : "VA"}
            </span>

            {connection.direction === "incoming" && (
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                Added you
              </span>
            )}
          </div>

          {connection.status === "pending" && (
            <p className="mt-2 text-xs text-orange-600">
              This provider has not registered yet.
            </p>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm text-slate-500">Hourly Rate</p>
        <p className="font-semibold text-slate-900">
          {formatMoney(connection.hourly_rate || 0, currency)} / hr
        </p>
        <p className="mt-1 text-xs text-slate-400">{currency}</p>
      </div>

      <div className="lg:text-right">
        <p className="text-sm font-semibold text-blue-600">Open Profile</p>
        <p className="mt-1 text-xs text-slate-400">Tasks and invoices</p>
      </div>
    </Link>
  );
}