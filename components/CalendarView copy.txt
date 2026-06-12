'use client'

import { useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { format, isBefore, isSameDay } from 'date-fns'
import { CircleMinus, Flag, MapPin, NotepadText, Phone, User, Users } from 'lucide-react'
import { formatAmount } from '@/utils/amount'


const bookingColors = [
  '#20c657', // pastel green
  '#f9bb00', // pastel orange
  '#5b95db', // pastel blue
  '#d148d8', // pastel purple
  '#32a88f', // pastel red
  '#65a71e', // pastel teal
  '#3baaae', // pastel yellow
  '#59b10c', // pastel green
  '#c0b300', // pastel orange
  '#a960ed', // pastel blue
  '#ec56d3', // pastel purple
  '#d49d1e', // pastel red
  '#22ae92', // pastel teal
  '#a8b314', // pastel yellow
]

function getBookingColor(booking, bookings) {
  const index = bookings.findIndex((b) => b.id === booking.id)
  return bookingColors[index % bookingColors.length]
}


function formatDateTime(datetime) {
  if (!datetime) return ''
  return format(new Date(datetime), 'MMMM dd yy hh:mm a')
}

function getBookingsForDay(day, bookings) {
  return bookings.filter((booking) => {
    const start = new Date(booking.start_datetime)
    const end = new Date(booking.end_datetime)

    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)

    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)

    return start <= dayEnd && end >= dayStart
  })
}

function getSlotForDay(day, booking) {
  const start = new Date(booking.start_datetime)
  const end = new Date(booking.end_datetime)

  const isStartDay = isSameDay(day, start)
  const isEndDay = isSameDay(day, end)

  const startHour = start.getHours()
  const endHour = end.getHours()

  // Overnight booking:
  // May 17 7PM → May 18 6AM
  if (isStartDay && startHour >= 6) return 'pm'
  if (isEndDay && endHour <= 18) return 'am'

  // Same-day booking
  if (isStartDay && isEndDay) {
    if (startHour < 18 && endHour <= 6) return 'am'
    if (startHour >= 6 && endHour > 18) return 'pm'
  }

  return 'full'
}

