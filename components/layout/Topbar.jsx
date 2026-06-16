"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    Search,
    Bell,
    ChevronDown,
    LogOut,
    RefreshCw,
    UserRound,
    Building2,
    Loader2,
    ExternalLink,
    X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";

const agencyRoles = ["owner", "agency_admin", "agency"];

export default function Topbar() {
    const router = useRouter();
    const pathname = usePathname();

    const {
        user,
        profile,
        role,
        organization,
        membership,
        signOutUser,
        refreshWorkspace,
        showToast,
    } = useAppContext();

    const wrapperRef = useRef(null);

    const [search, setSearch] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);

    const [refreshing, setRefreshing] = useState(false);

    const orgId =
        membership?.organization_id ||
        organization?.id ||
        profile?.organization_id ||
        null;

    const currentRole = role || profile?.role || "user";
    const isAgency = agencyRoles.includes(currentRole);

    useEffect(() => {
        loadNotifications();
    }, [user?.id, orgId, currentRole]);

    useEffect(() => {
        if (!search.trim()) {
            setSearchResults([]);
            setSearchOpen(false);
            return;
        }

        const timer = setTimeout(() => {
            runSearch(search);
        }, 350);

        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (!wrapperRef.current) return;

            if (!wrapperRef.current.contains(event.target)) {
                setSearchOpen(false);
                setNotificationsOpen(false);
                setUserMenuOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    async function loadNotifications() {
        if (!user?.id) return;

        const nextNotifications = [];

        if (isAgency && orgId) {
            const { data: unpaidInvoices } = await supabase
                .from("invoices")
                .select("id, invoice_number, total_amount, status, due_date")
                .eq("organization_id", orgId)
                .neq("status", "paid")
                .order("created_at", { ascending: false })
                .limit(5);

            unpaidInvoices?.forEach((invoice) => {
                nextNotifications.push({
                    id: `invoice-${invoice.id}`,
                    title: invoice.invoice_number || "Unpaid invoice",
                    description: `Status: ${invoice.status || "draft"}`,
                    href: "/agency/invoices",
                });
            });
        }

        if (currentRole === "va") {
            const { data: tasks } = await supabase
                .from("tasks")
                .select("id, title, status, due_date")
                .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
                .neq("status", "done")
                .order("created_at", { ascending: false })
                .limit(5);

            tasks?.forEach((task) => {
                nextNotifications.push({
                    id: `task-${task.id}`,
                    title: task.title,
                    description: `Task status: ${task.status || "todo"}`,
                    href: "/va/tasks",
                });
            });
        }

        if (currentRole === "client" && orgId) {
            const { data: invoices } = await supabase
                .from("invoices")
                .select("id, invoice_number, total_amount, status")
                .eq("organization_id", orgId)
                .neq("status", "paid")
                .order("created_at", { ascending: false })
                .limit(5);

            invoices?.forEach((invoice) => {
                nextNotifications.push({
                    id: `client-invoice-${invoice.id}`,
                    title: invoice.invoice_number || "Invoice update",
                    description: `Status: ${invoice.status || "draft"}`,
                    href: "/client/invoices",
                });
            });
        }

        setNotifications(nextNotifications);
    }

    async function runSearch(value) {
        const q = value.trim();

        if (q.length < 2) {
            setSearchResults([]);
            setSearchOpen(false);
            return;
        }

        setSearching(true);
        setSearchOpen(true);

        const safeQuery = q.replaceAll(",", " ");

        try {
            let results = [];

            if (isAgency && orgId) {
                const [vasRes, clientsRes, projectsRes, invoicesRes] =
                    await Promise.all([
                        supabase
                            .from("users")
                            .select("id, email, full_name")
                            .eq("organization_id", orgId)
                            .eq("role", "va")
                            .ilike("email", `%${safeQuery}%`)
                            .limit(5),

                        supabase
                            .from("clients")
                            .select("id, name, email, company_name")
                            .eq("organization_id", orgId)
                            .or(
                                `name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,company_name.ilike.%${safeQuery}%`
                            )
                            .limit(5),

                        supabase
                            .from("projects")
                            .select("id, name, description")
                            .eq("organization_id", orgId)
                            .or(
                                `name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`
                            )
                            .limit(5),

                        supabase
                            .from("invoices")
                            .select("id, invoice_number, status")
                            .eq("organization_id", orgId)
                            .ilike("invoice_number", `%${safeQuery}%`)
                            .limit(5),
                    ]);

                results = [
                    ...(vasRes.data || []).map((item) => ({
                        id: `va-${item.id}`,
                        title: item.full_name || item.email,
                        subtitle: "Virtual Assistant",
                        href: `/agency/vas/${item.id}`,
                    })),
                    ...(clientsRes.data || []).map((item) => ({
                        id: `client-${item.id}`,
                        title: item.name,
                        subtitle: item.email || item.company_name || "Agency client",
                        href: "/agency/clients",
                    })),
                    ...(projectsRes.data || []).map((item) => ({
                        id: `project-${item.id}`,
                        title: item.name,
                        subtitle: "Project",
                        href: "/agency/projects",
                    })),
                    ...(invoicesRes.data || []).map((item) => ({
                        id: `invoice-${item.id}`,
                        title: item.invoice_number || "Invoice",
                        subtitle: `Status: ${item.status || "draft"}`,
                        href: "/agency/invoices",
                    })),
                ];
            }

            if (currentRole === "va" && user?.id) {
                const [clientsRes, tasksRes, invoicesRes, timeLogsRes] =
                    await Promise.all([
                        supabase
                            .from("clients")
                            .select("id, name, email")
                            .eq("user_id", user.id)
                            .or(`name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
                            .limit(5),

                        supabase
                            .from("tasks")
                            .select("id, title, description, status")
                            .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
                            .or(
                                `title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`
                            )
                            .limit(5),

                        supabase
                            .from("invoices")
                            .select("id, invoice_number, status")
                            .eq("user_id", user.id)
                            .ilike("invoice_number", `%${safeQuery}%`)
                            .limit(5),

                        supabase
                            .from("time_logs")
                            .select("id, description, start_time")
                            .eq("user_id", user.id)
                            .ilike("description", `%${safeQuery}%`)
                            .limit(5),
                    ]);

                results = [
                    ...(clientsRes.data || []).map((item) => ({
                        id: `va-client-${item.id}`,
                        title: item.name,
                        subtitle: item.email || "Client",
                        href: "/va/clients",
                    })),
                    ...(tasksRes.data || []).map((item) => ({
                        id: `va-task-${item.id}`,
                        title: item.title,
                        subtitle: `Task status: ${item.status || "todo"}`,
                        href: "/va/tasks",
                    })),
                    ...(invoicesRes.data || []).map((item) => ({
                        id: `va-invoice-${item.id}`,
                        title: item.invoice_number || "Invoice",
                        subtitle: `Status: ${item.status || "draft"}`,
                        href: "/va/invoices",
                    })),
                    ...(timeLogsRes.data || []).map((item) => ({
                        id: `va-time-${item.id}`,
                        title: item.description || "Time log",
                        subtitle: item.start_time
                            ? new Date(item.start_time).toLocaleDateString()
                            : "Time tracker",
                        href: "/va/time-tracker",
                    })),
                ];
            }

            if (currentRole === "client" && orgId) {
                const [projectsRes, invoicesRes] = await Promise.all([
                    supabase
                        .from("projects")
                        .select("id, name, description")
                        .eq("organization_id", orgId)
                        .or(`name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
                        .limit(5),

                    supabase
                        .from("invoices")
                        .select("id, invoice_number, status")
                        .eq("organization_id", orgId)
                        .ilike("invoice_number", `%${safeQuery}%`)
                        .limit(5),
                ]);

                results = [
                    ...(projectsRes.data || []).map((item) => ({
                        id: `client-project-${item.id}`,
                        title: item.name,
                        subtitle: "Project",
                        href: "/client/projects",
                    })),
                    ...(invoicesRes.data || []).map((item) => ({
                        id: `client-invoice-${item.id}`,
                        title: item.invoice_number || "Invoice",
                        subtitle: `Status: ${item.status || "draft"}`,
                        href: "/client/invoices",
                    })),
                ];
            }

            setSearchResults(results);
        } catch (error) {
            showToast(error.message || "Search failed.", "error");
            setSearchResults([]);
        }

        setSearching(false);
    }

    async function handleRefresh() {
        setRefreshing(true);

        if (refreshWorkspace) {
            await refreshWorkspace();
        }

        await loadNotifications();

        router.refresh();

        showToast("Workspace refreshed.", "success");
        setRefreshing(false);
    }

    async function handleLogout() {
        if (signOutUser) {
            await signOutUser("Logged out successfully.");
            return;
        }

        await supabase.auth.signOut();
        router.push("/login");
    }

    function goToResult(href) {
        router.push(href);
        setSearch("");
        setSearchResults([]);
        setSearchOpen(false);
    }

   return (
  <div
    ref={wrapperRef}
    className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 lg:flex"
  >
    <div className="relative w-full max-w-2xl">
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                    <Search size={16} className="text-slate-500" />

                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onFocus={() => {
                            if (search.trim()) setSearchOpen(true);
                        }}
                        className="w-full bg-transparent text-sm outline-none"
                        placeholder="Search workspace: VAs, clients, projects, tasks, invoices..."
                    />

                    {search && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch("");
                                setSearchResults([]);
                                setSearchOpen(false);
                            }}
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {searchOpen && (
                    <div className="absolute left-0 right-0 top-12 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                        <div className="border-b border-slate-100 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Search Results
                            </p>
                        </div>

                        {searching ? (
                            <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-500">
                                <Loader2 size={16} className="animate-spin" />
                                Searching...
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="px-4 py-5 text-sm text-slate-500">
                                No results found.
                            </div>
                        ) : (
                            <div className="max-h-80 overflow-y-auto">
                                {searchResults.map((result) => (
                                    <button
                                        key={result.id}
                                        type="button"
                                        onClick={() => goToResult(result.href)}
                                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900">
                                                {result.title}
                                            </p>
                                            <p className="truncate text-xs text-slate-500">
                                                {result.subtitle}
                                            </p>
                                        </div>

                                        <ExternalLink size={14} className="shrink-0 text-slate-400" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleRefresh}
                    className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                    title="Refresh workspace"
                >
                    <RefreshCw
                        size={18}
                        className={refreshing ? "animate-spin" : ""}
                    />
                </button>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            setNotificationsOpen((prev) => !prev);
                            setUserMenuOpen(false);
                        }}
                        className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                    >
                        <Bell size={18} />

                        {notifications.length > 0 && (
                            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {notifications.length}
                            </span>
                        )}
                    </button>

                    {notificationsOpen && (
                        <div className="absolute right-0 top-12 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                            <div className="border-b border-slate-100 px-4 py-3">
                                <p className="font-semibold text-slate-900">Notifications</p>
                                <p className="text-xs text-slate-500">
                                    Recent items needing attention.
                                </p>
                            </div>

                            {notifications.length === 0 ? (
                                <div className="px-4 py-6 text-sm text-slate-500">
                                    No notifications.
                                </div>
                            ) : (
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                router.push(item.href);
                                                setNotificationsOpen(false);
                                            }}
                                            className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                                        >
                                            <p className="text-sm font-semibold text-slate-900">
                                                {item.title}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {item.description}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            setUserMenuOpen((prev) => !prev);
                            setNotificationsOpen(false);
                        }}
                        className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 transition hover:bg-slate-200"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold uppercase text-white">
                            {user?.email?.charAt(0) || "U"}
                        </div>

                        <div className="hidden text-left xl:block">
                            <div className="max-w-40 truncate text-xs font-medium text-slate-800">
                                {user?.email || "User"}
                            </div>
                            <div className="text-[10px] capitalize text-slate-500">
                                {currentRole.replace("_", " ")}
                            </div>
                        </div>

                        <ChevronDown size={14} className="text-slate-500" />
                    </button>

                    {userMenuOpen && (
                        <div className="absolute right-0 top-12 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                            <div className="border-b border-slate-100 px-4 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-bold uppercase text-white">
                                        {user?.email?.charAt(0) || "U"}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900">
                                            {user?.email || "User"}
                                        </p>
                                        <p className="text-xs capitalize text-slate-500">
                                            {currentRole.replace("_", " ")}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1 p-2">
                                <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600">
                                    <Building2 size={16} />
                                    <span className="truncate">
                                        {organization?.name || "Personal Workspace"}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600">
                                    <UserRound size={16} />
                                    <span>Active Account</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                    <RefreshCw size={16} />
                                    Refresh workspace
                                </button>

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                                >
                                    <LogOut size={16} />
                                    Logout
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}