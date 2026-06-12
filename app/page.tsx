import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="max-w-6xl mx-auto px-4 py-4">
        <nav className="flex items-center justify-between mb-20">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold">
              V
            </div>

            <span className="text-xl font-bold text-slate-900">
              VA System
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Login
            </Link>

            <Link
              href="/signup"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Start Free
            </Link>
          </div>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              Built for Virtual Assistants
            </p>

            <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900">
              Stop tracking VA hours in spreadsheets.
            </h1>

            <p className="mt-6 text-lg text-slate-600">
              Manage clients, log work hours, and generate weekly invoices automatically in one simple dashboard.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/signup"
                className="rounded-xl bg-blue-600 px-6 py-3 text-center font-semibold text-white shadow-md hover:bg-blue-700"
              >
                Create account
              </Link>

              <Link
                href="/login"
                className="rounded-xl border border-slate-300 px-6 py-3 text-center font-semibold text-slate-700 hover:bg-white"
              >
                Login
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6">
            <div className="grid grid-cols-2 gap-4">
              <Card title="This Week" value="32.5 hrs" />
              <Card title="Billable" value="₱24,375" />
              <Card title="Clients" value="8 active" />
              <Card title="Invoices" value="3 unpaid" />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                Recent time entries
              </div>

              <div className="divide-y divide-slate-100">
                <Row client="ABC Company" hours="3.5 hrs" amount="₱1,750" />
                <Row client="XYZ Client" hours="2 hrs" amount="₱1,000" />
                <Row client="Design Co." hours="4 hrs" amount="₱2,000" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

// ✅ Typed Card
type CardProps = {
  title: string
  value: string | number
}

function Card({ title, value }: CardProps) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

// ✅ Typed Row (THIS WAS YOUR ERROR)
type RowProps = {
  client: string
  hours: string
  amount: string
}

function Row({ client, hours, amount }: RowProps) {
  return (
    <div className="px-4 py-3 flex items-center justify-between text-sm">
      <div>
        <p className="font-medium text-slate-900">{client}</p>
        <p className="text-slate-500">{hours}</p>
      </div>

      <p className="font-semibold text-slate-900">{amount}</p>
    </div>
  )
}