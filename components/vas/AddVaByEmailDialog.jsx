"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import AppDialog from "@/components/ui/AppDialog";
import { CURRENCY_OPTIONS } from "@/lib/currency";

export default function AddVaByEmailDialog({
  open,
  onClose,
  mode = "agency",
  organizationId = null,
  clientId = null,
  onAdded,
}) {
  const { showToast } = useAppContext();

  const isAgency = mode === "agency";
  const isClient = mode === "client";

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    va_email: "",
    hourly_rate: "",
    currency: "USD",
  });

  useEffect(() => {
    if (!open) {
      setSaving(false);
      setForm({
        va_email: "",
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

    const vaEmail = form.va_email.trim().toLowerCase();

    if (!vaEmail) {
      showToast("VA email is required.", "error");
      return;
    }

    if (isAgency && !organizationId) {
      showToast("Agency organization not found.", "error");
      return;
    }

    if (isClient && !clientId) {
      showToast("Client record not found.", "error");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.rpc("add_va_connection", {
      p_va_email: vaEmail,
      p_connection_type: isAgency ? "agency" : "client",
      p_organization_id: isAgency ? organizationId : null,
      p_client_id: isClient ? clientId : null,
      p_hourly_rate: Number(form.hourly_rate || 0),
      p_currency: form.currency || "USD",
    });

    setSaving(false);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast(
      data?.status === "pending"
        ? "VA invited. They will become active after signup."
        : "VA connected successfully.",
      "success"
    );

    setForm({
      va_email: "",
      hourly_rate: "",
      currency: "USD",
    });

    onClose();

    if (onAdded) {
      onAdded(data);
    }
  }

  return (
    <AppDialog
      open={open}
      title="Add VA by Email"
      description={
        isAgency
          ? "Connect a VA to your agency using their email."
          : "Connect a VA to your client account using their email."
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            VA Email
          </label>

          <input
            name="va_email"
            type="email"
            value={form.va_email}
            onChange={updateField}
            placeholder="va@example.com"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            required
          />

          <p className="mt-2 text-xs text-slate-500">
            If the VA is not registered yet, they will appear as pending.
          </p>
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
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Add VA
              </>
            )}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}