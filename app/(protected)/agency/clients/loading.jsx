export default function Loading() {
  return (
    <div className="h-full flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">

        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />

        <p className="text-sm text-slate-600">
          Loading dashboard...
        </p>

      </div>
    </div>
  );
}