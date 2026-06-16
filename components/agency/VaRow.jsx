import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function VaRow({ va }) {
  const router = useRouter();
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const diff = Date.now() - new Date(va.last_active || 0).getTime();
    setOnline(diff < 60000); // 1 min
  }, [va]);

  return (
    <div
      onClick={() => router.push(`/agency/vas/${va.id}`)}
      className="flex items-center justify-between p-4 bg-white border rounded-lg cursor-pointer hover:bg-slate-50"
    >
      <div className="flex items-center gap-3">

        {/* DOT */}
        <span
          className={`w-3 h-3 rounded-full ${
            online ? "bg-green-500" : "bg-gray-400"
          }`}
        />

        <div>
          <div className="font-medium">{va.email}</div>
          <div className="text-xs text-slate-500">
            {online ? "Online" : "Offline"}
          </div>
        </div>

      </div>

      <div className="text-sm text-slate-600">
        {va.total_hours} hrs
      </div>
    </div>
  );
}