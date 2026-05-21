import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "./env";

export function createSupabaseAdminClient() {
  const { url, secretKey } = getSupabaseAdminEnv();

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
