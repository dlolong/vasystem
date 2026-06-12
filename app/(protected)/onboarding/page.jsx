'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useApp } from '@/context/AppContext'
import { X } from 'lucide-react'

function createSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function OnboardingPage() {
  const router = useRouter()
  const { refreshAppData } = useApp()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    setLoading(true)
    setErrorMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      // router.push('/login')
      return
    }

    const slug = createSlug(name)

    const { error } = await supabase.from('resorts').insert([
      {
        user_id: user.id,
        name,
        slug,
      },
    ])

    setLoading(false)

    if (error) {
      setErrorMessage(
        error.code === '23505'
          ? 'This resort name/link is already taken.'
          : 'Failed to create resort.'
      )
      return
    }

    await refreshAppData()
    router.push('/dashboard')
  }

  const handleClose = () => {
     router.push('/dashboard')
  }

  return (
    <div className="flex items-center justify-center p-6 bg-gradient-to-b from-blue-50 to-white">
       <div className='bg-white w-full max-w-md rounded-2xl shadow p-6'>
        
         <div className="flex items-center justify-between mb-4">
            <div>
                <h2 className="text-xl font-bold">Add Resort</h2>
            </div>

            <button className='cursor-pointer' onClick={handleClose}>
                <X height={16}/>
            </button>
        </div>

        <p className="text-gray-500 mb-6">
          Create your booking link and dashboard.
        </p>

        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-600">
              Resort Name
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter the resort name"
              className="w-full border p-3 rounded mt-1"
              required
            />
          </div>

          {name && (
            <div className="bg-gray-50 p-3 rounded text-sm">
              Booking link:
              <br />
              <span className="font-semibold">
                /public-booking/{createSlug(name)}
              </span>
            </div>
          )}

          <button
            disabled={loading || !name}
            className="w-full bg-[#29b55a] disabled:bg-gray-400 text-white p-3 rounded cursor-pointer"
          >
            {loading ? 'Creating...' : 'Create Resort'}
          </button>
        </form>
      </div>
    </div>
  )
}