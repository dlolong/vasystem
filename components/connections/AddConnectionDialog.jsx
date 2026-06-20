"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import AppDialog from "@/components/ui/AppDialog";
import { supabase } from "@/lib/supabaseClient";
import { CURRENCY_OPTIONS } from "@/lib/currency";

export default function AddConnectionDialog({
  open,
  onClose,
  sourceType,
  targetType,
  sourceClientId = null,
  sourceOrganizationId = null,
  title = "Add Connection",
  description = "Add a connection by email.",
  submitLabel = "Add",
  onAdded,
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [form, setForm] = useState({
    email: "",
    hourly_rate: "",
    currency: "USD",
  });

  useEffect(() => {
    if (!open) {
      setSaving(false);
      setMessage({ type: "", text: "" });
      setForm({
        email: "",
        hourly_rate: "",
        currency: "USD",
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

    const targetEmail = form.email.trim().toLowerCase();

    if (!targetEmail) {
      setMessage({ type: "error", text: "Email is required." });
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("User session not found.");
      }

      const response = await fetch("/api/connections/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          source_type: sourceType,
          target_type: targetType,
          target_email: targetEmail,
          source_client_id: sourceClientId,
          source_organization_id: sourceOrganizationId,
          hourly_rate: Number(form.hourly_rate || 0),
          currency: form.currency || "USD",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to add connection.");
      }

      setMessage({
        type: "success",
        text:
          result.connection?.status === "pending"
            ? "Invitation sent. This connection is pending until signup."
            : "Connection added successfully.",
      });

      if (onAdded) {
        onAdded(result.connection);
      }

      onClose();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to add connection.",
      });
    }

    setSaving(false);
  }

  return (
    <AppDialog
      open={open}
      title={title}
      description={description}
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
            Email
          </label>

          <input
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            placeholder="person@company.com"
            required
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Hourly Rate
          </label>

          <input
            name="hourly_rate"
            type="number"
            min="0"
            step="0.01"
            value={form.hourly_rate}
            onChange={updateField}
            placeholder="0.00"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Currency
          </label>

          <select
            name="currency"
            value={form.currency}
            onChange={updateField}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {CURRENCY_OPTIONS.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.label}
              </option>
            ))}
          </select>
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
                Adding...
              </>
            ) : (
              <>
                <Plus size={18} />
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}