'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useApp } from '@/context/AppContext'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import { formatAmountInput, parseAmount, formatAmount } from '@/utils/amount'

function normalizeMobile(value) {
    if (value.startsWith('09')) {
        return '+63' + value.slice(1)
    }
    if (value.startsWith('639')) {
        return '+' + value
    }
    return value
}

function isValidMobileNumber(value) {
    const cleaned = value.replace(/\s+/g, '')

    const regex = /^(09|\+639|639)\d{9}$/
    return regex.test(cleaned)
}

export default function AddBookingModal({
    open,
    onClose,
    onSuccess,
    bookingModalData = null
}) {
    const { selectedResort, refreshBookings, showToast } = useApp()
    const [addBookingProgress, setAddBookingProgress] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const defaultForm = {
        name: '',
        contact: '',
        start_date: '',
        start_time: '07:00',
        end_date: '',
        end_time: '17:00',
        guests: '',
        agreed_amount: '',
        downpayment: '',
        notes: '',
    }

    const [formStartDate, setFormStartDate] = useState(defaultForm.start_date)
    const [formStartTime, setFormStartTime] = useState(defaultForm.start_time)
    const [formEndDate, setFormEndDate] = useState(defaultForm.end_date)
    const [formEndTime, setFormEndTime] = useState(defaultForm.end_time)
    const [formName, setFormName] = useState(defaultForm.name)
    const [formContact, setFormContact] = useState(defaultForm.contact)
    const [formGuests, setFormGuests] = useState(defaultForm.guests)
    const [formAgreedAmount, setFormAgreedAmount] = useState(defaultForm.agreed_amount)
    const [formDownpayment, setFormDownpayment] = useState(defaultForm.downpayment)
    const [formNotes, setFormNotes] = useState(defaultForm.notes)

    const [form, setForm] = useState(defaultForm)

    useEffect(() => {
        if (bookingModalData) {
            setFormStartDate(format(new Date(bookingModalData), 'yyyy-MM-dd'))
        }
    }, [bookingModalData])

    const resetForm = () => {
        setFormStartDate(defaultForm.start_date)
        setFormStartTime(defaultForm.start_time)
        setFormEndDate(defaultForm.end_date)
        setFormEndTime(defaultForm.end_time)
        setFormName(defaultForm.name)
        setFormContact(defaultForm.contact)
        setFormGuests(defaultForm.guests)
        setFormAgreedAmount(defaultForm.agreed_amount)
        setFormDownpayment(defaultForm.downpayment)
        setFormNotes(defaultForm.notes)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!selectedResort) {
            setErrorMessage('Resort not found.')
            return
        }

        setAddBookingProgress(true)
        setErrorMessage('')

        const newStart = new Date(`${formStartDate}T${formStartTime}`)
        const newEnd = new Date(`${formEndDate}T${formEndTime}`)

        if (!isValidMobileNumber(formContact)) {
            showToast({
                type: 'error',
                message:
                    'Please enter a valid mobile number (e.g. 09171234567 or +639171234567)',
            })
            setAddBookingProgress(false)
            return
        }

        if (newEnd <= newStart) {
            showToast({
                type: 'error',
                message:
                    'Check-out must be later than check-in.',
            })
            setAddBookingProgress(false)
            return
        }

        const { data: existingBookings, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('resort_id', selectedResort.id)
            .in('status', ['confirmed'])

        if (bookingError) {
            console.error(bookingError)
            showToast({
                type: 'error',
                message:
                    'Failed to check existing bookings.',
            })
            setAddBookingProgress(false)
            return
        }

        const hasConflict = (existingBookings || []).some((booking) => {
            const existingStart = new Date(
                booking.start_datetime
            )

            const existingEnd = new Date(
                booking.end_datetime
            )

            return newStart < existingEnd && newEnd > existingStart
        })

        if (hasConflict) {
            showToast({
                type: 'error',
                message:
                    'Selected date and time are already booked.',
            })
            setForm({ ...form, start_date: '', end_date: '' })
            setAddBookingProgress(false)
            return
        }

        const { error } = await supabase.from('bookings').insert([
            {
                resort_id: selectedResort.id,
                name: formName,
                contact: normalizeMobile(formContact),
                start_datetime: new Date(`${formStartDate}T${formStartTime}`),
                end_datetime: new Date(`${formEndDate}T${formEndTime}`),
                guests: Number(formGuests || 0),
                agreed_amount: parseAmount(formAgreedAmount),
                proposed_amount: parseAmount(formAgreedAmount),
                downpayment: parseAmount(formDownpayment),
                notes: formNotes,
                status: 'confirmed',
            },
        ])

        setAddBookingProgress(false)

        if (error) {
            console.error(error)
            showToast({
                type: 'error',
                message:
                    'Failed to save booking.',
            })

            return
        }

        await refreshBookings()
        resetForm()
        onSuccess?.()
        onClose()
    }

    const handleClose = () => {
        resetForm()
        onClose()
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Add Booking</h2>
                        {selectedResort && (
                            <p className="text-sm text-gray-500 capitalize">
                                {selectedResort.name}
                            </p>
                        )}
                    </div>

                    <button className='cursor-pointer' onClick={handleClose}>
                        <X height={16} />
                    </button>
                </div>

                {errorMessage && (
                    <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">

                    <div className="mt-8 grid grid-cols-1 gap-2">
                        <p className='w-88'>Check In</p>
                        <div className='grid grid-cols-2 gap-2'>
                            <input
                                min={new Date().toISOString().split('T')[0]}
                                type="date"
                                name="start_date"
                                value={formStartDate}
                                className="flex-1 border p-2 rounded text-gray-600"
                                onChange={(e) => setFormStartDate(e.target.value)}
                            />
                            <input
                                type="time"
                                name="start_time"
                                value={formStartTime}
                                className="flex-1 border p-2 rounded"
                                onChange={(e) => setFormStartTime(e.target.value)}
                            />
                        </div>
                    </div>


                    <div className="grid grid-cols-1 gap-2">
                        <p className='w-88'>Check Out</p>
                        <div className='grid grid-cols-2 gap-2'>
                            <input
                                min={(formStartDate ? new Date(formStartDate) : new Date()).toISOString().split('T')[0]}
                                type="date"
                                name="end_date"
                                value={formEndDate}
                                className="flex-1 border p-2 rounded text-gray-600"
                                onChange={(e) => setFormEndDate(e.target.value)}
                            />

                            <input
                                type="time"
                                name="end_time"
                                value={formEndTime}
                                className="flex-1 border p-2 rounded"
                                onChange={(e) => setFormEndTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <input
                        type="text"
                        name="name"
                        value={formName}
                        placeholder="Guest Name"
                        className="w-full border p-2 rounded"
                        onChange={(e) => setFormName(e.target.value)}
                    />

                    <input
                        name="contact"
                        value={formContact}
                        onChange={(e) => {
                            // allow only numbers and +
                            const value = e.target.value.replace(/[^\d+]/g, '')
                            setFormContact(value)
                        }}
                        placeholder="09XXXXXXXXX"
                        className="w-full border px-3 py-2.5 sm:p-3 rounded"
                        maxLength={13}
                    />


                    <input
                        type="number"
                        name="guests"
                        value={formGuests}
                        placeholder="Number of guests"
                        className="w-full border p-2 rounded"
                        onChange={(e) => setFormGuests(e.target.value)}
                    />

                    <input
                        type="text"
                        name="agreed_amount"
                        value={formatAmountInput(formAgreedAmount)}
                        onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d]/g, '')
                            setFormAgreedAmount(raw)
                        }}
                        placeholder="Agreed Amount"
                        className="w-full border p-2 rounded"
                    />

                    <input
                        type="text"
                        name="downpayment"
                        value={formatAmountInput(formDownpayment)}
                        onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d]/g, '')
                            setFormDownpayment(raw)
                        }}
                        placeholder="Downpayment"
                        className="w-full border p-2 rounded"
                    />

                    <textarea
                        name="notes"
                        value={formNotes}
                        placeholder="Notes"
                        className="w-full border p-2 rounded"
                        onChange={(e) => setFormNotes(e.target.value)}
                    />

                    <button
                        disabled={
                            formName === ''
                            || formContact === ''
                            || !formStartDate
                            || !formEndDate
                            || !formGuests
                            || !formAgreedAmount
                            || !formDownpayment
                            || addBookingProgress
                            || !selectedResort
                        }
                        className="w-full bg-[#29b55a] text-white py-2 rounded disabled:bg-gray-400 cursor-pointer disabled:cursor-default"
                    >
                        {addBookingProgress ? 'Saving...' : 'Save Booking'}
                    </button>
                </form>
            </div>
        </div>
    )
}