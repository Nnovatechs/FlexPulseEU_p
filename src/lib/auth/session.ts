import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { appRoutes } from "@/lib/config/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserSession = {
  user: User;
  name: string;
  email: string;
  role: "Authenticated user";
};

function formatDisplayName(user: User): string {
  const rawName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email?.split("@")[0] ?? "User";

  return rawName
    .split(/[.\-_ ]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export async function getCurrentSession(): Promise<UserSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return null;
  }

  return {
    user,
    name: formatDisplayName(user),
    email: user.email,
    role: "Authenticated user",
  };
}

export async function requireCurrentSession(): Promise<UserSession> {
  const session = await getCurrentSession();

  if (!session) {
    redirect(appRoutes.login);
  }

  return session;
}
