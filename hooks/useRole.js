"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useRole() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    getRole();
  }, []);

  async function getRole() {
    const { data: user } = await supabase.auth.getUser();

    if (!user.user) return;

    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.user.id)
      .single();

    setRole(data.role);
  }

  return role;
}