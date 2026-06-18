"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    FolderKanban,
    FileText,
    UserRound,
    CheckSquare,
    Clock,
    Settings,
    LogOut,
} from "lucide-react";
import { useAppContext } from "@/context/AppContext";

const ROOT_ROUTES = ["/agency", "/va", "/client"];

function isMenuActive(pathname, href) {
    if (ROOT_ROUTES.includes(href)) {
        return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
}


const menus = {
    owner: [
        { label: "Dashboard", href: "/agency", icon: LayoutDashboard },
        { label: "VAs", href: "/agency/vas", icon: Users },
        { label: "Clients", href: "/agency/clients", icon: UserRound },
        { label: "Projects", href: "/agency/projects", icon: FolderKanban },
        { label: "Invoices", href: "/agency/invoices", icon: FileText },
        // { label: "Settings", href: "/agency/settings", icon: Settings },
    ],
    agency_admin: [
        { label: "Dashboard", href: "/agency", icon: LayoutDashboard },
        { label: "VAs", href: "/agency/vas", icon: Users },
        { label: "Clients", href: "/agency/clients", icon: UserRound },
        { label: "Projects", href: "/agency/projects", icon: FolderKanban },
        { label: "Invoices", href: "/agency/invoices", icon: FileText },
        // { label: "Settings", href: "/agency/settings", icon: Settings },
    ],
    agency: [
        { label: "Dashboard", href: "/agency", icon: LayoutDashboard },
        { label: "VAs", href: "/agency/vas", icon: Users },
        { label: "Clients", href: "/agency/clients", icon: UserRound },
        { label: "Projects", href: "/agency/projects", icon: FolderKanban },
        { label: "Invoices", href: "/agency/invoices", icon: FileText },
    ],
    va: [
        { label: "Dashboard", href: "/va", icon: LayoutDashboard },
        { label: "Clients", href: "/va/clients", icon: UserRound },
        { label: "Tasks", href: "/va/tasks", icon: CheckSquare },
        { label: "Time Tracker", href: "/va/time-tracker", icon: Clock },
        { label: "Invoices", href: "/va/invoices", icon: FileText },
        //   { label: "Settings", href: "/va/settings", icon: Settings },
    ],
    client: [
        { label: "Dashboard", href: "/client", icon: LayoutDashboard },
        { label: "Invoices", href: "/client/invoices", icon: FileText },
    ],
};


export default function Sidebar({ setSidebarOpen }) {
    const pathname = usePathname();
    const { role, user, organization, signOutUser, loading } = useAppContext();

    const menu = menus[role] || [];

    return (
        <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
                <div className="text-xl font-bold text-indigo-600">VA System</div>
                <p className="mt-1 truncate text-xs text-slate-500">
                    {loading ? "Loading..." : organization?.name || "Workspace"}
                </p>
            </div>

            <nav className="flex-1 space-y-1 p-4">
                {menu.map((item) => {
                    const Icon = item.icon;
                    const active = isMenuActive(pathname, item.href);

                    return (
                        <Link
                            onClick={setSidebarOpen ? () => setSidebarOpen(false) : null}
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${active
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                }`}
                        >
                            <Icon size={18} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-slate-200 p-4">
                <div className="mb-3 truncate text-xs text-slate-500">
                    {user?.email}
                </div>

                <button
                    onClick={() => signOutUser("Logged out successfully.")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600"
                >
                    <LogOut size={18} />
                    Logout
                </button>
            </div>
        </aside>
    );
}