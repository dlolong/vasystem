'use client'

import { useApp } from '@/context/AppContext'
import { Check, CircleAlert, Info, TriangleAlert } from 'lucide-react'

export default function Toast() {
  const { toast, hideToast } = useApp()

  if (!toast) return null

  const styles = {
    success: 'bg-[#29b55a]',
    error: 'bg-red-600',
    warning: 'bg-yellow-500',
    info: 'bg-blue-600',
  }

  const icons = {
    success: <Check />,
    error:  <CircleAlert/>,
    warning: <TriangleAlert/>,
    info: <Info />,
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-5 sm:top-6 left-1/2 -translate-x-1/2 z-[9999]"
    >
      <div
        className={`${styles[toast.type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-sm`}
      >
        <div className="text-white">{icons[toast.type]}</div>
        <p className="text-sm">{toast.message}</p>
        <button
          onClick={hideToast}
          aria-label="Close notification"
          className="text-white/80 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  )
}