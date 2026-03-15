"use server";

import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/config/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeRedirectPath(value: FormDataEntryValue | null): string {
  const nextPath = String(value ?? "").trim();

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return appRoutes.dashboard;
  }

  return nextPath;
}

export async function signInWithPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`${appRoutes.login}?error=missing-credentials`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`${appRoutes.login}?error=invalid-credentials`);
  }

  redirect(getSafeRedirectPath(formData.get("next")));
}

export async function signUpWithPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password || !confirmPassword) {
    redirect(`${appRoutes.login}?mode=signup&error=missing-signup-fields`);
  }

  if (password !== confirmPassword) {
    redirect(`${appRoutes.login}?mode=signup&error=password-mismatch`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(`${appRoutes.login}?mode=signup&error=signup-failed`);
  }

  if (data.session) {
    redirect(appRoutes.dashboard);
  }

  redirect(`${appRoutes.login}?message=check-email`);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  redirect(appRoutes.login);
}
