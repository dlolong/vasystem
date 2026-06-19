"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AppDialog from "@/components/ui/AppDialog";

export default function AddVaTaskDialog({
  open,
  onClose,
  sourceType = "agency",
  organizationId = null,
  clientId = null,
  vaConnections = [],
  onAdded,
}) {
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    va_connection_id: "",
    title: "",
    description: "",
    due_date: "",
  });

  function updateField(e) {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const selectedConnection = vaConnections.find(
      (item) => item.id === form.va_connection_id
    );

    if (!selectedConnection?.va_user_id) {
      alert("This VA has not registered yet.");
      return;
    }

    setSaving(true);

    const {
  data: { user },
} = await supabase.auth.getUser();

    const { error } = await supabase.from("tasks").insert({
      title: form.title,
      description: form.description || null,
      due_date: form.due_date || null,
      status: "todo",
      assigned_to: selectedConnection.va_user_id,
      va_connection_id: selectedConnection.id,
      organization_id: sourceType === "agency" ? organizationId : null,
      client_id: sourceType === "client" ? clientId : null,
      source_type: sourceType,
      created_by: user.id,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (onAdded) onAdded();
    onClose();
  }

  return (
    <AppDialog
      open={open}
      title="Assign Task to VA"
      description="Create a task and assign it to a connected VA."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <select
          name="va_connection_id"
          value={form.va_connection_id}
          onChange={updateField}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          required
        >
          <option value="">Select VA</option>
          {vaConnections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.va_email}
            </option>
          ))}
        </select>

        <input
          name="title"
          value={form.title}
          onChange={updateField}
          placeholder="Task title"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          required
        />

        <textarea
          name="description"
          value={form.description}
          onChange={updateField}
          placeholder="Task details"
          rows={4}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
        />

        <input
          name="due_date"
          type="date"
          value={form.due_date}
          onChange={updateField}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
        />

        <button
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Send size={18} />
              Assign Task
            </>
          )}
        </button>
      </form>
    </AppDialog>
  );
}