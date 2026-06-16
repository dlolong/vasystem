'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function NewTimeEntryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedClientId = searchParams.get('client_id')

  const [userId, setUserId] = useState(null)
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [form, setForm] = useState({
    client_id: '',
    work_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    hours: '',
    description: '',
    billable: true,
    hourly_rate: '',
  })

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      router.push('/login')
      return
    }

    setUserId(session.user.id)

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .order('name', { ascending: true })

    if (!error) {
      const clientList = data || []
      setClients(clientList)

      const initialClient =
        clientList.find((client) => client.id === selectedClientId) ||
        clientList[0]

      if (initialClient) {
        setForm((prev) => ({
          ...prev,
          client_id: initialClient.id,
          hourly_rate: initialClient.hourly_rate || '',
        }))
      }
    }

    setPageLoading(false)
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target

    if (name === 'client_id') {
      const selectedClient = clients.find((client) => client.id === value)

      setForm((prev) => ({
        ...prev,
        client_id: value,
        hourly_rate: selectedClient?.hourly_rate || '',
      }))

      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const calculateHours = () => {
    if (!form.start_time || !form.end_time) return

    const start = new Date(`${form.work_date}T${form.start_time}`)
    const end = new Date(`${form.work_date}T${form.end_time}`)

    if (end <= start) {
      setErrorMessage('End time must be later than start time.')
      return
    }

    const diffMs = end - start
    const hours = diffMs / 1000 / 60 / 60

    setErrorMessage('')
    setForm((prev) => ({
      ...prev,
      hours: hours.toFixed(2),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setLoading(true)

    if (!form.client_id) {
      setErrorMessage('Please select a client.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('time_entries').insert({
      user_id: userId,
      client_id: form.client_id,
      work_date: form.work_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      hours: Number(form.hours || 0),
      description: form.description,
      hourly_rate: Number(form.hourly_rate || 0),
      billable: form.billable,
      invoiced: false,
    })

    setLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    router.push('/time')
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        Loading form...
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-slate-900">
            Add a client first
          </h1>

          <p className="mt-2 text-slate-500">
            You need at least one active client before adding a time entry.
          </p>

          <Link
            href="/clients/new"
            className="inline-flex mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Add Client
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Add Time Entry</h1>
            <p className="text-sm text-slate-500">
              Log billable or non-billable work hours.
            </p>
          </div>

          <Link
            href="/time"
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Client
              </label>

              <select
                name="client_id"
                value={form.client_id}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Work date"
              name="work_date"
              type="date"
              value={form.work_date}
              onChange={handleChange}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Start time"
                name="start_time"
                type="time"
                value={form.start_time}
                onChange={handleChange}
              />

              <Input
                label="End time"
                name="end_time"
                type="time"
                value={form.end_time}
                onChange={handleChange}
              />

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={calculateHours}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Calculate
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Hours"
                name="hours"
                type="number"
                value={form.hours}
                onChange={handleChange}
                required
                placeholder="2.5"
              />

              <Input
                label="Hourly rate"
                name="hourly_rate"
                type="number"
                value={form.hourly_rate}
                onChange={handleChange}
                required
                placeholder="500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                placeholder="Email management, admin support, data entry..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="billable"
                checked={form.billable}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-300"
              />

              <span className="text-sm font-medium text-slate-700">
                Billable
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Saving time entry...' : 'Save Time Entry'}
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
        step={type === 'number' ? '0.01' : undefined}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  )
}