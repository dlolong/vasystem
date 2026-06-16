export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">

      {/* KPI ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1,2,3,4].map((i) => (
          <div key={i} className="h-24 bg-slate-200 rounded-xl" />
        ))}
      </div>

      {/* CHART */}
      <div className="h-72 bg-slate-200 rounded-xl" />

      {/* TABLE */}
      <div className="space-y-3">
        {[1,2,3,4,5].map((i) => (
          <div key={i} className="h-14 bg-slate-200 rounded-lg" />
        ))}
      </div>

    </div>
  );
}