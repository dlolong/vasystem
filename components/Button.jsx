export default function Button({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-[#29b55a] text-white px-4 py-2 rounded"
    >
      {children}
    </button>
  )
}