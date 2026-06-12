'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function NewClientPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    billing_address: '',
    currency: 'PHP',
    hourly_rate: '',
    payment_terms: 7,
  })

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setLoading(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    const { error } = await supabase.from('clients').insert({
      user_id: session.user.id,
      name: form.name,
      company_name: form.company_name,
      email: form.email,
      phone: form.phone,
      billing_address: form.billing_address,
      currency: form.currency,
      hourly_rate: Number(form.hourly_rate || 0),
      payment_terms: Number(form.payment_terms || 7),
      status: 'active',
    })

    setLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    router.push('/clients')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Add Client</h1>
            <p className="text-sm text-slate-500">
              Create a client profile for billing and time tracking.
            </p>
          </div>

          <Link
            href="/clients"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {errorMessage && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Client name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="John Smith"
            />

            <Input
              label="Company name"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              placeholder="ABC Company"
            />

            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="client@example.com"
            />

            <Input
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+63 900 000 0000"
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Billing address
              </label>

              <textarea
                name="billing_address"
                value={form.billing_address}
                onChange={handleChange}
                rows={3}
                placeholder="Client billing address"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Currency
                </label>

                <select
                  name="currency"
                  value={form.currency}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="PHP">PHP</option>
                  <option value="USD">USD</option>
                  <option value="AUD">AUD</option>
                  <option value="CAD">CAD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <Input
                label="Hourly rate"
                name="hourly_rate"
                type="number"
                value={form.hourly_rate}
                onChange={handleChange}
                placeholder="500"
              />

              <Input
                label="Payment terms"
                name="payment_terms"
                type="number"
                value={form.payment_terms}
                onChange={handleChange}
                placeholder="7"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Saving client...' : 'Save Client'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

function Input({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>

      <input
        type={type}
        name={name}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  )
}