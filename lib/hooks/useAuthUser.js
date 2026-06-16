"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useAuthUser() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.auth.getUser();

    const authUser = data?.user;
    setUser(authUser);

    if (authUser) {
      const { data: profileData } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      setProfile(profileData);
    }

    setLoading(false);
  }

  return { user, profile, loading };
}