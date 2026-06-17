"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import AppProvider from "@/components/providers/AppProvider";
import { Menu, X } from "lucide-react";

export default function ProtectedLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AppProvider>
      <div className="min-h-screen bg-slate-50">
        {/* MOBILE OVERLAY */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
        )}

        {/* DESKTOP SIDEBAR */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64">
          <Sidebar />
        </div>

        {/* MOBILE SIDEBAR */}
        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white transition-transform duration-300 lg:hidden ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="absolute right-3 top-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          <Sidebar setSidebarOpen={setSidebarOpen} />
        </div>

        {/* MAIN CONTENT */}
        <div className="lg:pl-64">
          {/* MOBILE TOPBAR WITH MENU + SEARCH + ACTION ICONS */}
          <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            <div className="min-w-0 flex-1">
              <Topbar />
            </div>
          </div>

          {/* DESKTOP TOPBAR */}
          <div className="hidden lg:block">
            <Topbar />
          </div>

          {/* PAGE */}
          <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </AppProvider>
  );
}