"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Clock, CheckCircle, ClipboardList, Mail } from "lucide-react";

function StatCard({ title, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <div className="text-indigo-600">{icon}</div>
      </div>
      <h2 className="mt-3 text-2xl font-bold text-slate-900">{value}</h2>
    </div>
  );
}

export default function VaProfilePage() {
  const params = useParams();
  const vaId = params.id;

  const [va, setVa] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (vaId) loadVA();
  }, [vaId]);

  async function loadVA() {
    setLoading(true);

    const { data: vaData, error: vaError } = await supabase
      .from("users")
      .select("*")
      .eq("id", vaId)
      .single();

    if (vaError) {
      console.error(vaError);
      setLoading(false);
      return;
    }

    const { data: taskData } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", vaId)
      .order("created_at", { ascending: false });

    const { data: logsData } = await supabase
      .from("time_logs")
      .select("*")
      .eq("user_id", vaId)
      .order("created_at", { ascending: false });

    setVa(vaData);
    setTasks(taskData || []);
    setTimeLogs(logsData || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading VA profile...</div>;
  }

  if (!va) {
    return <div className="p-6 text-sm text-red-500">VA not found.</div>;
  }

  const completedTasks = tasks.filter((task) => task.status === "done").length;

  const totalHours =
    timeLogs.reduce((sum, log) => sum + Number(log.duration_seconds || log.duration || 0), 0) /
    3600;

  const activeTasks = tasks.filter((task) => task.status !== "done").length;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
                {va.email?.charAt(0)?.toUpperCase()}
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {va.full_name || va.email}
                </h1>
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Mail size={14} />
                  {va.email}
                </p>
              </div>
            </div>
          </div>

          <span className="w-fit rounded-full bg-indigo-100 px-4 py-2 text-xs font-semibold uppercase text-indigo-700">
            {va.role || "VA"}
          </span>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="Total Tasks"
          value={tasks.length}
          icon={<ClipboardList size={20} />}
        />
        <StatCard
          title="Active Tasks"
          value={activeTasks}
          icon={<ClipboardList size={20} />}
        />
        <StatCard
          title="Completed Tasks"
          value={completedTasks}
          icon={<CheckCircle size={20} />}
        />
        <StatCard
          title="Total Hours"
          value={`${totalHours.toFixed(1)}h`}
          icon={<Clock size={20} />}
        />
      </div>

      {/* TASKS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Assigned Tasks</h2>

        <div className="mt-4 space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks assigned yet.</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <h3 className="font-medium text-slate-900">{task.title}</h3>
                  <p className="text-xs text-slate-500">
                    {task.description || "No description"}
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {task.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* TIME LOGS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Recent Time Logs</h2>

        <div className="mt-4 space-y-3">
          {timeLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No time logs yet.</p>
          ) : (
            timeLogs.slice(0, 10).map((log) => {
              const seconds = Number(log.duration_seconds || log.duration || 0);

              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {new Date(log.start_time).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {log.end_time
                        ? `Ended ${new Date(log.end_time).toLocaleString()}`
                        : "Running / not ended"}
                    </p>
                  </div>

                  <span className="font-semibold text-slate-900">
                    {(seconds / 3600).toFixed(2)}h
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}