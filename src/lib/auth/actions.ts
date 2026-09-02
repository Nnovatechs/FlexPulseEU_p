"use server";

import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/config/app-url";
import { appRoutes } from "@/lib/config/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSignupEnabled } from "./config";

function getPasswordUpdateErrorKey(error: { code?: string; message?: string }) {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";

  if (
    code === "weak_password" ||
    message.includes("pwned") ||
    message.includes("leaked") ||
    message.includes("compromised") ||
    message.includes("weak password")
  ) {
    return "password-compromised";
  }

  return "update-failed";
}

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
  if (!isSignupEnabled()) {
    redirect(`${appRoutes.login}?error=signup-closed`);
  }

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
    options: {
      emailRedirectTo: `${getAppUrl()}${appRoutes.authConfirm}?next=${encodeURIComponent(appRoutes.dashboard)}`,
    },
  });

  if (error) {
    redirect(`${appRoutes.login}?mode=signup&error=signup-failed`);
  }

  if (data.session) {
    redirect(appRoutes.dashboard);
  }

  redirect(`${appRoutes.login}?message=check-email`);
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect(`${appRoutes.forgotPassword}?error=missing-email`);
  }

  const supabase = await createSupabaseServerClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}${appRoutes.authConfirm}?next=${encodeURIComponent(appRoutes.updatePassword)}`,
  });

  // Keep this response deliberately generic so the form does not disclose
  // whether an email address belongs to an account.
  redirect(`${appRoutes.forgotPassword}?message=reset-requested`);
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || !confirmPassword) {
    redirect(`${appRoutes.updatePassword}?error=missing-password`);
  }

  if (password.length < 8) {
    redirect(`${appRoutes.updatePassword}?error=password-too-short`);
  }

  if (password !== confirmPassword) {
    redirect(`${appRoutes.updatePassword}?error=password-mismatch`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("Password update failed:", error.code, error.message);
    redirect(`${appRoutes.updatePassword}?error=${getPasswordUpdateErrorKey(error)}`);
  }

  redirect(`${appRoutes.updatePassword}?message=password-updated`);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  redirect(appRoutes.login);
}
