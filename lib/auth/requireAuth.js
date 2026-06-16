import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export async function requireAuth() {
  const supabase = createServerComponentClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  return user;
}