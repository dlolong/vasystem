"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  CalendarDays,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import AddTimeDialog from "@/components/va/AddTimeDialog";

const PAGE_SIZE = 10;

export default function VaTimeTrackerPage() {
  const { showToast } = useAppContext();

  const [user, setUser] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);

  const [clients, setClients] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);

  const [loading, setLoading] = useState(true);
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = useMemo(() => {
    return Math.max(Math.ceil(totalLogs / PAGE_SIZE), 1);
  }, [totalLogs]);

  useEffect(() => {
    loadUserAndClients();
  }, []);

  useEffect(() => {
    if (user) {
      loadTimeLogs();
    }
  }, [user, page]);

  async function loadUserAndClients() {
    setLoading(true);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setLoading(false);
      return;
    }

    setUser(authUser);

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", authUser.id)
      .eq("status", "active")
      .maybeSingle();

    const { data: userRow } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", authUser.id)
      .maybeSingle();

    const orgId =
      membership?.organization_id || userRow?.organization_id || null;

    setOrganizationId(orgId);

    await loadClients(authUser.id, orgId);

    setLoading(false);
  }

  async function loadClients(userId, orgId = null) {
    let query = supabase
      .from("clients")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (orgId) {
      query = query.or(`user_id.eq.${userId},organization_id.eq.${orgId}`);
    } else {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      showToast(error.message, "error");
      setClients([]);
      return;
    }

    setClients(data || []);
  }

  async function loadTimeLogs() {
    if (!user) return;

    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from("time_logs")
      .select(
        `
        *,
        clients (
          id,
          name,
          email,
          hourly_rate
        )
      `,
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .order("start_time", { ascending: false })
      .range(from, to);

    if (error) {
      showToast(error.message, "error");
      setTimeLogs([]);
      setTotalLogs(0);
      setLoading(false);
      return;
    }

    setTimeLogs(data || []);
    setTotalLogs(count || 0);
    setLoading(false);
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  }

  function formatDate(date) {
    if (!date) return "No date";

    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(date) {
    if (!date) return "--";

    return new Date(date).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatMonth(date) {
    if (!date) return "No Month";

    return new Date(date).toLocaleDateString("en-PH", {
      month: "long",
      year: "numeric",
    });
  }

  function getHours(duration) {
    return Number(duration || 0) / 3600;
  }

  function getAmount(log) {
    const hours = getHours(log.duration);
    const rate = Number(log.hourly_rate || log.clients?.hourly_rate || 0);

    return hours * rate;
  }

  const groupedLogs = useMemo(() => {
    return timeLogs.reduce((groups, log) => {
      const month = formatMonth(log.start_time);

      if (!groups[month]) {
        groups[month] = [];
      }

      groups[month].push(log);

      return groups;
    }, {});
  }, [timeLogs]);

  const summary = useMemo(() => {
    const totalHours = timeLogs.reduce((sum, log) => {
      return sum + getHours(log.duration);
    }, 0);

    const totalAmount = timeLogs.reduce((sum, log) => {
      if (log.billable === false) return sum;
      return sum + getAmount(log);
    }, 0);

    return {
      totalHours,
      totalAmount,
      totalEntries: totalLogs,
    };
  }, [timeLogs, totalLogs]);

  return (
    <main className="space-y-6">
      <AddTimeDialog
        open={showTimeDialog}
        onClose={() => setShowTimeDialog(false)}
        clients={clients}
        onTimeAdded={() => {
          setPage(1);
          loadTimeLogs();
        }}
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Time Tracker</h1>
          <p className="text-sm text-slate-500">
            View your time logs, manual entries, and billable work.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowTimeDialog(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Time
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Visible Hours"
          value={summary.totalHours.toFixed(2)}
          description="Hours on this page"
          icon={<Clock size={20} />}
        />

        <StatCard
          title="Billable Amount"
          value={formatCurrency(summary.totalAmount)}
          description="Amount on this page"
          icon={<Wallet size={20} />}
        />

        <StatCard
          title="Total Entries"
          value={summary.totalEntries}
          description="All saved time logs"
          icon={<CalendarDays size={20} />}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Time Logs</h2>
          <p className="text-sm text-slate-500">
            Entries are grouped by month.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading time logs...
          </div>
        ) : timeLogs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">No time logs yet.</p>

            <button
              type="button"
              onClick={() => setShowTimeDialog(true)}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Add your first time entry
            </button>
          </div>
        ) : (
          <div>
            {Object.entries(groupedLogs).map(([month, logs]) => (
              <div key={month}>
                <div className="bg-slate-50 px-5 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {month}
                  </h3>
                </div>

                <div className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[1.2fr_1fr_120px_140px]"
                    >
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {log.clients?.name || "No client"}
                        </h4>

                        <p className="mt-1 text-sm text-slate-500">
                          {log.description || "No description"}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                          {formatDate(log.start_time)}
                        </p>
                      </div>

                      <div className="text-sm text-slate-600">
                        <p>
                          {formatTime(log.start_time)} -{" "}
                          {formatTime(log.end_time)}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {log.billable === false
                            ? "Non-billable"
                            : "Billable"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-slate-500">Hours</p>
                        <p className="font-semibold text-slate-900">
                          {getHours(log.duration).toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-slate-500">Amount</p>
                        <p className="font-semibold text-slate-900">
                          {formatCurrency(getAmount(log))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} · {totalLogs} time log
            {totalLogs === 1 ? "" : "s"}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Prev
            </button>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({ title, value, description, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className="text-blue-600">{icon}</div>
      </div>

      <h3 className="mt-3 text-2xl font-bold text-slate-900">{value}</h3>

      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}