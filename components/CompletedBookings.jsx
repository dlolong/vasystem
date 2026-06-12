'use client'

import { useMemo, useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { formatAmount } from '@/utils/amount'
import { useApp } from '@/context/AppContext'

function toInputDate(date) {
  return format(date, 'yyyy-MM-dd')
}


export default function CompletedBookings({
  title = 'Completed Bookings',
}) {
  const { completedBookings } = useApp()
    const [fromDate, setFromDate] = useState(
    toInputDate(startOfMonth(new Date()))
  )

  const [toDate, setToDate] = useState(
    toInputDate(endOfMonth(new Date()))
  )

  const filteredBookings = useMemo(() => {
    if (!fromDate || !toDate) return completedBookings

    const from = new Date(`${fromDate}T00:00:00`)
    const to = new Date(`${toDate}T23:59:59`)

    return completedBookings.filter((booking) => {
      const completedDate = new Date(booking.end_datetime)
      return completedDate >= from && completedDate <= to
    })
  }, [completedBookings, fromDate, toDate])

  const totalAmount = useMemo(() => {
    return filteredBookings.reduce(
      (sum, booking) => sum + Number(booking.agreed_amount || 0),
      0
    )
  }, [filteredBookings])

  return (
    <div className="flex items-center justify-center">
      <div className='
      bg-white w-full max-w-md rounded-2xl shadow p-6 
      grid grid-flow-row gap-2
      '>
       
       <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-gray-500">
            Completed revenue summary
          </p>
        </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>


        <div className="bg-green-50 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-500">
            Total Agreed Amount
          </p>

          <h3 className="text-2xl font-bold text-green-700">
            {formatAmount(totalAmount)}
          </h3>
        </div>

        {filteredBookings.length === 0 ? (
          <p className="text-sm text-gray-500">
            No completed bookings for this period.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="border rounded-xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{booking.name}</h3>

                    <p className="text-sm text-gray-600">
                      {format(
                        new Date(booking.start_datetime),
                        'MMM d, yyyy h:mm a'
                      )}
                      {' '}→{' '}
                      {format(
                        new Date(booking.end_datetime),
                        'MMM d, yyyy h:mm a'
                      )}
                    </p>

                    <p className="text-sm text-gray-600">
                      {booking.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {booking.contact}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-green-700">
                      {formatAmount(booking.agreed_amount)}
                    </p>

                    {/* <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                    completed
                  </span> */}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}