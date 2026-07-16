import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { appRoutes } from "@/lib/config/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return appRoutes.dashboard;
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
    }
  }

  return NextResponse.redirect(
    new URL(`${appRoutes.login}?error=auth-confirmation-failed`, requestUrl.origin),
  );
}
