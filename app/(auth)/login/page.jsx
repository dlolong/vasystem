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
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const accountTypes = [
  {
    value: "agency",
    label: "Agency",
    icon: Building2,
    title: "Manage VAs and clients",
    description: "Open your agency workspace.",
  },
  {
    value: "va",
    label: "Virtual Assistant",
    icon: BriefcaseBusiness,
    title: "Track work and invoices",
    description: "Access your tasks, time logs, and billing.",
  },
  {
    value: "client",
    label: "Client",
    icon: UserRound,
    title: "Manage VAs and payments",
    description: "View invoices, tasks, and connected VAs.",
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

  const selectedAccount = useMemo(() => {
    return (
      accountTypes.find((item) => item.value === selectedType) ||
      accountTypes[0]
    );
  }, [selectedType]);

  async function getUserRole(user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("role, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (userRow?.role) {
      return userRow.role;
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileRow?.role) {
      return profileRow.role;
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
    if (["agency", "owner", "agency_admin", "admin"].includes(role)) {
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

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
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
        email: cleanEmail,
        password,
      });

      if (error) throw error;

      await supabase.rpc("claim_app_connections");

      const user = data.user;

      if (!user) {
        throw new Error("Login failed. Please try again.");
      }

      const role = await getUserRole(user);

      if (role === "client") {
        const { error: clientError } = await supabase.rpc("ensure_client_record", {
          p_name: user.user_metadata?.full_name || user.email,
          p_currency: "USD",
        });

        if (clientError) throw clientError;
      }

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
                  Welcome back. Continue managing tasks, time, clients, and
                  invoices.
                </h1>

                <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
                  One login for agencies, virtual assistants, and clients. Your
                  dashboard opens automatically based on your saved role.
                </p>
              </div>

              <div className="space-y-4">
                <FeatureItem text="Agency can manage VAs and clients" />
                <FeatureItem text="VA can track work and send invoices" />
                <FeatureItem text="Client can view invoices and connected VAs" />
                <FeatureItem text="Local bank details can appear on invoices" />
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
                    Login to your account
                  </h2>
                  <p className="text-sm text-slate-500">
                    Access your workspace securely.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-3 block text-sm font-semibold text-slate-700">
                  Account type
                </label>

                <div className="grid grid-cols-1 gap-3">
                  {accountTypes.map((item) => {
                    const Icon = item.icon;
                    const active = selectedType === item.value;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setSelectedType(item.value)}
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

              {message.text && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${message.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-green-200 bg-green-50 text-green-700"
                    }`}
                >
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email address
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
                      placeholder="you@example.com"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700"
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
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    Login as {selectedAccount.label}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 text-blue-600" size={18} />

                  <p className="text-xs leading-5 text-slate-500">
                    The selected account type is only for context. After login,
                    the system checks your saved role and redirects you to the
                    correct dashboard automatically.
                  </p>
                </div>
              </div>

              <p className="text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Create account
                </Link>
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
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