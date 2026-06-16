"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";

export default function AddTimeDialog({
  open,
  onClose,
  clients = [],
  onTimeAdded,
}) {
  const { showToast } = useAppContext();
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  const [form, setForm] = useState({
    client_id: "",
    work_date: today,
    start_time: "09:00",
    end_time: "10:00",
    description: "",
    billable: true,
  });

  if (!open) return null;

  function updateField(e) {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function resetForm() {
    setForm({
      client_id: "",
      work_date: today,
      start_time: "09:00",
      end_time: "10:00",
      description: "",
      billable: true,
    });
  }

  function closeDialog() {
    resetForm();
    onClose();
  }

  function buildDateTime(date, time) {
    return new Date(`${date}T${time}:00`);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.client_id) {
      showToast("Please select a client.", "error");
      return;
    }

    if (!form.work_date || !form.start_time || !form.end_time) {
      showToast("Date, start time, and end time are required.", "error");
      return;
    }

    const startDate = buildDateTime(form.work_date, form.start_time);
    const endDate = buildDateTime(form.work_date, form.end_time);

    if (endDate <= startDate) {
      showToast("End time must be later than start time.", "error");
      return;
    }

    const duration = Math.floor((endDate - startDate) / 1000);

    const selectedClient = clients.find(
      (client) => client.id === form.client_id
    );

    if (!selectedClient) {
      showToast("Selected client not found.", "error");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showToast("User session not found.", "error");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("time_logs")
      .insert({
        user_id: user.id,
        organization_id: selectedClient.organization_id || null,
        client_id: selectedClient.id,
        project_id: null,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        duration,
        description: form.description || "Manual time entry",
        hourly_rate: Number(selectedClient.hourly_rate || 0),
        billable: form.billable,
        invoiced: false,
      })
      .select()
      .single();

    if (error) {
      showToast(error.message, "error");
      setSaving(false);
      return;
    }

    showToast("Time entry added successfully.", "success");

    if (onTimeAdded) {
      onTimeAdded(data);
    }

    resetForm();
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Add Manual Time Entry
            </h3>
            <p className="text-sm text-slate-500">
              Log work manually for one of your clients.
            </p>
          </div>

          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Client
            </label>

            <select
              name="client_id"
              value={form.client_id}
              onChange={updateField}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Select client</option>

              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Work Date
            </label>

            <input
              type="date"
              name="work_date"
              value={form.work_date}
              onChange={updateField}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Start Time
              </label>

              <input
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={updateField}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                End Time
              </label>

              <input
                type="time"
                name="end_time"
                value={form.end_time}
                onChange={updateField}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Description
            </label>

            <input
              name="description"
              value={form.description}
              onChange={updateField}
              placeholder="Email management, admin task..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="billable"
              checked={form.billable}
              onChange={updateField}
              className="h-4 w-4 rounded border-slate-300"
            />
            Billable time
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Time Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}