'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAppContext } from "@/context/AppContext";
import AddClientDialog from "@/components/va/AddClientDialog";
import AddTimeDialog from "@/components/va/AddTimeDialog";

export default function DashboardPage() {
  const intervalRef = useRef(null)

  const [user, setUser] = useState(null)
  const [clients, setClients] = useState([])

  const { showToast } = useAppContext()
  const [showClientDialog, setShowClientDialog] = useState(false)
  const [showTimeDialog, setShowTimeDialog] = useState(false)

  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    hourly_rate: '',
  })

  const [stats, setStats] = useState({
    totalHours: 0,
    billableAmount: 0,
    unpaidInvoices: 0,
    activeClients: 0,
  })

  const [recentEntries, setRecentEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const [activeTimerId, setActiveTimerId] = useState(null)
  const [timerStatus, setTimerStatus] = useState('idle') // idle, running, paused
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [timerStartDate, setTimerStartDate] = useState(null)
  const [timerError, setTimerError] = useState('')
  const [timerSuccess, setTimerSuccess] = useState('')

  const [timerForm, setTimerForm] = useState({
    client_id: '',
    description: '',
  })

  useEffect(() => {
    loadDashboard()

    return () => {
      clearTimerInterval()
    }
  }, [])

  const clearTimerInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const startLocalInterval = () => {
    clearTimerInterval()

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
  }

  const loadDashboard = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      return;
    }

    const currentUser = session.user;
    setUser(currentUser);

    // Get optional users row
    const { data: userRow } = await supabase
      .from("users")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    // Get optional agency membership
    const { data: membershipRow } = await supabase
      .from("memberships")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("status", "active")
      .maybeSingle();

    const organizationId =
      membershipRow?.organization_id || userRow?.organization_id || null;

    const loadedClients = await loadClients(currentUser.id, organizationId);

    await Promise.all([
      loadDashboardData(currentUser.id, organizationId),
      loadActiveTimer(currentUser.id, loadedClients),
    ]);

    setLoading(false);
  };

  const loadClients = async (userId, organizationId = null) => {
    let query = supabase
      .from("clients")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (organizationId) {
      query = query.or(
        `user_id.eq.${userId},organization_id.eq.${organizationId}`
      );
    } else {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      setClients([]);
      return [];
    }

    const activeClients = data || [];
    setClients(activeClients);

    if (activeClients.length > 0) {
      setTimerForm((prev) => ({
        ...prev,
        client_id: prev.client_id || activeClients[0].id,
      }));
    }

    return activeClients;
  };

  const loadActiveTimer = async (userId, loadedClients = []) => {
    const { data, error } = await supabase
      .from('active_timers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      setTimerError(error.message)
      return
    }

    if (!data) {
      setActiveTimerId(null)
      setTimerStatus('idle')
      setElapsedSeconds(0)
      clearTimerInterval()
      return
    }

    setActiveTimerId(data.id)
    setTimerStatus(data.status)
    setTimerStartDate(new Date(data.started_at))

    setTimerForm({
      client_id:
        data.client_id ||
        loadedClients?.[0]?.id ||
        '',
      description: data.description || '',
    })

    const calculatedSeconds = calculateElapsedSecondsFromTimer(data)
    setElapsedSeconds(calculatedSeconds)

    if (data.status === 'running') {
      startLocalInterval()
    } else {
      clearTimerInterval()
    }
  }

  const calculateElapsedSecondsFromTimer = (timer) => {
    const accumulated = Number(timer.accumulated_seconds || 0)

    if (timer.status === 'paused') {
      return accumulated
    }

    const lastResumedAt = new Date(timer.last_resumed_at)
    const now = new Date()
    const runningSeconds = Math.floor((now - lastResumedAt) / 1000)

    return accumulated + Math.max(runningSeconds, 0)
  }

  const loadDashboardData = async (userId, organizationId = null) => {
    const startOfWeek = getStartOfWeek(new Date())
    const endOfWeek = getEndOfWeek(new Date())

    const { data: timeLogs } = await supabase
      .from('time_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startOfWeek.toISOString())
      .lte('start_time', endOfWeek.toISOString())
      .order('start_time', { ascending: false })

    let clientsQuery = supabase
      .from('clients')
      .select('*')
      .eq('status', 'active')

    if (organizationId) {
      clientsQuery = clientsQuery.or(
        `user_id.eq.${userId},organization_id.eq.${organizationId}`
      )
    } else {
      clientsQuery = clientsQuery.eq('user_id', userId)
    }

    const { data: clients } = await clientsQuery

    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'paid')

    const totalHours = timeLogs?.reduce((sum, log) => {
      return sum + Number(log.duration || 0) / 3600
    }, 0)

    const billableAmount = timeLogs?.reduce((sum, log) => {
      if (!log.billable) return sum

      const hours = Number(log.duration || 0) / 3600
      const rate = Number(log.hourly_rate || 0)

      return sum + hours * rate
    }, 0)

    setStats({
      totalHours: totalHours || 0,
      billableAmount: billableAmount || 0,
      unpaidInvoices: invoices?.length || 0,
      activeClients: clients?.length || 0,
    })

    setRecentEntries(timeLogs?.slice(0, 5) || [])
  }

  const handleTimerFormChange = (e) => {
    const { name, value } = e.target

    setTimerForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const startTimer = async () => {
    setTimerError('')
    setTimerSuccess('')

    if (!user) {
      setTimerError('User session not found.')
      return
    }

    if (!timerForm.client_id) {
      setTimerError('Please select a client first.')
      return
    }

    const selectedClient = clients.find(
      (client) => client.id === timerForm.client_id
    )

    const now = new Date()

    const { data, error } = await supabase
      .from('active_timers')
      .insert({
        user_id: user.id,
        organization_id: selectedClient?.organization_id || null,
        client_id: timerForm.client_id,
        description: timerForm.description || '',
        hourly_rate: Number(selectedClient?.hourly_rate || 0),
        status: 'running',
        started_at: now.toISOString(),
        last_resumed_at: now.toISOString(),
        accumulated_seconds: 0,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        setTimerError('You already have an active timer. Refresh the page to reload it.')
      } else {
        setTimerError(error.message)
      }

      return
    }

    setActiveTimerId(data.id)
    setTimerStatus('running')
    setTimerStartDate(now)
    setElapsedSeconds(0)
    startLocalInterval()
  }

  const pauseTimer = async () => {
    if (timerStatus !== 'running' || !activeTimerId) return

    setTimerError('')
    setTimerSuccess('')

    clearTimerInterval()

    const { error } = await supabase
      .from('active_timers')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        accumulated_seconds: elapsedSeconds,
      })
      .eq('id', activeTimerId)

    if (error) {
      setTimerError(error.message)
      startLocalInterval()
      return
    }

    setTimerStatus('paused')
  }

  const resumeTimer = async () => {
    if (timerStatus !== 'paused' || !activeTimerId) return

    setTimerError('')
    setTimerSuccess('')

    const now = new Date()

    const { error } = await supabase
      .from('active_timers')
      .update({
        status: 'running',
        last_resumed_at: now.toISOString(),
        paused_at: null,
        accumulated_seconds: elapsedSeconds,
      })
      .eq('id', activeTimerId)

    if (error) {
      setTimerError(error.message)
      return
    }

    setTimerStatus('running')
    startLocalInterval()
  }

  const stopAndSaveTimer = async () => {
    setTimerError('')
    setTimerSuccess('')

    if (!user) {
      setTimerError('User session not found.')
      return
    }

    if (!activeTimerId) {
      setTimerError('No active timer found.')
      return
    }

    if (!timerForm.client_id) {
      setTimerError('Please select a client.')
      return
    }

    if (elapsedSeconds <= 0) {
      setTimerError('Timer has no tracked time.')
      return
    }

    clearTimerInterval()

    const { data: activeTimer, error: timerErrorResult } = await supabase
      .from('active_timers')
      .select('*')
      .eq('id', activeTimerId)
      .eq('user_id', user.id)
      .single()

    if (timerErrorResult || !activeTimer) {
      setTimerError(timerErrorResult?.message || 'Active timer not found.')
      return
    }

    const finalSeconds = calculateElapsedSecondsFromTimer(activeTimer)
    const now = new Date()
    const hours = Number((finalSeconds / 3600).toFixed(2))

    const { error: insertError } = await supabase.from('time_logs').insert({
      user_id: user.id,
      organization_id: activeTimer.organization_id || null,
      client_id: activeTimer.client_id,
      project_id: activeTimer.project_id || null,
      start_time: new Date(activeTimer.started_at).toISOString(),
      end_time: now.toISOString(),
      duration: finalSeconds,
      description: activeTimer.description || 'Timed work session',
      hourly_rate: Number(activeTimer.hourly_rate || 0),
      billable: true,
      invoiced: false,
    })

    if (insertError) {
      setTimerError(insertError.message)

      if (activeTimer.status === 'running') {
        startLocalInterval()
      }

      return
    }

    const { error: deleteError } = await supabase
      .from('active_timers')
      .delete()
      .eq('id', activeTimerId)
      .eq('user_id', user.id)

    if (deleteError) {
      setTimerError(deleteError.message)
      return
    }

    setActiveTimerId(null)
    setTimerStatus('idle')
    setElapsedSeconds(0)
    setTimerStartDate(null)
    setTimerForm((prev) => ({
      ...prev,
      description: '',
    }))

    setTimerSuccess('Time entry saved successfully.')

    await loadDashboardData(user.id)
  }

  const cancelTimer = async () => {
    setTimerError('')
    setTimerSuccess('')

    clearTimerInterval()

    if (activeTimerId) {
      const { error } = await supabase
        .from('active_timers')
        .delete()
        .eq('id', activeTimerId)

      if (error) {
        setTimerError(error.message)
        return
      }
    }

    setActiveTimerId(null)
    setTimerStatus('idle')
    setElapsedSeconds(0)
    setTimerStartDate(null)

    setTimerSuccess('Timer cancelled.')
  }

  const getStartOfWeek = (date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)

    return new Date(d.setDate(diff))
  }

  const getEndOfWeek = (date) => {
    const start = getStartOfWeek(date)
    const end = new Date(start)

    end.setDate(start.getDate() + 6)

    return end
  }

  const formatDate = (date) => {
    return date.toISOString().split('T')[0]
  }

  const formatTimeOnly = (date) => {
    return date.toTimeString().split(' ')[0]
  }

  const formatTimer = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return [hrs, mins, secs]
      .map((value) => String(value).padStart(2, '0'))
      .join(':')
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount || 0)
  }

  const handleClientFormChange = (e) => {
    const { name, value } = e.target

    setClientForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const resetClientForm = () => {
    setClientForm({
      name: '',
      email: '',
      hourly_rate: '',
    })
  }

  const closeClientDialog = () => {
    resetClientForm()
    setShowClientDialog(false)
  }

  const addClient = async (e) => {
    e.preventDefault()

    if (!user) {
      showToast('User session not found.', 'error')
      return
    }

    if (!clientForm.name.trim()) {
      showToast('Client name is required.', 'error')
      return
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        user_id: user.id,
        organization_id: null,
        name: clientForm.name.trim(),
        email: clientForm.email || null,
        hourly_rate: Number(clientForm.hourly_rate || 0),
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      showToast(error.message, 'error')
      return
    }

    setClients((prev) => [data, ...prev])

    setTimerForm((prev) => ({
      ...prev,
      client_id: prev.client_id || data.id,
    }))

    resetClientForm()
    setShowClientDialog(false)

    showToast('Client added successfully.', 'success')

    await loadDashboardData(user.id)
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-slate-500">
          Loading dashboard...
        </div>
      </main>
    )
  }



  return (
    <main className="max-w-7xl mx-auto px-4 py-8">

      <AddClientDialog
        open={showClientDialog}
        onClose={() => setShowClientDialog(false)}
        onClientAdded={(newClient) => {
          setClients((prev) => [newClient, ...prev]);

          setTimerForm((prev) => ({
            ...prev,
            client_id: prev.client_id || newClient.id,
          }));

          loadDashboardData(user.id);
        }}
      />

      <AddTimeDialog
  open={showTimeDialog}
  onClose={() => setShowTimeDialog(false)}
  clients={clients}
  onTimeAdded={() => {
    if (user) {
      loadDashboardData(user.id)
    }
  }}
/>


      <div className="mb-5 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div>
          <div className="mb-5 flex flex-col sm:flex-row gap-3 text-right">
            <button
  type="button"
  onClick={() => setShowTimeDialog(true)}
  className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
>
  Add Manual Time Entry
</button>

            <button
              type="button"
              onClick={() => setShowClientDialog(true)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Add Client
            </button>



          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Time Tracker
                </h3>

                <p className="text-sm text-slate-500">
                  Start, pause, and save a time entry automatically.
                </p>

                {timerStartDate && (
                  <p className="mt-1 text-xs text-slate-400">
                    Started: {timerStartDate.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="text-3xl font-bold tracking-tight text-slate-900">
                {formatTimer(elapsedSeconds)}
              </div>
            </div>

            {timerError && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {timerError}
              </div>
            )}

            {timerSuccess && (
              <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                {timerSuccess}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Client
                </label>

                <select
                  name="client_id"
                  value={timerForm.client_id}
                  onChange={handleTimerFormChange}
                  disabled={timerStatus !== 'idle'}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  {clients.length === 0 ? (
                    <option value="">No active clients</option>
                  ) : (
                    clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>

                <input
                  type="text"
                  name="description"
                  value={timerForm.description}
                  onChange={handleTimerFormChange}
                  disabled={timerStatus !== 'idle'}
                  placeholder="Email management, admin task..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              {timerStatus === 'idle' && (
                <button
                  onClick={startTimer}
                  disabled={clients.length === 0}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Start
                </button>
              )}

              {timerStatus === 'running' && (
                <button
                  onClick={pauseTimer}
                  className="flex-1 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-white hover:bg-yellow-600"
                >
                  Pause
                </button>
              )}

              {timerStatus === 'paused' && (
                <button
                  onClick={resumeTimer}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Resume
                </button>
              )}

              {timerStatus !== 'idle' && (
                <>
                  <button
                    onClick={stopAndSaveTimer}
                    className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    Stop & Save
                  </button>

                  <button
                    onClick={cancelTimer}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-8">
          <StatCard
            title="Hours this week"
            value={stats.totalHours.toFixed(2)}
            description="Tracked hours"
          />

          <StatCard
            title="Billable amount"
            value={formatCurrency(stats.billableAmount)}
            description="This week"
          />

          <StatCard
            title="Unpaid invoices"
            value={stats.unpaidInvoices}
            description="Waiting for payment"
          />

          <StatCard
            title="Active clients"
            value={stats.activeClients}
            description="Current clients"
          />
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Recent time entries
              </h3>

              <p className="text-sm text-slate-500">
                Your latest work logs for this week.
              </p>
            </div>

            <button
  type="button"
  onClick={() => setShowTimeDialog(true)}
  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
>
  Add time
</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Date</th>
                  <th className="text-left px-6 py-3 font-medium">
                    Description
                  </th>
                  <th className="text-left px-6 py-3 font-medium">Hours</th>
                  <th className="text-left px-6 py-3 font-medium">Amount</th>
                </tr>
              </thead>

              <tbody>
                {recentEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No time entries yet.
                    </td>
                  </tr>
                ) : (
                  recentEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-100">
                      <td className="px-6 py-4 text-slate-700">
                        {new Date(entry.start_time).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {entry.description || 'No description'}
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {(Number(entry.duration || 0) / 3600).toFixed(2)}
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {formatCurrency(
                          (Number(entry.duration || 0) / 3600) *
                          Number(entry.hourly_rate || 0)
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Quick actions
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Common tasks for your VA billing workflow.
          </p>

          <div className="mt-5 space-y-3">
            <Link
              href="/va/clients"
              className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View clients
            </Link>

            <Link
              href="/va/clients/new"
              className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Add new client
            </Link>

            <Link
              href="/va/time"
              className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View time entries
            </Link>

            <Link
              href="/va/time/new"
              className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Add manual time entry
            </Link>

            <Link
              href="/va/invoices"
              className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Generate / view invoices
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

function StatCard({ title, value, description }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <h3 className="mt-3 text-3xl font-bold text-slate-900">
        {value}
      </h3>

      <p className="mt-2 text-sm text-slate-400">
        {description}
      </p>
    </div>
  )
}