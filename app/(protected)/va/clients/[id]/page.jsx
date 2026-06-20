"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Mail,
  ReceiptText,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import { formatMoney } from "@/lib/currency";

export default function VaClientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params?.id;

  const { showToast } = useAppContext();

  const [authUser, setAuthUser] = useState(null);
  const [client, setClient] = useState(null);
  const [connection, setConnection] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const currency = normalizeCurrency(client?.currency);
  const isAgencyClient = client?.kind === "agency_as_client";

  const totalInvoices = useMemo(() => {
    return invoices.reduce(
      (sum, invoice) => sum + Number(invoice.total_amount || 0),
      0
    );
  }, [invoices]);

  useEffect(() => {
    if (routeId) {
      loadDetails();
    }
  }, [routeId]);

  async function loadDetails() {
    setLoading(true);
    setNotFound(false);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      showToast(userError.message, "error");
      setLoading(false);
      return;
    }

    if (!user) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setAuthUser(user);

    await supabase.rpc("claim_app_connections");

    let selectedConnection = null;
    let selectedClient = null;

    const { data: connectionData, error: connectionError } = await supabase
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
      .eq("id", routeId)
      .maybeSingle();

    if (connectionError) {
      showToast(connectionError.message, "error");
      setLoading(false);
      return;
    }

    if (connectionData) {
      const belongsToVa =
        (connectionData.source_type === "va" &&
          connectionData.source_user_id === user.id) ||
        (connectionData.target_type === "va" &&
          connectionData.target_user_id === user.id);

      if (!belongsToVa) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      selectedConnection = connectionData;
      selectedClient = await buildClientFromConnection(connectionData);
    }

    if (!selectedClient) {
      const { data: ownedClient, error: ownedClientError } = await supabase
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
        .eq("id", routeId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (ownedClientError) {
        showToast(ownedClientError.message, "error");
        setLoading(false);
        return;
      }

      if (ownedClient) {
        selectedClient = createClientObject({
          client: ownedClient,
          connection: null,
          direction: "owned",
        });
      }
    }

    if (!selectedClient) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setClient(selectedClient);
    setConnection(selectedConnection);

    await Promise.all([
      loadTasks({
        userId: user.id,
        clientId: selectedClient.client_id,
        organizationId: selectedClient.organization_id,
        appConnectionId: selectedConnection?.id || null,
      }),
      loadInvoices({
        userId: user.id,
        clientId: selectedClient.client_id,
        organizationId: selectedClient.organization_id,
      }),
    ]);

    setLoading(false);
  }

  async function buildClientFromConnection(connectionData) {
    if (connectionData.source_type === "va") {
      const isAgency =
        connectionData.target_actual_type === "agency" ||
        Boolean(connectionData.target_organization_id);

      if (isAgency) {
        const organization = await loadOrganization(
          connectionData.target_organization_id
        );

        return {
          route_id: connectionData.id,
          connection_id: connectionData.id,
          client_id: null,
          organization_id: connectionData.target_organization_id || null,
          kind: "agency_as_client",
          direction: "outgoing",
          name: organization?.name || connectionData.target_email || "Agency",
          email: connectionData.target_email || null,
          status: connectionData.status || "pending",
          hourly_rate: Number(connectionData.hourly_rate || 0),
          currency: normalizeCurrency(connectionData.currency),
          created_at: connectionData.created_at,
        };
      }

      const clientRecord = connectionData.target_client_id
        ? await loadClient(connectionData.target_client_id)
        : null;

      return {
        route_id: connectionData.id,
        connection_id: connectionData.id,
        client_id: clientRecord?.id || connectionData.target_client_id || null,
        organization_id: clientRecord?.organization_id || null,
        kind: "client",
        direction: "outgoing",
        name:
          clientRecord?.name || connectionData.target_email || "Pending Client",
        email: clientRecord?.email || connectionData.target_email || null,
        status: connectionData.status || "pending",
        hourly_rate: Number(
          connectionData.hourly_rate || clientRecord?.hourly_rate || 0
        ),
        currency: normalizeCurrency(
          connectionData.currency || clientRecord?.currency
        ),
        created_at: connectionData.created_at,
      };
    }

    if (connectionData.source_type === "agency") {
      const organization = await loadOrganization(
        connectionData.source_organization_id
      );

      return {
        route_id: connectionData.id,
        connection_id: connectionData.id,
        client_id: null,
        organization_id: connectionData.source_organization_id || null,
        kind: "agency_as_client",
        direction: "incoming",
        name: organization?.name || "Agency",
        email: connectionData.target_email || null,
        status: connectionData.status || "pending",
        hourly_rate: Number(connectionData.hourly_rate || 0),
        currency: normalizeCurrency(connectionData.currency),
        created_at: connectionData.created_at,
      };
    }

    const clientRecord = connectionData.source_client_id
      ? await loadClient(connectionData.source_client_id)
      : null;

    return {
      route_id: connectionData.id,
      connection_id: connectionData.id,
      client_id: clientRecord?.id || connectionData.source_client_id || null,
      organization_id: clientRecord?.organization_id || null,
      kind: "client",
      direction: "incoming",
      name: clientRecord?.name || "Client",
      email: clientRecord?.email || null,
      status: connectionData.status || "pending",
      hourly_rate: Number(
        connectionData.hourly_rate || clientRecord?.hourly_rate || 0
      ),
      currency: normalizeCurrency(
        connectionData.currency || clientRecord?.currency
      ),
      created_at: connectionData.created_at,
    };
  }

  async function loadClient(clientId) {
    if (!clientId) return null;

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
      .eq("id", clientId)
      .maybeSingle();

    if (error) {
      console.error(error.message);
      return null;
    }

    return data || null;
  }

  async function loadOrganization(organizationId) {
    if (!organizationId) return null;

    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .maybeSingle();

    if (error) {
      console.error(error.message);
      return null;
    }

    return data || null;
  }

  async function loadTasks({
    userId,
    clientId,
    organizationId,
    appConnectionId,
  }) {
    const filters = [];

    if (appConnectionId) {
      filters.push(`app_connection_id.eq.${appConnectionId}`);
    }

    if (clientId) {
      filters.push(`source_client_id.eq.${clientId}`);
      filters.push(`client_id.eq.${clientId}`);
    }

    if (organizationId) {
      filters.push(`source_organization_id.eq.${organizationId}`);
      filters.push(`organization_id.eq.${organizationId}`);
    }

    if (filters.length === 0) {
      setTasks([]);
      return;
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .or(filters.join(","))
      .order("created_at", { ascending: false });

    if (error) {
      showToast(error.message, "error");
      setTasks([]);
      return;
    }

    const assignedToVa = (data || []).filter((task) => {
      return (
        task.assigned_to === userId ||
        task.assigned_to_type === "va" ||
        task.app_connection_id === appConnectionId
      );
    });

    setTasks(assignedToVa);
  }

  async function loadInvoices({ userId, clientId, organizationId }) {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        total_amount,
        status,
        due_date,
        created_at,
        currency,
        user_id,
        created_by,
        creator_type,
        creator_id,
        client_id,
        bill_to_client_id,
        bill_to_organization_id,
        public_token,
        payment_link
      `
      )
      .or(`user_id.eq.${userId},created_by.eq.${userId},creator_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      showToast(error.message, "error");
      setInvoices([]);
      return;
    }

    const relatedInvoices = (data || []).filter((invoice) => {
      if (clientId) {
        return (
          invoice.client_id === clientId ||
          invoice.bill_to_client_id === clientId
        );
      }

      if (organizationId) {
        return invoice.bill_to_organization_id === organizationId;
      }

      return false;
    });

    setInvoices(relatedInvoices);
  }

  async function handleRemoveClient() {
    if (!client) return;

    const confirmed = window.confirm(
      `Remove ${client.name || client.email} from your VA clients?\n\nThis will only remove the connection. It will not delete tasks or invoices.`
    );

    if (!confirmed) return;

    setRemoving(true);

    try {
      const { error } = await supabase.rpc("remove_va_client_connection", {
        p_connection_id: connection?.id || null,
        p_client_id: client.client_id || null,
      });

      if (error) throw error;

      showToast("Client connection removed.", "success");
      router.replace("/va/clients");
    } catch (error) {
      showToast(error.message || "Unable to remove client.", "error");
    }

    setRemoving(false);
  }

  if (loading) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading client details...
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="font-semibold text-red-900">Client not found</h1>
          <p className="mt-1 text-sm text-red-700">
            This client connection does not exist or does not belong to your VA
            workspace.
          </p>

          <Link
            href="/va/clients"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <ArrowLeft size={16} />
            Back to Clients
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <Link
            href="/va/clients"
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Back to Clients
          </Link>

          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                isAgencyClient
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {isAgencyClient ? <Building2 size={24} /> : <UserRound size={24} />}
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {client.name}
              </h1>
              <p className="text-sm text-slate-500">
                {isAgencyClient ? "Agency as Client" : "Client"} ·{" "}
                {client.email || "No email"}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRemoveClient}
          disabled={removing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={18} />
          {removing ? "Removing..." : "Remove Client"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard
          title="Hourly Rate"
          value={`${formatMoney(client.hourly_rate || 0, currency)} / hr`}
          icon={<Wallet size={20} />}
        />

        <InfoCard
          title="Assigned Tasks"
          value={tasks.length}
          icon={<ClipboardList size={20} />}
        />

        <InfoCard
          title="Invoices Sent"
          value={formatMoney(totalInvoices, currency)}
          icon={<ReceiptText size={20} />}
        />
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Tasks Assigned to VA
            </h2>
            <p className="text-sm text-slate-500">
              Tasks connected to this client and assigned to you.
            </p>
          </div>

          {tasks.length === 0 ? (
            <EmptyPanel message="No tasks assigned from this client yet." />
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-100">
              {tasks.map((task) => (
                <div key={task.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {task.title || "Untitled task"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {task.description || "No description"}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {task.status || "todo"}
                    </span>
                  </div>

                  {task.due_date && (
                    <p className="mt-3 text-xs text-slate-400">
                      Due {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Invoices Sent by VA
            </h2>
            <p className="text-sm text-slate-500">
              Invoices you created for this client.
            </p>
          </div>

          {invoices.length === 0 ? (
            <EmptyPanel message="No invoices sent to this client yet." />
          ) : (
            <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {invoice.invoice_number || `Invoice ${invoice.id.slice(0, 8)}`}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Created{" "}
                        {invoice.created_at
                          ? new Date(invoice.created_at).toLocaleDateString()
                          : "recently"}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {invoice.status || "draft"}
                    </span>
                  </div>

                  <p className="mt-4 text-lg font-bold text-slate-900">
                    {formatMoney(
                      invoice.total_amount || 0,
                      normalizeCurrency(invoice.currency || currency)
                    )}
                  </p>

                  {invoice.due_date && (
                    <p className="mt-1 text-xs text-slate-400">
                      Due {new Date(invoice.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function createClientObject({ client, connection, direction }) {
  return {
    route_id: client.id,
    connection_id: connection?.id || null,
    client_id: client.id,
    organization_id: client.organization_id || null,
    kind: "client",
    direction,
    name: client.name || client.email || "Client",
    email: client.email || null,
    status: client.status || "active",
    hourly_rate: Number(client.hourly_rate || 0),
    currency: normalizeCurrency(client.currency),
    created_at: client.created_at,
  };
}

function InfoCard({ title, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className="text-blue-600">{icon}</div>
      </div>

      <h2 className="mt-3 text-xl font-bold text-slate-900">{value}</h2>
    </div>
  );
}

function EmptyPanel({ message }) {
  return (
    <div className="p-8 text-center text-sm text-slate-500">{message}</div>
  );
}

function normalizeCurrency(currency) {
  return currency?.trim()?.toUpperCase() || "USD";
}