import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export async function getRole(userId) {
  const supabase = createServerComponentClient();

  const { data } = await supabase
    .from("users")
    .select("role, organization_id")
    .eq("id", userId)
    .single();

  return data;
}