export default function CalendarView({ bookings = [], onAddBooking, onCancelBooking }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedBookings, setSelectedBookings] = useState([])
  const [openModal, setOpenModal] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const handleDayClick = (day) => {
    setSelectedDate(day)

    const bookingsForDay = bookings.filter((booking) => {
      const start = new Date(booking.start_datetime)
      const end = new Date(booking.end_datetime)

      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)

      return day >= start && day <= end
    })

    if (bookingsForDay.length > 0) {
      setSelectedBookings(bookingsForDay)
      setOpenModal(true)
    } else {
      onAddBooking(day) 
    }
  }

  const closeModal = () => {
    setOpenModal(false)
    setSelectedBookings([])
  }

  const handleAddBooking = () => {
    setOpenModal(false)
    onAddBooking(selectedDate)
  }

  return (
    <div className='[text-align:-webkit-center]'>
      <DayPicker
        weekStartsOn={1}
        mode="single"
        selected={selectedDate}
        onDayClick={handleDayClick}
        disabled={{ before: today }}
        components={{
          DayButton: (props) => {
            const day = props.day.date
            const isToday = new Date().toDateString() === day.toDateString()
            const isDone =  new Date().toDateString() >= day.toDateString()

            const dayBookings = getBookingsForDay(day, bookings)

            const amBooking = dayBookings.find((b) => getSlotForDay(day, b) === 'am')
            const pmBooking = dayBookings.find((b) => getSlotForDay(day, b) === 'pm')
            const fullBooking = dayBookings.find((b) => getSlotForDay(day, b) === 'full')

            return (
              <button
                {...props}
                type="button"
                className={
                  `relative w-10 h-10 md:w-14 md:h-14 rounded-full overflow-hidden flex items-center justify-center transition
        ${isToday ? 'ring-2 ring-blue-500 font-bold' : 'border-gray-200'}
        hover:scale-105 disabled:opacity-90 hover:enabled:bg-gray-200 enabled:cursor-pointer cursor-default`}
              >
                {/* Full day */}
                {fullBooking && (
                  <span
                    className="absolute inset-0 shadow-inner"
                    style={{
                      backgroundColor: getBookingColor(fullBooking, bookings),
                    }}
                  />
                )}

                {/* AM */}
                {amBooking && (
                  <span
                    className="absolute top-0 left-0 w-full h-1/2"
                    style={{
                      backgroundColor: getBookingColor(amBooking, bookings),
                    }}
                  />
                )}

                {/* PM */}
                {pmBooking && (
                  <span
                    className="absolute bottom-0 left-0 w-full h-1/2"
                    style={{
                      backgroundColor: getBookingColor(pmBooking, bookings),
                    }}
                  />
                )}

                {/* Today highlight overlay (subtle) */}
                {isToday && (
                  <span className="absolute inset-0 bg-white/40 rounded-full" />
                )}

                {/* Day number */}
                <span className="relative z-10 text-sm font-semibold text-gray-800">
                  {format(day, 'd')}
                </span>
              </button>
            )
          },
        }}
      />

      {openModal && (
        <div className="fixed inset-0 bg-black/40 flex justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6">
            <div className="flex justify-between mb-4">
              <h3 className="text-lg font-bold">
                Bookings for{' '}
                {selectedDate
                  ? format(selectedDate, 'EEE, MMMM d,yyyy')
                  : ''}
              </h3>

              <button
                onClick={closeModal}
                className="cursor-pointer text-gray-500 hover:text-black text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {selectedBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="border-1 border-[#b7ddbb] rounded-xl p-4"
                >
                  <div className="items-center justify-between">
                    <h6 className='flex items-center text-sm'>
                      <MapPin width={16} className='text-gray-700 mr-2' /> {`${format(new Date(booking.start_datetime), 'EEE, MMMM d, yyyy hh:mm a')}`}
                    </h6>
                    <h6 className='flex items-center text-sm'>
                      <Flag width={16} className='text-gray-700 mr-2' /> {`${format(new Date(booking.end_datetime), 'EEE, MMMM d, yyyy hh:mm a')}`}
                    </h6>
                  </div>

                  <div className=''>
                    <div className="mt-3 space-y-0 text-sm text-black-600">
                      <p className='flex items-center text-sm font-bold'>
                        <span className='mr-2'>✅</span> Amount: {formatAmount(booking.agreed_amount)}
                      </p>
                        <p className='flex items-center text-gray-500'>
                          <CircleMinus width={16} className='text-gray-700 mr-2' />Downpayment: {formatAmount(booking.downpayment)}
                        </p>
                          <p className='flex items-center'>
                          <CircleMinus width={16} className='text-gray-700 mr-2 font-bold' />Balance: {formatAmount(booking.agreed_amount - booking.downpayment)}
                        </p>
                      <p className='flex items-center mt-4'>
                        <Users width={16} className='text-gray-700 mr-2' /> {booking.guests} pax
                      </p>
                     
                      <p className='flex items-center'>
                        <User width={16} className='text-gray-700 mr-2' /> {booking.name}
                      </p>
                      <p className='flex items-center'>
                        <Phone width={16} className='text-gray-700 mr-2' /> {booking.contact}
                      </p>

                      {booking.notes && (
                        <p className='flex items-center'>
                          <NotepadText width={16} className='text-gray-700 mr-2' /> {booking.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => {
                        onCancelBooking(booking)
                      }}
                      className="cursor-pointer mt-4 p-2 border-1 border-red-100 text-red-300 py-2 rounded"
                    >
                      Cancel Booking
                    </button>
                  </div>
                </div>
              ))}
            </div>

             <button
              onClick={handleAddBooking}
              className="mt-4 bg-blue-600 text-white px-3 py-2 md:px-4 rounded text-sm md:text-base cursor-pointer"
            >
              + Add New Booking
            </button>
          </div>
        </div>
      )}
    </div>
  )
}