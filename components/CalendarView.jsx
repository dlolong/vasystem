'use client'

import { useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { format, isBefore, isSameDay } from 'date-fns'
import { CircleMinus, Flag, MapPin, NotepadText, Phone, User, Users } from 'lucide-react'
import { formatAmount } from '@/utils/amount'
import { getPHDate, getPHTime } from '@/utils/dateTime'


const bookingColors = [
  '#7cd399', // pastel green
  '#e6ce86', // pastel orange
  '#89add9', // pastel blue
  '#cb8acf', // pastel purple
  '#81c6b7', // pastel red
  '#a4c085', // pastel teal
  '#82bec0', // pastel yellow
  '#99bd7a', // pastel green
  '#e4dd7a', // pastel orange
  '#bb98db', // pastel blue
  '#e193d4', // pastel purple
  '#e9c777', // pastel red
  '#7fb4a9', // pastel teal
  '#b0b380', // pastel yellow
]

function getBookingColor(booking, bookings) {
  const index = bookings.findIndex((b) => b.id === booking.id)
  return bookingColors[index % bookingColors.length]
}

function getDayDate(day) {
  return format(day, 'yyyy-MM-dd')
}


function getBookingSession(day, booking) {
  const dayDate = getDayDate(day)

  const startDate = getPHDate(booking.start_datetime)
  const startTime = getPHTime(booking.start_datetime)

  const endDate = getPHDate(booking.end_datetime)
  const endTime = getPHTime(booking.end_datetime)

  // 7AM start, ends next day = full start date
  if (
    dayDate === startDate &&
    startDate !== endDate &&
    startTime >= '07:00' &&
    startTime < '17:00'
  ) {
    return 'full'
  }

   // Same-day morning = left
  if (
    dayDate === startDate &&
    dayDate === endDate &&
    startTime >= '07:00' &&
    startTime < '17:00' &&
    endTime <= '17:00'
  ) {
    return 'morning'
  }

 // Overnight start = right
  if (
    dayDate === startDate &&
    startTime >= '19:00'
  ) {
    return 'overnight'
  }

    // Booking ends next day and reaches morning session
  if (
    dayDate === endDate &&
    startDate !== endDate &&
    endTime > '06:00'
  ) {
    return 'morning'
  }

  return null
}

function getDaySessions(day, bookings) {
  let morningBooking = null
  let overnightBooking = null

  bookings.forEach((booking) => {
    const session = getBookingSession(day, booking)

    if (session === 'full') {
      morningBooking = booking
      overnightBooking = booking
    }

    if (session === 'morning') {
      morningBooking = booking
    }

    if (session === 'overnight') {
      overnightBooking = booking
    }
  })

  return {
    morningBooking,
    overnightBooking,
    isFull: Boolean(morningBooking && overnightBooking),
  }
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

            const {
              morningBooking,
              overnightBooking,
              isFull,
            } = getDaySessions(day, bookings)

            return (
              <button
                {...props}
                type="button"
                className={`relative mx-[1px] w-10 h-10 md:w-14 md:h-14 rounded-full overflow-hidden flex items-center justify-center
                               transition
                      ${isToday ? 'ring-2 ring-blue-500 font-bold' : 'border-gray-200'}
                      hover:scale-105 disabled:opacity-90 hover:enabled:bg-gray-200 enabled:cursor-pointer cursor-default
                               `}
              >
                {isFull && (
                  <>
                    <span
                      className="absolute left-0 top-0 h-full w-1/2"
                      style={{
                        backgroundColor: getBookingColor(morningBooking, bookings),
                      }}
                    />
                    <span
                      className="absolute right-0 top-0 h-full w-1/2"
                      style={{
                        backgroundColor: getBookingColor(overnightBooking, bookings),
                      }}
                    />
                  </>
                )}

                {!isFull && morningBooking && (
                  <span
                    className="absolute left-0 top-0 h-full w-1/2"
                    style={{
                      backgroundColor: getBookingColor(morningBooking, bookings),
                    }}
                  />
                )}

                {!isFull && overnightBooking && (
                  <span
                    className="absolute right-0 top-0 h-full w-1/2"
                    style={{
                      backgroundColor: getBookingColor(overnightBooking, bookings),
                    }}
                  />
                )}

                {/* {!isFull && (morningBooking || overnightBooking) && (
                  <span className="absolute top-0 bottom-0 left-1/2 w-px bg-white/80" />
                )} */}

                <span className="relative z-10 text-sm font-semibold text-gray-800">
                  {day.getDate()}
                </span>
              </button>
            )
          }
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