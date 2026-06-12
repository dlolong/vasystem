'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePathname, useRouter } from 'next/navigation'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  const [user, setUser] = useState(null)
  const [resorts, setResorts] = useState([])
  const [getResortsProgress, setGetResortsProgress] = useState(false)
  const [selectedResort, setSelectedResortState] = useState(null)

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [confirmedBookings, setConfirmedBookings] = useState([])
  const [pendingBookings, setPendingBookings] = useState([])
  const [completedBookings, setCompletedBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(false)

  const [toast, setToast] = useState(null)
  const [profile, setProfile] = useState(null)

  const publicRoutes = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ]
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  )

  const showToast = ({ type = 'success', message }) => {
    setToast({ type, message })

    setTimeout(() => {
      setToast(null)
    }, 3000)
  }

  const hideToast = () => setToast(null)

  const logout = async () => {
    await supabase.auth.signOut()

    setUser(null)
    setResorts([])
    setSelectedResortState(null)
    setConfirmedBookings([])
    setPendingBookings([])
    setCompletedBookings([])

    localStorage.removeItem('selected_resort_id')

    router.replace('/') // or /login
  }

  const setSelectedResort = async (resort) => {
    setSelectedResortState(resort)

    if (resort?.id) {
      localStorage.setItem('selected_resort_id', resort.id)
      await refreshBookings(resort.id)
    } else {
      localStorage.removeItem('selected_resort_id')
      setCompletedBookings([])
      setConfirmedBookings([])
      setPendingBookings([])
    }
  }

  const refreshBookings = async (resortId = selectedResort?.id) => {
    if (!resortId) {
      setCompletedBookings([])
      setConfirmedBookings([])
      setPendingBookings([])
      return
    }

    setBookingsLoading(true)

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('resort_id', resortId)
      .in('status', ['confirmed', 'pending'])
      // .gte('end_datetime', now)
      .order('start_datetime', { ascending: true })

    if (error) {
      console.error(error)
      setBookingsLoading(false)
      return
    }

    const bookings = data || []

    const now = new Date()

    setCompletedBookings(
      bookings.filter((b) => b.status === 'confirmed' && new Date(b.end_datetime) < now)
    )

    setConfirmedBookings(
      bookings.filter((b) => b.status === 'confirmed' && new Date(b.end_datetime) >= now)
    )

    setPendingBookings(
      bookings.filter((b) => b.status === 'pending' && new Date(b.end_datetime) >= now)
    )
    setBookingsLoading(false)
  }

  const loadAppData = async (currentUser, silent = false) => {
    if (!silent) setInitialLoading(true)
    if (silent) setRefreshing(true)

    const publicOnlyRoutes = [
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
    ]

    setUser(currentUser)

    if (!currentUser) {
      setResorts([])
      setSelectedResortState(null)
      localStorage.removeItem('selected_resort_id')
      setInitialLoading(false)
      setRefreshing(false)
      return
    }

    const isPublicOnlyRoute = publicOnlyRoutes.some((route) =>
      pathname.startsWith(route)
    )

    if (pathname === '/' || isPublicOnlyRoute) {
      router.replace('/dashboard')
    }
    setGetResortsProgress(true)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle()

    setProfile(profileData || null)

    const { data: resortsData, error } = await supabase
      .from('resorts')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at')

    setGetResortsProgress(false)
    if (!error) {

      const resortsList = resortsData || []
      const storedId = localStorage.getItem('selected_resort_id')

      setResorts(resortsList)

      const selected =
        resortsList.find((r) => r.id === storedId) ||
        resortsList[0] ||
        null

      setSelectedResortState(selected)

      if (
        currentUser &&
        resortsList.length === 0 &&
        pathname !== '/onboarding' &&
        !pathname.startsWith('/admin')
      ) {
        router.replace('/onboarding')
      }

      if (
        resortsList.length > 0 &&
        (pathname === '/onboarding' || pathname === '/login')
      ) {
        router.replace('/dashboard')
      }

      if (!currentUser && pathname === '/onboarding') {
        router.replace('/')
      }

      if (selected?.id) {
        await refreshBookings(selected.id)
      }
    }

    setInitialLoading(false)
    setRefreshing(false)
  }

  // useEffect(() => {
  //   supabase.auth.getSession().then(({ data }) => {
  //     loadAppData(data.session?.user || null)
  //   })

  //   const {
  //     data: { subscription },
  //   } = supabase.auth.onAuthStateChange((event, session) => {
  //     if (event === 'SIGNED_OUT' || !session) {
  //       loadAppData(null, true)
  //       setUser(null)
  //       setResorts([])
  //       setSelectedResortState(null)

  //       if (!isPublicRoute) {
  //         router.replace('/')
  //       }
  //       return
  //     }

  //     // silent refresh = no full-page loader
  //     loadAppData(session.user, true)
  //   })

  //   return () => subscription.unsubscribe()
  // }, [])

  // useEffect(() => {
  //   let isMounted = true

  //   const clearAuthData = () => {
  //     if (!isMounted) return

  //     loadAppData(null, true)
  //     setUser(null)
  //     setResorts([])
  //     setSelectedResortState(null)

  //     if (!isPublicRoute) {
  //       router.replace('/')
  //     }
  //   }

  //   const initSession = async () => {
  //     const { data, error } = await supabase.auth.getSession()

  //     if (
  //       error ||
  //       !data.session ||
  //       error?.message?.includes('Invalid Refresh Token') ||
  //       error?.message?.includes('Refresh Token Not Found')
  //     ) {
  //       await supabase.auth.signOut()
  //       clearAuthData()
  //       return
  //     }

  //     loadAppData(data.session.user || null)
  //   }

  //   initSession()

  //   const {
  //     data: { subscription },
  //   } = supabase.auth.onAuthStateChange(async (event, session) => {
  //     if (event === 'SIGNED_OUT' || !session) {
  //       clearAuthData()
  //       return
  //     }

  //     loadAppData(session.user, true)
  //   })

  //   return () => {
  //     isMounted = false
  //     subscription.unsubscribe()
  //   }
  // }, [isPublicRoute, router])

  return (
    <AppContext.Provider
      value={{
        // user,
        // profile,
        // setProfile,
        // getResortsProgress,
        // resorts,
        // selectedResort,
        // setSelectedResort,

        // completedBookings,
        // confirmedBookings,
        // pendingBookings,
        // bookingsLoading,
        // refreshBookings,

        // initialLoading,
        // refreshing,
        // refreshAppData: () => loadAppData(user, true),
        // logout,

        // toast,
        // showToast,
        // hideToast,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}