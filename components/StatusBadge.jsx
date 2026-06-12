export default function StatusBadge({ status }) {
  const colors = {
    pending: 'bg-yellow-400',
    confirmed: 'bg-green-500',
    cancelled: 'bg-red-500',
  }

  return (
    <span className={`text-white px-2 py-1 rounded ${colors[status]}`}>
      {status}
    </span>
  )
}