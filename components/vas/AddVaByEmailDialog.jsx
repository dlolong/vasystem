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
        hourly_rate: Number(hourlyRate || 0),
        currency: currency || "USD",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to add VA.");
    }

    return result.connection;
  }

  async function checkVaEmailExists(vaEmail) {
    const cleanEmail = vaEmail?.trim()?.toLowerCase();

    if (!cleanEmail) {
      return {
        exists: false,
        message: "",
      };
    }

    /*
      Check new app_connections table.
      This catches active and pending VAs added using the new system.
    */
    let connectionQuery = supabase
      .from("app_connections")
      .select("id, target_email, status, source_type, target_type")
      .eq("target_type", "va")
      .ilike("target_email", cleanEmail)
      .in("status", ["active", "pending"])
      .limit(1);

    if (isAgency && organizationId) {
      connectionQuery = connectionQuery
        .eq("source_type", "agency")
        .eq("source_organization_id", organizationId);
    }

    if (isClient && clientId) {
      connectionQuery = connectionQuery
        .eq("source_type", "client")
        .eq("source_client_id", clientId);
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
            : `${cleanEmail} is already connected.`,
      };
    }

    /*
      Check old va_connections table.
      This catches legacy VAs added before app_connections.
    */
    let legacyQuery = supabase
      .from("va_connections")
      .select("id, va_email, status, connection_type")
      .ilike("va_email", cleanEmail)
      .in("status", ["active", "pending"])
      .limit(1);

    if (isAgency && organizationId) {
      legacyQuery = legacyQuery
        .eq("connection_type", "agency")
        .eq("organization_id", organizationId);
    }

    if (isClient && clientId) {
      legacyQuery = legacyQuery
        .eq("connection_type", "client")
        .eq("client_id", clientId);
    }

    const { data: existingLegacy, error: legacyError } = await legacyQuery;

    if (legacyError) {
      throw legacyError;
    }

    if (existingLegacy?.length > 0) {
      const existingConnection = existingLegacy[0];

      return {
        exists: true,
        message:
          existingConnection.status === "pending"
            ? `${cleanEmail} already has a pending invitation.`
            : `${cleanEmail} is already connected.`,
      };
    }

    return {
      exists: false,
      message: "",
    };
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

    try {
      const emailCheck = await checkVaEmailExists(vaEmail);

      if (emailCheck.exists) {
        showToast(emailCheck.message, "error");
        setSaving(false);
        return;
      }

      const connection = await addConnection({
        sourceType: isAgency ? "agency" : "client",
        targetType: "va",
        targetEmail: vaEmail,
        sourceOrganizationId: isAgency ? organizationId : null,
        sourceClientId: isClient ? clientId : null,
        hourlyRate: Number(form.hourly_rate || 0),
        currency: form.currency || "USD",
      });

      showToast(
        connection?.status === "pending"
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
        onAdded(connection);
      }
    } catch (error) {
      if (error.code === "23505") {
        showToast("This VA email is already connected.", "error");
        setSaving(false);
        return;
      }

      showToast(error.message || "Unable to add VA.", "error");
    }

    setSaving(false);
  }

  return (
    <AppDialog
      open={open}
      title="Add VA by Email"
      description={
        isAgency
          ? "Connect a VA to your agency using their email."
          : "Connect a VA or agency provider to your client account using their email."
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
            If the VA is not registered yet, an invitation email will be sent
            and they will appear as pending.
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