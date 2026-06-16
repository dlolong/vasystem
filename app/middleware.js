import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = req.nextUrl.clone();

  // ❌ Not logged in
  if (!user && url.pathname.startsWith("/(protected)")) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, onboarding_completed")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    const onboarded = profile?.onboarding_completed;

    // 🚀 1. FIRST TIME USER → ONBOARDING
    if (!onboarded && url.pathname !== "/onboarding") {
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // 🚀 2. ROOT ACCESS → DASHBOARD
    if (url.pathname === "/") {
      if (role === "agency") url.pathname = "/agency";
      if (role === "va") url.pathname = "/va";
      if (role === "client") url.pathname = "/client";

      return NextResponse.redirect(url);
    }

    const isAuthRoute =
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/signup") ||
    url.pathname.startsWith("/onboarding");

    if (!user && !isAuthRoute) {
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};