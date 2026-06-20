"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const roles = [
  {
    value: "agency",
    label: "Agency",
    icon: Building2,
    title: "Manage VAs and clients",
    description: "Create a workspace for your agency team.",
  },
  {
    value: "va",
    label: "Virtual Assistant",
    icon: BriefcaseBusiness,
    title: "Work with agencies or clients",
    description: "Register independently and accept tasks or invoices.",
  },
  {
    value: "client",
    label: "Client",
    icon: UserRound,
    title: "Hire and manage VAs",
    description: "Create a client account without an agency.",
  },
];

const currencies = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "PHP", label: "PHP — Philippine Peso" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
];

export default function SignupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("agency");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    organizationName: "",
    currency: "USD",
  });

  const selectedRole = useMemo(() => {
    return roles.find((item) => item.value === role) || roles[0];
  }, [role]);

  function updateField(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSignup(e) {
    e.preventDefault();

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const cleanEmail = form.email.trim().toLowerCase();
      const cleanFullName = form.fullName.trim();

      if (role === "agency" && !form.organizationName.trim()) {
        throw new Error("Agency name is required.");
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: form.password,
        options: {
          data: {
            full_name: cleanFullName,
            role,
          },
        },
      });

      if (error) throw error;

      const user = data.user;

      if (!user) {
        setSuccessMessage(
          "Account created. Please check your email to confirm your account."
        );
        setLoading(false);
        return;
      }

      await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: cleanFullName || null,
        role,
        organization_id: null,
      });

      if (role === "agency") {
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: form.organizationName.trim(),
            owner_id: user.id,
            plan: "free",
          })
          .select()
          .single();

        if (orgError) throw orgError;

        await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          full_name: cleanFullName || null,
          role: "agency",
          organization_id: org.id,
        });

        await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email,
          full_name: cleanFullName || null,
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

        await supabase.rpc("claim_app_connections");
      }

      if (role === "va") {
        await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          full_name: cleanFullName || null,
          role: "va",
          organization_id: null,
        });

        await supabase.rpc("claim_va_connections");
        await supabase.rpc("claim_app_connections");
      }

      if (role === "client") {
        await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          full_name: cleanFullName || null,
          role: "client",
          organization_id: null,
        });

        await supabase.rpc("ensure_client_record", {
          p_name: cleanFullName || user.email,
          p_currency: form.currency || "USD",
        });

        await supabase.rpc("claim_app_connections");
      }

      setSuccessMessage("Account created successfully. Redirecting to login...");
      setTimeout(() => router.push("/login"), 900);
    } catch (err) {
      setErrorMessage(err.message || "Unable to create account.");
    }

    setLoading(false);
  }

  const SelectedIcon = selectedRole.icon;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl lg:grid-cols-[1fr_480px]">
          <section className="relative hidden overflow-hidden bg-slate-900 p-10 text-white lg:block">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />

            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={50}
                    height={50}
                    className="h-16 w-16 object-contain"
                    priority
                  />

                  <div>
                    <h1 className="text-xl font-bold">VA System</h1>
                    <p className="text-sm text-blue-100">
                      Agency, VA, and client workspace
                    </p>
                  </div>
                </div>

                <h1 className="mt-8 max-w-xl text-4xl font-bold leading-tight">
                  One system for agencies, VAs, clients, tasks, time tracking,
                  and invoices.
                </h1>

                <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
                  Create an account based on your role. VAs and Clients can
                  register independently, while Agencies get their own workspace.
                </p>
              </div>

              <div className="space-y-4">
                <FeatureItem text="Agency can add VAs by email" />
                <FeatureItem text="Client can manage their own VAs" />
                <FeatureItem text="VA can invoice Agency or Client" />
                <FeatureItem text="Invoices can include local bank details" />
              </div>
            </div>
          </section>

          <section className="bg-white p-5 sm:p-8 lg:p-10">
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  <Users size={21} />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Create your account
                  </h2>
                  <p className="text-sm text-slate-500">
                    Start with the role that matches you.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-5">
              <div>
                <label className="mb-3 block text-sm font-semibold text-slate-700">
                  Choose account type
                </label>

                <div className="grid grid-cols-1 gap-3">
                  {roles.map((item) => {
                    const Icon = item.icon;
                    const active = role === item.value;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setRole(item.value)}
                        className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${active
                          ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                      >
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-500"
                            }`}
                        >
                          <Icon size={20} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-slate-900">
                              {item.label}
                            </p>

                            {active && (
                              <CheckCircle2
                                size={18}
                                className="shrink-0 text-blue-600"
                              />
                            )}
                          </div>

                          <p className="mt-1 text-sm font-medium text-slate-700">
                            {item.title}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {successMessage}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <TextField
                  label="Full name"
                  name="fullName"
                  value={form.fullName}
                  onChange={updateField}
                  placeholder="Juan Dela Cruz"
                  required
                />

                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder="you@example.com"
                  required
                />

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </label>

                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={updateField}
                      placeholder="Create a secure password"
                      required
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {role === "agency" && (
                  <TextField
                    label="Agency / Company name"
                    name="organizationName"
                    value={form.organizationName}
                    onChange={updateField}
                    placeholder="Your agency name"
                    required
                  />
                )}

                {role === "client" && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Preferred currency
                    </label>

                    <select
                      name="currency"
                      value={form.currency}
                      onChange={updateField}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      {currencies.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create {selectedRole.label} Account
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 text-blue-600" size={18} />

                  <p className="text-xs leading-5 text-slate-500">
                    VA and Client accounts do not need an organization. Agency
                    accounts automatically create a workspace.
                  </p>
                </div>
              </div>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Sign in
                </Link>
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function TextField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function FeatureItem({ text }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-400/20 text-green-300">
        <CheckCircle2 size={17} />
      </div>

      <p className="text-sm font-medium text-slate-100">{text}</p>
    </div>
  );
}