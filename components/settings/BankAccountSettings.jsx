"use client";

import { useEffect, useState } from "react";
import { Building2, Edit3, Loader2, Save, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAppContext } from "@/context/AppContext";

const emptyForm = {
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_account_type: "",
  bank_branch: "",
  bank_swift_code: "",
  bank_notes: "",
};

export default function BankAccountSettings({
  mode = "va",
  organizationId = null,
  compact = false,
}) {
  const { showToast } = useAppContext();

  const isAgency = mode === "agency";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [authUser, setAuthUser] = useState(null);
  const [resolvedOrganizationId, setResolvedOrganizationId] =
    useState(organizationId);

  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);

  useEffect(() => {
    loadBankDetails();
  }, [mode, organizationId]);

  async function loadBankDetails() {
    setLoading(true);
    setEditing(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setAuthUser(user);

    if (isAgency) {
      let orgId = organizationId;

      if (!orgId) {
        const { data: userRow } = await supabase
          .from("users")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();

        orgId = userRow?.organization_id || null;
      }

      setResolvedOrganizationId(orgId);

      if (!orgId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("organizations")
        .select(
          `
          bank_name,
          bank_account_name,
          bank_account_number,
          bank_account_type,
          bank_branch,
          bank_swift_code,
          bank_notes
        `
        )
        .eq("id", orgId)
        .maybeSingle();

      if (error) {
        showToast(error.message, "error");
      }

      const nextForm = {
        ...emptyForm,
        ...(data || {}),
      };

      setForm(nextForm);
      setOriginalForm(nextForm);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select(
        `
        bank_name,
        bank_account_name,
        bank_account_number,
        bank_account_type,
        bank_branch,
        bank_swift_code,
        bank_notes
      `
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      showToast(error.message, "error");
    }

    const nextForm = {
      ...emptyForm,
      ...(data || {}),
    };

    setForm(nextForm);
    setOriginalForm(nextForm);
    setLoading(false);
  }

  function updateField(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function cancelEdit() {
    setForm(originalForm);
    setEditing(false);
  }

  async function saveBankDetails() {
    setSaving(true);

    if (isAgency) {
      if (!resolvedOrganizationId) {
        showToast("Organization not found.", "error");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("organizations")
        .update(form)
        .eq("id", resolvedOrganizationId);

      if (error) {
        showToast(error.message, "error");
        setSaving(false);
        return;
      }

      setOriginalForm(form);
      setEditing(false);
      showToast("Agency bank details saved.", "success");
      setSaving(false);
      return;
    }

    if (!authUser?.id) {
      showToast("User session not found.", "error");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("users")
      .update(form)
      .eq("id", authUser.id);

    if (error) {
      showToast(error.message, "error");
      setSaving(false);
      return;
    }

    setOriginalForm(form);
    setEditing(false);
    showToast("VA bank details saved.", "success");
    setSaving(false);
  }

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Building2 size={18} />
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">
              Local Bank Account
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Copied into every new {isAgency ? "Agency" : "VA"} invoice.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Edit3 size={14} />
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={saveBankDetails}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={14} />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">
          Loading bank details...
        </div>
      ) : (
        <div
          className={`mt-4 grid grid-cols-1 gap-3 ${
            compact ? "" : "md:grid-cols-2"
          }`}
        >
          <TextField
            label="Bank Name"
            name="bank_name"
            value={form.bank_name}
            onChange={updateField}
            disabled={!editing}
            placeholder="Example: BDO, BPI"
          />

          <TextField
            label="Account Name"
            name="bank_account_name"
            value={form.bank_account_name}
            onChange={updateField}
            disabled={!editing}
            placeholder="Registered account name"
          />

          <TextField
            label="Account Number"
            name="bank_account_number"
            value={form.bank_account_number}
            onChange={updateField}
            disabled={!editing}
            placeholder="Bank account number"
          />

          <TextField
            label="Account Type"
            name="bank_account_type"
            value={form.bank_account_type}
            onChange={updateField}
            disabled={!editing}
            placeholder="Savings / Checking"
          />

          <TextField
            label="Branch"
            name="bank_branch"
            value={form.bank_branch}
            onChange={updateField}
            disabled={!editing}
            placeholder="Optional"
          />

          <TextField
            label="SWIFT / Bank Code"
            name="bank_swift_code"
            value={form.bank_swift_code}
            onChange={updateField}
            disabled={!editing}
            placeholder="Optional"
          />

          <div className={compact ? "" : "md:col-span-2"}>
            <label className="mb-2 block text-xs font-semibold text-slate-600">
              Payment Notes
            </label>

            <textarea
              name="bank_notes"
              value={form.bank_notes || ""}
              onChange={updateField}
              disabled={!editing}
              rows={compact ? 3 : 4}
              placeholder="Example: Please send proof of payment after transfer."
              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function TextField({ label, name, value, onChange, disabled, placeholder }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-slate-600">
        {label}
      </label>

      <input
        name={name}
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  );
}