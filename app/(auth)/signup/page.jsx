"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  UserRound,
  Users,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const roles = [
  {
    value: "agency",
    label: "Agency",
    description: "Manage VAs, clients, projects, and invoices.",
    icon: Building2,
  },
  {
    value: "va",
    label: "Virtual Assistant",
    description: "Track time, manage clients, tasks, and invoices.",
    icon: Users,
  },
  {
    value: "client",
    label: "Client",
    description: "View projects and invoices from your agency.",
    icon: UserRound,
  },
];

export default function SignupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("agency");
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    organizationName: "",
    organizationId: "",
  });

  function updateField(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function validateForm() {
    if (!form.fullName.trim()) {
      return "Full name is required.";
    }

    if (!form.email.trim()) {
      return "Email is required.";
    }

    if (!form.password || form.password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    if (role === "agency" && !form.organizationName.trim()) {
      return "Agency / company name is required.";
    }

    if (role === "client" && !form.organizationId.trim()) {
      return "Organization ID is required for client accounts.";
    }

    return "";
  }

  async function handleSignup(e) {
    e.preventDefault();

    setMessage({
      type: "",
      text: "",
    });

    const validationError = validateForm();

    if (validationError) {
      setMessage({
        type: "error",
        text: validationError,
      });
      return;
    }

    setLoading(true);

    try {
      const email = form.email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName.trim(),
            role,
          },
        },
      });

      if (error) throw error;

      const user = data.user;

      if (!user) {
        setMessage({
          type: "success",
          text: "Signup successful. Please check your email to confirm your account.",
        });
        setLoading(false);
        return;
      }

      await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: form.fullName.trim(),
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

        const { error: userError } = await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          role: "agency",
          organization_id: org.id,
        });

        if (userError) throw userError;

        const { error: membershipError } = await supabase
          .from("memberships")
          .upsert(
            {
              organization_id: org.id,
              user_id: user.id,
              role: "owner",
              status: "active",
            },
            {
              onConflict: "organization_id,user_id",
            }
          );

        if (membershipError) throw membershipError;
      }

      if (role === "va") {
        const organizationId = form.organizationId.trim() || null;

        const { error: userError } = await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          role: "va",
          organization_id: organizationId,
        });

        if (userError) throw userError;

        if (organizationId) {
          const { error: membershipError } = await supabase
            .from("memberships")
            .upsert(
              {
                organization_id: organizationId,
                user_id: user.id,
                role: "va",
                status: "active",
              },
              {
                onConflict: "organization_id,user_id",
              }
            );

          if (membershipError) throw membershipError;
        }
      }

      if (role === "client") {
        const organizationId = form.organizationId.trim();

        const { error: userError } = await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          role: "client",
          organization_id: organizationId,
        });

        if (userError) throw userError;

        const { error: membershipError } = await supabase
          .from("memberships")
          .upsert(
            {
              organization_id: organizationId,
              user_id: user.id,
              role: "client",
              status: "active",
            },
            {
              onConflict: "organization_id,user_id",
            }
          );

        if (membershipError) throw membershipError;
      }

      setMessage({
        type: "success",
        text: "Account created successfully. Redirecting to login...",
      });

      setTimeout(() => {
        router.push("/login");
      }, 800);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message || "Something went wrong.",
      });
    }

    setLoading(false);
  }

  const selectedRole = roles.find((item) => item.value === role);

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-blue-700 to-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute left-20 top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-20 right-10 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-black text-indigo-700">
                V
              </div>

              <div>
                <h1 className="text-xl font-bold">VA System</h1>
                <p className="text-sm text-blue-100">
                  Agency, VA, and client workspace
                </p>
              </div>
            </div>

            <div className="mt-24 max-w-xl">
              <p className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-blue-50 ring-1 ring-white/20">
                Built for modern virtual assistant teams
              </p>

              <h2 className="text-5xl font-bold leading-tight">
                Run your VA business in one clean dashboard.
              </h2>

              <p className="mt-6 text-lg leading-8 text-blue-100">
                Manage virtual assistants, clients, projects, time tracking,
                invoices, and public invoice links from one SaaS workspace.
              </p>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-4">
            <FeatureCard title="Track Time" description="Manual and timer logs" />
            <FeatureCard title="Invoice Clients" description="Public invoice links" />
            <FeatureCard title="Manage Teams" description="Agency-ready roles" />
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-2xl">
            <div className="mb-8 text-center lg:hidden">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white">
                V
              </div>
              <h1 className="mt-4 text-2xl font-bold text-slate-900">
                VA System
              </h1>
              <p className="text-sm text-slate-500">
                Create your workspace account
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  Create Account
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Choose your role and setup your account.
                </p>
              </div>

              {message.text && (
                <div
                  className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                    message.type === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-green-200 bg-green-50 text-green-700"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <label className="mb-3 block text-sm font-semibold text-slate-700">
                    Choose Account Type
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {roles.map((item) => {
                      const Icon = item.icon;
                      const active = role === item.value;

                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setRole(item.value)}
                          className={`relative rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {active && (
                            <CheckCircle
                              size={18}
                              className="absolute right-3 top-3 text-indigo-600"
                            />
                          )}

                          <div
                            className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                              active
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <Icon size={20} />
                          </div>

                          <p className="font-semibold text-slate-900">
                            {item.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Full Name"
                    name="fullName"
                    value={form.fullName}
                    onChange={updateField}
                    placeholder="Your full name"
                  />

                  <Field
                    label="Email Address"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    placeholder="you@email.com"
                  />
                </div>

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
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 pr-12 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {role === "agency" && (
                  <Field
                    label="Agency / Company Name"
                    name="organizationName"
                    value={form.organizationName}
                    onChange={updateField}
                    placeholder="Example: Elite VA Agency"
                  />
                )}

                {role === "va" && (
                  <Field
                    label="Organization ID"
                    name="organizationId"
                    value={form.organizationId}
                    onChange={updateField}
                    placeholder="Optional if you are an independent VA"
                    helper="Leave empty if you want to use VA System as an independent freelancer."
                  />
                )}

                {role === "client" && (
                  <Field
                    label="Organization ID"
                    name="organizationId"
                    value={form.organizationId}
                    onChange={updateField}
                    placeholder="Organization ID from your agency"
                    helper="Client accounts need an organization ID from the agency."
                  />
                )}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    {selectedRole && (
                      <div className="rounded-xl bg-white p-2 text-indigo-600">
                        <selectedRole.icon size={20} />
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Signing up as {selectedRole?.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedRole?.description}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Login
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  helper,
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
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
      />

      {helper && <p className="mt-2 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

function FeatureCard({ title, description }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-blue-100">{description}</p>
    </div>
  );
}