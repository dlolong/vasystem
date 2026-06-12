export default function Loader({ size = 40, text = null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="animate-spin rounded-full border-4 border-gray-200 border-t-[#29b55a]"
        style={{
          width: size,
          height: size,
        }}
      />

      {text && (
        <p className="text-sm text-gray-500">
          {text}
        </p>
      )}
    </div>
  )
}