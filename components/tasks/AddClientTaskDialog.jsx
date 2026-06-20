"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AppDialog from "@/components/ui/AppDialog";

export default function AddClientTaskDialog({
  open,
  onClose,
  clientRecord,
  connection,
  provider,
  onCreated,
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
  });

  useEffect(() => {
    if (!open) {
      setSaving(false);
      setMessage({ type: "", text: "" });
      setForm({
        title: "",
        description: "",
        due_date: "",
      });
    }
  }, [open]);

  function updateField(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setMessage({ type: "", text: "" });

    if (!clientRecord?.id) {
      setMessage({ type: "error", text: "Client record not found." });
      return;
    }

    if (!connection?.id) {
      setMessage({ type: "error", text: "Connection not found." });
      return;
    }

    if (!form.title.trim()) {
      setMessage({ type: "error", text: "Task title is required." });
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User session not found.");
      }

      const providerUserId = provider?.provider_user_id || null;
      const providerOrganizationId = provider?.provider_organization_id || null;
      const assignedToType = providerOrganizationId ? "agency" : "va";

      const { error } = await supabase.from("tasks").insert({
        title: form.title.trim(),
        description: form.description || null,
        due_date: form.due_date || null,
        status: "todo",

        app_connection_id: connection.id,

        source_type: "client",
        source_user_id: user.id,
        source_client_id: clientRecord.id,

        client_id: clientRecord.id,
        created_by: user.id,

        assigned_to_type: assignedToType,
        assigned_to: assignedToType === "va" ? providerUserId : null,
        assigned_to_organization_id:
          assignedToType === "agency" ? providerOrganizationId : null,
        organization_id: providerOrganizationId || null,
        target_email: provider?.email || connection.target_email || null,
      });

      if (error) throw error;

      if (onCreated) {
        onCreated();
      }

      onClose();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to create task.",
      });
    }

    setSaving(false);
  }

  return (
    <AppDialog
      open={open}
      title="Assign Task"
      description={`Create a task for ${provider?.name || "this provider"}.`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {message.text && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              message.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Task Title
          </label>

          <input
            name="title"
            value={form.title}
            onChange={updateField}
            placeholder="Example: Update landing page copy"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Description
          </label>

          <textarea
            name="description"
            value={form.description}
            onChange={updateField}
            rows={4}
            placeholder="Task details..."
            className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Due Date
          </label>

          <input
            type="date"
            name="due_date"
            value={form.due_date}
            onChange={updateField}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
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
        </div>
      </form>
    </AppDialog>
  );
}