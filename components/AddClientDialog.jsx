"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";
import { CURRENCY_OPTIONS, formatMoney } from "@/lib/currency";

export default function AddClientDialog({
  open,
  onClose,
  onClientAdded,
  mode = "va",
  organizationId = null,
}) {
  const { showToast } = useAppContext();

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    hourly_rate: "",
    currency: "USD",
  });

  if (!open) return null;

  function updateField(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function resetForm() {
    setForm({
      name: "",
      email: "",
      hourly_rate: "",
    });
  }

  function closeDialog() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      showToast("Client name is required.", "error");
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

    const isAgency = mode === "agency";

    const { data, error } = await supabase
      .from("clients")
      .insert({
        user_id: user.id,
        organization_id: isAgency ? organizationId : null,
        name: form.name.trim(),
        email: form.email || null,
        hourly_rate: Number(form.hourly_rate || 0),
        currency: form.currency || "USD",
        status: "active",
      })
      .select()
      .single();

    if (error) {
      showToast(error.message, "error");
      setSaving(false);
      return;
    }

    showToast("Client added successfully.", "success");

    if (onClientAdded) {
      onClientAdded(data);
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
              Add Personal Client
            </h3>

            <p className="text-sm text-slate-500">
              This client will belong to your independent VA workspace.
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
              Client Name
            </label>

            <input
              name="name"
              value={form.name}
              onChange={updateField}
              placeholder="Client name"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Client Email
            </label>

            <input
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
              placeholder="client@email.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Hourly Rate
            </label>

            <input
              name="hourly_rate"
              type="number"
              value={form.hourly_rate}
              onChange={updateField}
              placeholder="0"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Preferred Currency
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
              {saving ? "Saving..." : "Save Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}