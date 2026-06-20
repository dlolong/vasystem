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
      currency: "USD",
    });
  }

  function closeDialog() {
    resetForm();
    onClose();
  }

async function checkClientEmailExists(email) {
  const cleanEmail = email?.trim()?.toLowerCase();

  if (!cleanEmail) {
    return {
      exists: false,
      message: "",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("User session not found.");
  }

  /*
    IMPORTANT:
    Do NOT check the clients table here.

    For VA mode, only check whether this VA already has
    an active/pending connection to this client email.
  */
  let connectionQuery = supabase
    .from("app_connections")
    .select("id, target_email, status, source_type, source_user_id, target_type")
    .eq("target_type", "client")
    .ilike("target_email", cleanEmail)
    .in("status", ["active", "pending"])
    .limit(1);

  if (mode === "va") {
    connectionQuery = connectionQuery
      .eq("source_type", "va")
      .eq("source_user_id", user.id);
  }

  if (mode === "agency" && organizationId) {
    connectionQuery = connectionQuery
      .eq("source_type", "agency")
      .eq("source_organization_id", organizationId);
  }

  const { data: existingConnections, error: connectionError } =
    await connectionQuery;

  if (connectionError) {
    throw connectionError;
  }

  if (existingConnections?.length > 0) {
    const existingConnection = existingConnections[0];

    return {
      exists: true,
      message:
        existingConnection.status === "pending"
          ? `${cleanEmail} already has a pending invitation.`
          : `${cleanEmail} is already connected to you.`,
      connection: existingConnection,
    };
  }

  return {
    exists: false,
    message: "",
  };
}

  async function addConnection({
    sourceType,
    targetType,
    targetEmail,
    sourceOrganizationId = null,
    sourceClientId = null,
    hourlyRate = 0,
    currency = "USD",
  }) {
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
        source_organization_id: sourceOrganizationId,
        source_client_id: sourceClientId,
        hourly_rate: hourlyRate,
        currency,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to add connection.");
    }

    return result.connection;
  }

async function handleSubmit(e) {
  e.preventDefault();

  if (!form.name.trim()) {
    showToast("Client name is required.", "error");
    return;
  }

  const cleanEmail = form.email.trim().toLowerCase();

  if (!cleanEmail) {
    showToast("Client email is required.", "error");
    return;
  }

  if (mode === "agency" && !organizationId) {
    showToast("Agency organization not found.", "error");
    return;
  }

  setSaving(true);

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("User session not found.");
    }

    const emailCheck = await checkClientEmailExists(cleanEmail);

    if (emailCheck.exists) {
      showToast(emailCheck.message, "error");
      setSaving(false);
      return;
    }

    /*
      Agency mode:
      Do NOT insert directly into clients first.
      Use RPC to create/reuse client row and create app_connections row.
    */
    if (mode === "agency") {
      const { data: connection, error } = await supabase.rpc(
        "add_agency_client_connection",
        {
          p_name: form.name.trim(),
          p_email: cleanEmail,
          p_hourly_rate: Number(form.hourly_rate || 0),
          p_currency: form.currency || "USD",
        }
      );

      if (error) throw error;

      showToast("Client connected to agency successfully.", "success");

      if (onClientAdded) {
        onClientAdded(connection);
      }

      closeDialog();
      setSaving(false);
      return;
    }

    /*
      VA mode:
      Keep your working VA flow.
    */
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: form.name.trim(),
        email: cleanEmail,
        phone: form.phone || null,
        company_name: form.company_name || null,
        billing_address: form.billing_address || null,
        hourly_rate: Number(form.hourly_rate || 0),
        currency: form.currency || "USD",
        status: "active",
        organization_id: null,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    try {
      await addConnection({
        sourceType: "va",
        targetType: "client",
        targetEmail: cleanEmail,
        sourceOrganizationId: null,
        sourceClientId: null,
        hourlyRate: Number(form.hourly_rate || 0),
        currency: form.currency || "USD",
      });
    } catch (connectionError) {
      console.warn(
        "Client saved, but app connection was not created:",
        connectionError
      );
    }

    showToast("Client added successfully.", "success");

    if (onClientAdded) {
      onClientAdded({
        ...data,
        currency: form.currency || "USD",
      });
    }

    closeDialog();
  } catch (error) {
    if (error.code === "23505") {
      showToast(
        mode === "agency"
          ? "This email is already connected to your agency."
          : "This client email already exists in your list.",
        "error"
      );
      setSaving(false);
      return;
    }

    showToast(error.message || "Unable to add client.", "error");
  }

  setSaving(false);
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