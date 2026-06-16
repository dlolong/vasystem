"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const accountTypes = [
  {
    value: "agency",
    label: "Agency",
    description: "Manage VAs, clients, projects, and invoices.",
    icon: Building2,
  },
  {
    value: "va",
    label: "Virtual Assistant",
    description: "Track time, tasks, clients, and invoices.",
    icon: Users,
  },
  {
    value: "client",
    label: "Client",
    description: "View projects, invoices, and public billing links.",
    icon: UserRound,
  },
];

export default function LoginPage() {
  const router = useRouter();

  const [selectedType, setSelectedType] = useState("agency");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  async function getUserRole(user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("role, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (userRow?.role) {
      return userRow.role;
    }

    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (membership?.role) {
      return membership.role;
    }

    return user.user_metadata?.role || "";
  }

  function getRedirectPath(role) {
    if (["agency", "owner", "agency_admin"].includes(role)) {
      return "/agency";
    }

    if (role === "va") {
      return "/va";
    }

    if (role === "client") {
      return "/client";
    }

    return "/";
  }

  async function handleLogin(e) {
    e.preventDefault();

    setMessage({
      type: "",
      text: "",
    });

    if (!email.trim()) {
      setMessage({
        type: "error",
        text: "Email address is required.",
      });
      return;
    }

    if (!password) {
      setMessage({
        type: "error",
        text: "Password is required.",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      const user = data.user;

      if (!user) {
        throw new Error("Login failed. Please try again.");
      }

      const role = await getUserRole(user);
      const redirectPath = getRedirectPath(role);

      setMessage({
        type: "success",
        text: "Login successful. Redirecting...",
      });

      router.replace(redirectPath);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to login. Please try again.",
      });
    }

    setLoading(false);
  }

  const selectedAccount = accountTypes.find(
    (item) => item.value === selectedType
  );

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-blue-700 to-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute left-16 top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-16 right-10 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />

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
                Welcome back to your workspace
              </p>

              <h2 className="text-5xl font-bold leading-tight">
                Login and continue managing your VA business.
              </h2>

              <p className="mt-6 text-lg leading-8 text-blue-100">
                One login for agencies, virtual assistants, and clients. Your
                dashboard will open automatically based on your account role.
              </p>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-4">
            <FeatureCard title="Agencies" description="Manage teams" />
            <FeatureCard title="VAs" description="Track work" />
            <FeatureCard title="Clients" description="View invoices" />
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
                Login to your workspace
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  Welcome Back
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Select your account type for context. Your actual dashboard is
                  still based on your saved role.
                </p>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {accountTypes.map((item) => {
                  const Icon = item.icon;
                  const active = selectedType === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSelectedType(item.value)}
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

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email Address
                  </label>

                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700">
                      Password
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Forgot?
                    </Link>
                  </div>

                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 pl-11 pr-12 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-white p-2 text-indigo-600">
                      <ShieldCheck size={20} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Login as {selectedAccount?.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        After login, the system checks your saved role and sends
                        you to the correct dashboard automatically.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      Login
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Create account
                </Link>
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              VA System — Track hours, manage clients, and send invoices faster.
            </p>
          </div>
        </section>
      </div>
    </main>
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