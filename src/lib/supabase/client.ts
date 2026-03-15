import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  return createBrowserClient(url, anonKey);
}
