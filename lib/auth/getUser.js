import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export async function getUser() {
  const supabase = createServerComponentClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}