'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useApp } from '@/context/AppContext'
import Loader from '@/components/Loader'

export default function AdminPage() {
    const { profile, showToast } = useApp()

    const [activeTab, setActiveTab] = useState('leads')
    const [leads, setLeads] = useState([])
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)

    const [showAddUserModal, setShowAddUserModal] = useState(false)
    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        role: 'user',
        plan: 'free',
    })
    const [creatingUser, setCreatingUser] = useState(false)


    useEffect(() => {
        if (!profile) return

        if (profile.role !== 'admin') {
            setLoading(false)
            return
        }

        loadAdminData()
    }, [profile])


    const loadAdminData = async () => {
        setLoading(true)

        const { data: leadsData, error: leadsError } = await supabase
            .from('leads')
            .select('*')
            .neq("status", "approved")
            .order('created_at', { ascending: false })

        const { data: usersData, error: usersError } = await supabase
            .from('profiles')
            .select('*')
            .neq('role', 'admin')
            .order('created_at', { ascending: false })

        if (leadsError || usersError) {
            showToast({
                type: 'error',
                message: 'Failed to load admin data.',
            })
        }

        setLeads(leadsData || [])
        setUsers(usersData || [])
        setLoading(false)
    }

    const updateLeadStatus = async (leadId, status) => {
        const { error } = await supabase
            .from('leads')
            .update({ status })
            .eq('id', leadId)

        if (error) {
            showToast({ type: 'error', message: 'Failed to update lead.' })
            return
        }

        showToast({ type: 'success', message: 'Lead updated.' })
        loadAdminData()
    }

    const approveLead = async (leadId) => {
        const confirmed = window.confirm(
            'Approve this lead and create a user account?'
        )

        if (!confirmed) return

        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session?.access_token) {
            showToast({
                type: 'error',
                message: 'Your session expired. Please login again.',
            })
            return
        }

        const res = await fetch('/api/admin/approve-lead', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ leadId }),
        })

        const result = await res.json()

        if (!res.ok) {
            showToast({
                type: 'error',
                message: result.error || 'Failed to approve lead.',
            })
            return
        }

        showToast({
            type: 'success',
            message: 'Lead approved and user created.',
        })

        loadAdminData()
    }

    const updateSubscription = async (userId, plan, subscription_status) => {
        const { error } = await supabase
            .from('profiles')
            .update({
                plan,
                subscription_status,
            })
            .eq('id', userId)

        if (error) {
            showToast({
                type: 'error',
                message: 'Failed to update subscription.',
            })
            return
        }

        showToast({
            type: 'success',
            message: 'Subscription updated.',
        })

        loadAdminData()
    }

    const createUser = async (e) => {
        e.preventDefault()
        setCreatingUser(true)

        const {
            data: { session },
            error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session?.access_token) {
            setCreatingUser(false)

            showToast({
                type: 'error',
                message: 'Your session expired. Please login again.',
            })

            return
        }

        const res = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(newUser),
        })

        const result = await res.json()
        setCreatingUser(false)

        if (!res.ok) {
            showToast({
                type: 'error',
                message: result.error || 'Failed to create user.',
            })
            return
        }

        showToast({
            type: 'success',
            message: 'User created successfully.',
        })

        setNewUser({
            email: '',
            password: '',
            role: 'user',
            plan: 'free',
        })

        setShowAddUserModal(false)
        loadAdminData()
    }

    const deleteUser = async (userId) => {
        const confirmed = window.confirm(
            'Are you sure you want to delete this user? This action cannot be undone.'
        )

        if (!confirmed) return

        const {
            data: { session },
        } = await supabase.auth.getSession()

        if (!session?.access_token) {
            showToast({
                type: 'error',
                message: 'Your session expired. Please login again.',
            })
            return
        }

        const res = await fetch('/api/admin/delete-user', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ userId }),
        })

        const result = await res.json()

        if (!res.ok) {
            showToast({
                type: 'error',
                message: result.error || 'Failed to delete user.',
            })
            return
        }

        showToast({
            type: 'success',
            message: 'User deleted successfully.',
        })

        loadAdminData()
    }

    if (profile?.role !== 'admin') {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold text-red-600">
                    Access denied
                </h1>
                <p className="text-gray-500">
                    Admin access only.
                </p>
            </div>
        )
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Admin</h1>
                    <p className="text-sm text-gray-500">
                        Manage leads and user subscriptions
                    </p>
                </div>

                {(loading) ? <Loader className='pt-16 mt-16' />
                    :
                    <button
                        onClick={loadAdminData}
                        className="border px-4 py-2 rounded"
                    >
                        Refresh
                    </button>}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b mb-6">
                <button
                    onClick={() => setActiveTab('leads')}
                    className={`px-4 py-2 ${activeTab === 'leads'
                        ? 'border-b-2 border-green-600 text-green-600 font-semibold'
                        : 'text-gray-500'
                        }`}
                >
                    Leads
                </button>

                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 ${activeTab === 'users'
                        ? 'border-b-2 border-green-600 text-green-600 font-semibold'
                        : 'text-gray-500'
                        }`}
                >
                    Existing Users
                </button>
            </div>

            {activeTab === 'leads' && (
                <div className="grid gap-4">
                    {leads.length === 0 ? (
                        <p className="text-gray-500">No leads yet.</p>
                    ) : (
                        leads.map((lead) => (
                            <div
                                key={lead.id}
                                className="bg-white border rounded-2xl shadow-sm p-5"
                            >
                                <div className="flex justify-between gap-4">
                                    <div>
                                        <h2 className="font-bold">
                                            {lead.resort_name || 'Unnamed Resort'}
                                        </h2>
                                        <p className="text-sm text-gray-600">{lead.name}</p>
                                        <p className="text-sm text-gray-600">{lead.email}</p>
                                        <p className="text-sm text-gray-600">{lead.mobile}</p>
                                    </div>

                                    <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full h-fit">
                                        {lead.status}
                                    </span>
                                </div>

                                {lead.message && (
                                    <p className="bg-gray-50 rounded-xl p-3 text-sm mt-4">
                                        {lead.message}
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-2 mt-4">
                                    {/* <button
                                        onClick={() => updateLeadStatus(lead.id, 'contacted')}
                                        className="bg-blue-600 text-white px-3 py-2 rounded text-sm"
                                    >
                                        Contacted
                                    </button> */}

                                    <button
                                        onClick={() => approveLead(lead.id)}
                                        className="bg-green-600 text-white px-3 py-2 rounded text-sm"
                                    >
                                        Approve & Create User
                                    </button>

                                    <button
                                        onClick={() => updateLeadStatus(lead.id, 'rejected')}
                                        className="bg-red-600 text-white px-3 py-2 rounded text-sm"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'users' && (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Existing Users</h2>

                        <button
                            onClick={() => setShowAddUserModal(true)}
                            className="bg-green-600 text-white px-4 py-2 rounded"
                        >
                            + Add User
                        </button>
                    </div>
                    <div className="grid gap-4">
                        {users.length === 0 ? (
                            <p className="text-gray-500">No users yet.</p>
                        ) : (
                            users.map((user) => (
                                <div
                                    key={user.id}
                                    className="bg-white border rounded-2xl shadow-sm p-5"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div>
                                            <h2 className="font-bold">
                                                {user.email || user.id}
                                            </h2>

                                            <p className="text-sm text-gray-500">
                                                Role: {user.role}
                                            </p>

                                            <p className="text-sm text-gray-500">
                                                Plan: {user.plan || 'free'}
                                            </p>

                                            <p className="text-sm text-gray-500">
                                                Status: {user.subscription_status || 'inactive'}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() =>
                                                    updateSubscription(user.id, 'free', 'inactive')
                                                }
                                                className="border px-3 py-2 rounded text-sm"
                                            >
                                                Set Free
                                            </button>

                                            <button
                                                onClick={() =>
                                                    updateSubscription(user.id, 'pro', 'active')
                                                }
                                                className="bg-green-600 text-white px-3 py-2 rounded text-sm"
                                            >
                                                Upgrade Pro
                                            </button>

                                            <button
                                                onClick={() =>
                                                    updateSubscription(user.id, user.plan, 'cancelled')
                                                }
                                                className="bg-red-600 text-white px-3 py-2 rounded text-sm"
                                            >
                                                {user.subscription_status === "cancelled" ? "Approve" : "Cancel"} Subscription
                                            </button>
                                            <button
                                                onClick={() => deleteUser(user.id)}
                                                className="bg-red-600 text-white px-3 py-2 rounded text-sm"
                                            >
                                                Delete User
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>

            )}

            {showAddUserModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Add User</h2>

                            <button
                                onClick={() => setShowAddUserModal(false)}
                                className="text-gray-500 hover:text-black text-xl"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={createUser} className="space-y-3">
                            <input
                                type="email"
                                value={newUser.email}
                                onChange={(e) =>
                                    setNewUser((prev) => ({
                                        ...prev,
                                        email: e.target.value,
                                    }))
                                }
                                placeholder="Email"
                                className="w-full border p-3 rounded"
                                required
                            />

                            <input
                                type="password"
                                value={newUser.password}
                                onChange={(e) =>
                                    setNewUser((prev) => ({
                                        ...prev,
                                        password: e.target.value,
                                    }))
                                }
                                placeholder="Temporary password"
                                className="w-full border p-3 rounded"
                                required
                            />

                            <select
                                value={newUser.role}
                                onChange={(e) =>
                                    setNewUser((prev) => ({
                                        ...prev,
                                        role: e.target.value,
                                    }))
                                }
                                className="w-full border p-3 rounded"
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>

                            <select
                                value={newUser.plan}
                                onChange={(e) =>
                                    setNewUser((prev) => ({
                                        ...prev,
                                        plan: e.target.value,
                                    }))
                                }
                                className="w-full border p-3 rounded"
                            >
                                <option value="free">Free</option>
                                <option value="pro">Pro - 30 days</option>
                            </select>

                            <div className="flex gap-2 justify-end pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddUserModal(false)}
                                    disabled={creatingUser}
                                    className="px-4 py-2 rounded border"
                                >
                                    Cancel
                                </button>

                                <button
                                    disabled={creatingUser}
                                    className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
                                >
                                    {creatingUser ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}