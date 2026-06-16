"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useUserRole() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: user } = await supabase.auth.getUser();

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.user.id)
        .single();

      setRole(data.role);
    }

    load();
  }, []);

  return role;
}