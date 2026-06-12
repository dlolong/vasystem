import StatusBadge from './StatusBadge'

export default function BookingCard({ booking }) {
  return (
    <div className="border p-4 rounded">
      <p className="font-bold">{booking.name}</p>
      <p>
  📅 {booking.start_datetime}
</p>
<p>
  🏁 {booking.end_datetime}
</p>

      <StatusBadge status={booking.status} />
    </div>
  )
}