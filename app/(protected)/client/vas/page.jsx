"use client";

import { useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
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
import AddVaByEmailDialog from "@/components/vas/AddVaByEmailDialog";

export default function ClientVasPage() {
    const { showToast } = useAppContext();

    const [authUser, setAuthUser] = useState(null);
    const [clientRecord, setClientRecord] = useState(null);

    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadClientAndVas();
    }, []);

    async function loadClientAndVas() {
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

        const { data: clientByUser, error: userClientError } = await supabase
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
            .eq("user_id", user.id)
            .limit(1);

        if (userClientError) {
            showToast(userClientError.message, "error");
        }

        if (clientByUser?.length > 0) {
            foundClient = clientByUser[0];
        }

        if (!foundClient && user.email) {
            let emailQuery = supabase
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
                .eq("email", user.email)
                .limit(1);

            if (orgId) {
                emailQuery = emailQuery.eq("organization_id", orgId);
            }

            const { data: clientByEmail, error: emailClientError } =
                await emailQuery;

            if (emailClientError) {
                showToast(emailClientError.message, "error");
            }

            if (clientByEmail?.length > 0) {
                foundClient = clientByEmail[0];
            }
        }

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

        await loadVas(normalizedClient.id);

        setLoading(false);
    }

    async function loadVas(clientId = clientRecord?.id) {
        if (!clientId) return;

        const { data, error } = await supabase
            .from("va_connections")
            .select(
                `
        id,
        connection_type,
        client_id,
        organization_id,
        va_user_id,
        va_email,
        status,
        hourly_rate,
        currency,
        created_at
      `
            )
            .eq("connection_type", "client")
            .eq("client_id", clientId)
            .order("created_at", { ascending: false });

        if (error) {
            showToast(error.message, "error");
            setConnections([]);
            return;
        }

        const rows = data || [];

        const vaUserIds = rows
            .map((item) => item.va_user_id)
            .filter(Boolean);

        let vaUsersById = {};

        if (vaUserIds.length > 0) {
            const { data: vaUsers, error: vaUsersError } = await supabase
                .from("users")
                .select("id, full_name, email")
                .in("id", vaUserIds);

            if (vaUsersError) {
                showToast(vaUsersError.message, "error");
            }

            vaUsersById = (vaUsers || []).reduce((map, va) => {
                map[va.id] = va;
                return map;
            }, {});
        }

        setConnections(
            rows.map((connection) => ({
                ...connection,
                currency: normalizeCurrency(
                    connection.currency || clientRecord?.currency
                ),
                va: connection.va_user_id
                    ? vaUsersById[connection.va_user_id] || null
                    : null,
            }))
        );
    }

    const filteredConnections = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) return connections;

        return connections.filter((connection) => {
            const name = connection.va?.full_name || "";
            const email = connection.va?.email || connection.va_email || "";

            return (
                name.toLowerCase().includes(keyword) ||
                email.toLowerCase().includes(keyword)
            );
        });
    }, [connections, search]);

    const stats = useMemo(() => {
        const active = connections.filter(
            (connection) => connection.status === "active"
        ).length;

        const pending = connections.filter(
            (connection) => connection.status === "pending"
        ).length;

        return {
            total: connections.length,
            active,
            pending,
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

                            <p className="mt-2 text-sm text-orange-700">
                                Ask the agency to add your email as a client, or create your own
                                client profile during signup.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="space-y-6">
            <AddVaByEmailDialog
                open={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                mode="client"
                clientId={clientRecord?.id}
                onAdded={() => {
                    setShowAddDialog(false);
                    loadClientAndVas();
                }}
            />

            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">My VAs</h1>

                    <p className="text-sm text-slate-500">
                        Add and manage Virtual Assistants connected to{" "}
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
                    title="Total VAs"
                    value={stats.total}
                    description="All connected VAs"
                    icon={<Users size={20} />}
                    color="blue"
                />

                <StatCard
                    title="Active VAs"
                    value={stats.active}
                    description="Registered and active"
                    icon={<UserCheck size={20} />}
                    color="emerald"
                />

                <StatCard
                    title="Pending"
                    value={stats.pending}
                    description="Waiting for VA signup"
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
                                placeholder="Search VA name or email..."
                                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => loadVas(clientRecord?.id)}
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
                            <VaConnectionRow
                                key={connection.id}
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

function VaConnectionRow({ connection, clientCurrency }) {
    const name =
        connection.va?.full_name ||
        connection.va?.email ||
        connection.va_email ||
        "Virtual Assistant";

    const email = connection.va?.email || connection.va_email;
    const currency = normalizeCurrency(connection.currency || clientCurrency);

    return (
        <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[1.5fr_1fr_150px_180px]">
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <UserRound size={20} />
                </div>

                <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{name}</h3>

                    {email && (
                        <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500">
                            <Mail size={14} />
                            {email}
                        </p>
                    )}

                    {connection.status === "pending" && (
                        <p className="mt-2 text-xs text-orange-600">
                            This VA has not registered yet. They will become active after
                            signup using this email.
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

            <div>
                <p className="mb-2 text-sm text-slate-500">Status</p>
                <StatusBadge status={connection.status} />
            </div>

            <div className="flex flex-col gap-2 lg:items-end">
                <a
                    href={`/client/tasks?va_connection_id=${connection.id}`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    View Tasks
                </a>

                {connection.status === "active" ? (
                    <a
                        href={`/client/tasks/new?va_connection_id=${connection.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Assign Task
                    </a>
                ) : (
                    <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
                    >
                        Assign Task
                    </button>
                )}
            </div>
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
            className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status] || styles.pending
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
                Add a VA by email so you can assign tasks and receive VA invoices.
            </p>
        </div>
    );
}

function normalizeCurrency(currency) {
    return currency?.trim()?.toUpperCase() || "USD";
}