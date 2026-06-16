import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* NAV */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="text-xl font-bold text-indigo-600">
          VA System
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            Login
          </Link>

          <Link
            href="/signup"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 py-20 lg:grid-cols-2">
        <div>
          <div className="mb-4 inline-flex rounded-full bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700">
            Built for VAs, Agencies, and Clients
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
            Manage virtual assistants, track time, and invoice clients in one system.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-slate-600">
            VA System helps agencies and freelancers manage VAs, assign tasks,
            monitor work hours, organize projects, and send professional invoices
            with payment links.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-700"
            >
              Start Free
            </Link>

            <Link
              href="/login"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Login
            </Link>
          </div>
        </div>

        {/* HERO CARD */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">
                Agency Dashboard
              </h3>
              <p className="text-sm text-slate-500">
                Real-time VA operations
              </p>
            </div>

            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Live
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Stat label="Active VAs" value="12" />
            <Stat label="Hours Today" value="42h" />
            <Stat label="Projects" value="8" />
            <Stat label="Invoices" value="$4.2k" />
          </div>

          <div className="mt-6 space-y-3">
            {["Maria Santos", "John VA", "Anna Support"].map((name) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{name}</p>
                  <p className="text-xs text-slate-500">Working on tasks</p>
                </div>

                <span className="h-3 w-3 rounded-full bg-green-500" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <h2 className="text-2xl font-bold text-slate-900">
          Everything you need to run a VA business
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          <Feature
            title="Time Tracking"
            description="Track VA work hours, daily logs, and productivity in one place."
          />
          <Feature
            title="Agency Management"
            description="Add VAs, clients, projects, and assign tasks from one dashboard."
          />
          <Feature
            title="Invoices & Payments"
            description="Generate invoices and send payment links to clients easily."
          />
          <Feature
            title="Client Portal"
            description="Clients can view projects, VAs, and invoices from their own dashboard."
          />
          <Feature
            title="Role-Based Access"
            description="Separate access for agency owners, VAs, and clients."
          />
          <Feature
            title="Multi-Tenant Ready"
            description="Each agency has its own secure workspace and data."
          />
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Feature({ title, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}