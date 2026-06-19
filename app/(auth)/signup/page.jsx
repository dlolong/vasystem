"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("agency");
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    organizationName: "",
    currency: "USD",
  });

  function updateField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            role,
          },
        },
      });

      if (error) throw error;

      const user = data.user;

      if (!user) {
        throw new Error(
          "Signup successful. Please check your email to confirm your account."
        );
      }

      await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: form.fullName || null,
        role,
        organization_id: null,
      });

      if (role === "agency") {
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: form.organizationName,
            owner_id: user.id,
            plan: "free",
          })
          .select()
          .single();

        if (orgError) throw orgError;

        await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          full_name: form.fullName || null,
          role: "agency",
          organization_id: org.id,
        });

        await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email,
          full_name: form.fullName || null,
          role: "agency",
          organization_id: org.id,
        });

        const { error: membershipError } = await supabase
          .from("memberships")
          .insert({
            organization_id: org.id,
            user_id: user.id,
            role: "owner",
            status: "active",
          });

        if (membershipError) throw membershipError;
      }

      if (role === "va") {
        await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          full_name: form.fullName || null,
          role: "va",
          organization_id: null,
        });

        await supabase.rpc("claim_va_connections");
      }

      if (role === "client") {
        await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          full_name: form.fullName || null,
          role: "client",
          organization_id: null,
        });

        await supabase.from("clients").upsert({
          user_id: user.id,
          email: user.email,
          name: form.fullName || user.email,
          currency: form.currency || "USD",
          status: "active",
          organization_id: null,
        });
      }

      router.push("/login");
    } catch (err) {
      setErrorMessage(err.message || "Unable to create account.");
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Create Account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            VA and Client accounts can register without an organization.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <select
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="agency">Agency</option>
          <option value="va">Virtual Assistant</option>
          <option value="client">Client</option>
        </select>

        <input
          name="fullName"
          placeholder="Full name"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          onChange={updateField}
          required
        />

        <input
          name="email"
          type="email"
          placeholder="Email"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          onChange={updateField}
          required
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          onChange={updateField}
          required
        />

        {role === "agency" && (
          <input
            name="organizationName"
            placeholder="Agency / Company Name"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            onChange={updateField}
            required
          />
        )}

        {role === "client" && (
          <select
            name="currency"
            value={form.currency}
            onChange={updateField}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
          >
            <option value="USD">USD — US Dollar</option>
            <option value="PHP">PHP — Philippine Peso</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="AUD">AUD — Australian Dollar</option>
            <option value="CAD">CAD — Canadian Dollar</option>
          </select>
        )}

        <button
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}