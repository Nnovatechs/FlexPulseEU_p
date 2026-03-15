type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return {
    url: readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}
