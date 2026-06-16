'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAppContext } from '@/context/AppContext'

export default function ConfirmEmailPage() {
  const router = useRouter()
  const { showToast, refreshAppData } = useAppContext()

  const [status, setStatus] = useState('verifying')
  const [email, setEmail] = useState('')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const confirmEmail = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error || !data.session) {
        setStatus('error')
        return
      }

      const user = data.session.user

      const { data: resorts } = await supabase
        .from('resorts')
        .select('id')
        .eq('user_id', user.id)

      await refreshAppData?.()

      setStatus('success')

      showToast?.({
        type: 'success',
        message: 'Email confirmed successfully!',
      })

      setTimeout(() => {
        if (!resorts || resorts.length === 0) {
          router.replace('/onboarding')
        } else {
          router.replace('/dashboard')
        }
      }, 1200)
    }

    confirmEmail()
  }, [])

  const resendConfirmation = async () => {
    if (!email) {
      showToast?.({
        type: 'error',
        message: 'Please enter your email.',
      })
      return
    }

    setResending(true)

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })

    setResending(false)

    if (error) {
      showToast?.({
        type: 'error',
        message: error.message,
      })
      return
    }

    showToast?.({
      type: 'success',
      message: 'Confirmation email resent. Please check your inbox.',
    })
  }

  return (
    <div className="flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow text-center w-full max-w-md">
        {status === 'verifying' && (
          <>
            <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-green-600 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-semibold">
              Verifying your email...
            </h2>
          </>
        )}

        {status === 'success' && (
          <>
            <h2 className="text-xl font-bold text-green-600 mb-2">
              Email Confirmed 🎉
            </h2>
            <p className="text-gray-600">
              Redirecting...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 className="text-xl font-bold text-red-600 mb-2">
              Verification Failed
            </h2>

            <p className="text-gray-600 mb-5">
              The confirmation link may be expired or invalid.
              Enter your email below to resend the confirmation link.
            </p>

            <input
              type="email"
              placeholder="Email address"
              className="w-full border p-3 rounded mb-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
              onClick={resendConfirmation}
              disabled={resending}
              className="cursor-pointer w-full bg-green-600 text-white p-3 rounded disabled:bg-gray-400 mb-3"
            >
              {resending ? 'Sending...' : 'Resend Confirmation Email'}
            </button>

            <button
              onClick={() => router.push('/login')}
              className="cursor-pointer  w-full border p-3 rounded"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  )
}