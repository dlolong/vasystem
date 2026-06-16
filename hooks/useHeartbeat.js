"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useHeartbeat() {
  useEffect(() => {
    const update = async () => {
      const { data: user } = await supabase.auth.getUser();

      if (!user?.user) return;

      await supabase
        .from("users")
        .update({ last_active: new Date().toISOString() })
        .eq("id", user.user.id);
    };

    update();
    const interval = setInterval(update, 30000); // every 30s

    return () => clearInterval(interval);
  }, []);
}