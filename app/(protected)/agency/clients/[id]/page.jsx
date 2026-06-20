"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    AlertCircle,
    ClipboardList,
    FileText,
    Mail,
    Plus,
    ReceiptText,
    Trash2,
    UserRound,
    Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useAppContext } from "@/context/AppContext";
import { formatMoney } from "@/lib/currency";
import GenerateInvoiceDialog from "@/components/invoices/GenerateInvoiceDialog";

export default function AgencyClientDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.id;

    const { profile, loading: profileLoading } = useAuthUser();
    const { showToast } = useAppContext();

    const organizationId = profile?.organization_id || null;

    const [client, setClient] = useState(null);
    const [connection, setConnection] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [invoices, setInvoices] = useState([]);

    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

    useEffect(() => {
        if (!clientId) return;

        /*
          Keep loading while auth/profile is still being checked.
          Do not show warning box yet.
        */
        if (profileLoading) {
            setLoading(true);
            return;
        }

        if (organizationId) {
            loadPage();
            return;
        }

        /*
          Only show warning after profile loading is finished
          and organizationId is still missing.
        */
        setLoading(false);
    }, [clientId, organizationId, profileLoading]);

    async function loadPage() {
        setLoading(true);

        const loaded = await loadConnectionAndClient();

        if (!loaded) {
            setLoading(false);
            return;
        }

        await Promise.all([
            loadTasks(loaded.client.client_id),
            loadInvoices(loaded.client.client_id),
        ]);

        setLoading(false);
    }

    async function loadConnectionAndClient() {
        /*
          Source of truth:
          app_connections only.
      
          The URL id can be either:
          - app_connections.id
          - target_client_id
        */
        const { data: connectionData, error: connectionError } = await supabase
            .from("app_connections")
            .select(
                `
      id,
      source_type,
      source_organization_id,
      target_type,
      target_client_id,
      target_email,
      target_user_id,
      status,
      hourly_rate,
      currency,
      created_at
    `
            )
            .eq("source_type", "agency")
            .eq("source_organization_id", organizationId)
            .eq("target_type", "client")
            .in("status", ["active", "pending"])
            .or(`id.eq.${clientId},target_client_id.eq.${clientId}`)
            .maybeSingle();

        if (connectionError) {
            showToast(connectionError.message, "error");
            setConnection(null);
            setClient(null);
            return null;
        }

        if (!connectionData) {
            setConnection(null);
            setClient(null);
            return null;
        }

        let clientRecord = null;

        if (connectionData.target_client_id) {
            const { data: clientData, error: clientError } = await supabase
                .from("clients")
                .select(
                    `
        id,
        name,
        email,
        phone,
        company_name,
        billing_address,
        hourly_rate,
        currency,
        status,
        organization_id,
        user_id,
        created_at
      `
                )
                .eq("id", connectionData.target_client_id)
                .maybeSingle();

            if (clientError) {
                showToast(clientError.message, "error");
                setConnection(null);
                setClient(null);
                return null;
            }

            clientRecord = clientData || null;
        }

        const normalizedClient = {
            id: clientRecord?.id || null,
            client_id: clientRecord?.id || connectionData.target_client_id || null,
            app_connection_id: connectionData.id,

            name:
                clientRecord?.name ||
                connectionData.target_email ||
                "Pending Client",

            email:
                clientRecord?.email ||
                connectionData.target_email ||
                "",

            phone: clientRecord?.phone || null,
            company_name: clientRecord?.company_name || null,
            billing_address: clientRecord?.billing_address || null,

            hourly_rate: Number(
                connectionData.hourly_rate || clientRecord?.hourly_rate || 0
            ),

            currency: normalizeCurrency(
                connectionData.currency || clientRecord?.currency
            ),

            status: connectionData.status || "pending",
            organization_id: organizationId,
            user_id: clientRecord?.user_id || connectionData.target_user_id || null,
            created_at: connectionData.created_at || clientRecord?.created_at || null,
        };

        setConnection(connectionData);
        setClient(normalizedClient);

        return {
            connection: connectionData,
            client: normalizedClient,
        };
    }

    async function loadTasks(targetClientId = clientId) {
        /*
          Tasks assigned by this client to the agency:
          - source_client_id = selected client
          - assigned_to_organization_id or organization_id = agency organization
        */
        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("source_client_id", targetClientId)
            .or(
                `assigned_to_organization_id.eq.${organizationId},organization_id.eq.${organizationId}`
            )
            .order("created_at", { ascending: false });

        if (error) {
            showToast(error.message, "error");
            setTasks([]);
            return;
        }

        setTasks(data || []);
    }

    async function loadInvoices(targetClientId = clientId) {
        /*
          Agency-created invoices to this client.
          Avoid clients embed because invoices has multiple client relationships.
        */
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
        organization_id,
        client_id,
        bill_to_client_id,
        public_token,
        payment_link,
        creator_type,
        creator_id,
        creator_display_name
      `
            )
            .eq("organization_id", organizationId)
            .or(`client_id.eq.${targetClientId},bill_to_client_id.eq.${targetClientId}`)
            .order("created_at", { ascending: false });

        if (error) {
            showToast(error.message, "error");
            setInvoices([]);
            return;
        }

        setInvoices(data || []);
    }

    async function handleDeleteClient() {
        if (!connection?.id) {
            showToast("Client connection was not found.", "error");
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to remove ${client.name || client.email} from your agency?\n\nThis will only remove the agency-client connection. It will NOT delete the client record, tasks, or invoices.`
        );

        if (!confirmed) return;

        setDeleting(true);

        try {
            const { error } = await supabase.rpc(
                "disconnect_agency_client_connection_by_id",
                {
                    p_connection_id: connection.id,
                }
            );

            if (error) throw error;

            showToast("Client connection removed from agency.", "success");
            router.replace("/agency/clients");
        } catch (error) {
            showToast(error.message || "Unable to remove client connection.", "error");
        }

        setDeleting(false);
    }

    function formatDate(date) {
        if (!date) return "—";

        return new Date(date).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    const currency = normalizeCurrency(client?.currency);

    const summary = useMemo(() => {
        const unpaidInvoices = invoices.filter(
            (invoice) => !["paid", "cancelled"].includes(invoice.status)
        );

        const unpaidTotal = unpaidInvoices.reduce((sum, invoice) => {
            return sum + Number(invoice.total_amount || 0);
        }, 0);

        const openTasks = tasks.filter(
            (task) => !["done", "completed", "cancelled"].includes(task.status)
        ).length;

        return {
            totalTasks: tasks.length,
            openTasks,
            invoices: invoices.length,
            unpaidInvoices: unpaidInvoices.length,
            unpaidTotal,
        };
    }, [tasks, invoices]);

    if (loading) {
        return (
            <main className="p-6 text-sm text-slate-500">
                Loading client details...
            </main>
        );
    }

    if (!organizationId) {
        return (
            <main className="space-y-6">
                <WarningBox
                    title="Agency workspace not found"
                    message="Your account does not have an agency organization connected."
                />
            </main>
        );
    }

    if (!client) {
        return (
            <main className="space-y-6">
                <BackLink />

                <WarningBox
                    title="Client not found"
                    message="This client does not exist or does not belong to your agency."
                />
            </main>
        );
    }

    return (
           <main className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-6">
            <GenerateInvoiceDialog
                open={showInvoiceDialog}
                onClose={() => setShowInvoiceDialog(false)}
                mode="agency"
                organizationId={organizationId}
                clients={client?.client_id ? [{ ...client, id: client.client_id }] : []}
                onGenerated={() => {
                    setShowInvoiceDialog(false);
                    loadInvoices(client.client_id);
                }}
            />

            <BackLink />

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold uppercase text-white">
                            {client.name?.charAt(0) || "C"}
                        </div>

                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-bold text-slate-900">
                                    {client.name || "Client"}
                                </h1>

                                <StatusBadge status={client.status || "active"} />
                            </div>

                            <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                <Mail size={15} />
                                {client.email || "No email"}
                            </p>

                            <p className="mt-3 text-sm font-semibold text-slate-700">
                                {formatMoney(client.hourly_rate || 0, currency)} / hr ·{" "}
                                {currency}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                        <button
                            type="button"
                            onClick={() => {
                                if (!client?.client_id) {
                                    showToast("This client is still pending. You can generate an invoice after the client record is available.", "error");
                                    return;
                                }

                                setShowInvoiceDialog(true);
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            <Plus size={18} />
                            Generate Invoice
                        </button>

                        <button
                            type="button"
                            onClick={handleDeleteClient}
                            disabled={deleting}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Trash2 size={18} />
                            {deleting ? "Removing..." : "Remove Client"}
                        </button>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <StatCard
                    title="Tasks"
                    value={summary.totalTasks}
                    icon={<ClipboardList size={20} />}
                />

                <StatCard
                    title="Open Tasks"
                    value={summary.openTasks}
                    icon={<ClipboardList size={20} />}
                />

                <StatCard
                    title="Invoices"
                    value={summary.invoices}
                    icon={<ReceiptText size={20} />}
                />

                <StatCard
                    title="Unpaid"
                    value={formatMoney(summary.unpaidTotal, currency)}
                    icon={<Wallet size={20} />}
                />
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                    title="Tasks Assigned by Client"
                    description="Tasks created by this client and assigned to your agency."
                />

                {tasks.length === 0 ? (
                    <EmptyText text="No tasks assigned by this client yet." />
                ) : (
                    <div className="divide-y divide-slate-100">
                        {tasks.map((task) => (
                            <TaskRow key={task.id} task={task} formatDate={formatDate} />
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                    title="Agency Invoices to Client"
                    description="Invoices created by your agency for this client."
                />

                {invoices.length === 0 ? (
                    <EmptyText text="No invoices created for this client yet." />
                ) : (
                    <div className="divide-y divide-slate-100">
                        {invoices.map((invoice) => (
                            <InvoiceRow
                                key={invoice.id}
                                invoice={invoice}
                                formatDate={formatDate}
                            />
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

function BackLink() {
    return (
        <Link
            href="/agency/clients"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
            <ArrowLeft size={16} />
            Back to Clients
        </Link>
    );
}

function SectionHeader({ title, description }) {
    return (
        <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{description}</p>
        </div>
    );
}

function TaskRow({ task, formatDate }) {
    return (
        <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div>
                <h3 className="font-semibold text-slate-900">{task.title}</h3>

                <p className="mt-1 text-sm text-slate-500">
                    {task.description || "No description"}
                </p>

                {task.due_date && (
                    <p className="mt-1 text-xs text-slate-400">
                        Due: {formatDate(task.due_date)}
                    </p>
                )}
            </div>

            <StatusBadge status={task.status || "todo"} />
        </div>
    );
}

function InvoiceRow({ invoice, formatDate }) {
    const currency = normalizeCurrency(invoice.currency);

    return (
        <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div>
                <h3 className="font-semibold text-slate-900">
                    {invoice.invoice_number || `Invoice ${invoice.id.slice(0, 8)}`}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                    Due: {formatDate(invoice.due_date)}
                </p>

                {invoice.public_token && (
                    <Link
                        href={`/public-invoice/${invoice.public_token}`}
                        target="_blank"
                        className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline"
                    >
                        View public invoice
                    </Link>
                )}
            </div>

            <div className="sm:text-right">
                <p className="font-semibold text-slate-900">
                    {formatMoney(invoice.total_amount || 0, currency)}
                </p>

                <div className="mt-2">
                    <StatusBadge status={invoice.status || "draft"} />
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{title}</p>
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
        todo: "bg-slate-100 text-slate-700",
        doing: "bg-blue-100 text-blue-700",
        in_progress: "bg-blue-100 text-blue-700",
        done: "bg-green-100 text-green-700",
        completed: "bg-green-100 text-green-700",
        sent: "bg-blue-100 text-blue-700",
        paid: "bg-green-100 text-green-700",
        overdue: "bg-red-100 text-red-700",
        draft: "bg-slate-100 text-slate-700",
        cancelled: "bg-slate-200 text-slate-600",
    };

    return (
        <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${styles[status] || styles.pending
                }`}
        >
            {status || "pending"}
        </span>
    );
}

function EmptyText({ text }) {
    return <div className="p-8 text-center text-sm text-slate-500">{text}</div>;
}

function WarningBox({ title, message }) {
    return (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
            <div className="flex items-start gap-3">
                <AlertCircle className="mt-1 text-orange-600" size={22} />

                <div>
                    <h1 className="text-xl font-bold text-orange-900">{title}</h1>
                    <p className="mt-2 text-sm text-orange-700">{message}</p>
                </div>
            </div>
        </div>
    );
}

function normalizeCurrency(currency) {
    return currency?.trim()?.toUpperCase() || "USD";
}