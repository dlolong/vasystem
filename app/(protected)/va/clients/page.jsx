"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AddClientDialog from "@/components/AddClientDialog";

import { CURRENCY_OPTIONS, formatMoney } from "@/lib/currency";

export default function VaClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClientDialog, setShowClientDialog] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) {
      console.error(error.message);
      setClients([]);
    } else {
      setClients(data || []);
    }

    setLoading(false);
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount || 0);
  }

  return (
    <main className="space-y-6">
      <AddClientDialog
        open={showClientDialog}
        onClose={() => setShowClientDialog(false)}
        onClientAdded={(newClient) => {
          setClients((prev) => [newClient, ...prev]);
        }}
      />

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Clients</h1>
          <p className="text-sm text-slate-500">
            Personal clients under your independent VA workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowClientDialog(true)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
        >
          Add Client
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading clients...
          </div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No clients yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {clients.map((client) => (
              <div
                key={client.id}
                className="flex flex-col justify-between gap-2 p-5 sm:flex-row sm:items-center"
              >
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {client.name}
                  </h3>

                  <p className="text-sm text-slate-500">
                    {client.email || "No email"}
                  </p>
                </div>

                <div className="text-sm font-medium text-slate-700">
                   {formatMoney(client.hourly_rate, client.currency || "USD")} / hr
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}