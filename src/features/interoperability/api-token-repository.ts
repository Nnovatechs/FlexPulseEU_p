import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { appRoutes } from "@/lib/config/routes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { invalidRequest, notFound } from "./api-errors";
import {
  API_SCOPES,
  API_TOKEN_PREFIX_LIVE,
  API_TOKEN_PREFIX_TEST,
  type ApiScope,
  type CreateInteroperabilityApiTokenInput,
  type CreatedInteroperabilityApiToken,
  type InteroperabilityApiTokenRow,
  type InteroperabilityApiTokenSummary,
} from "./api-types";

type ConsumedTokenRateLimitRow = {
  token_id: string;
  owner_user_id: string;
  scopes: ApiScope[];
  allowed: boolean;
  remaining: number;
  reset_at: string;
};

function assertValidTokenName(name: string) {
  if (name.length < 1 || name.length > 80) {
    throw invalidRequest("Token name must be between 1 and 80 characters.");
  }
}

function assertValidScopes(scopes: ApiScope[]) {
  if (scopes.length === 0) {
    throw invalidRequest("Select at least one scope.");
  }
  const unique = new Set(scopes);
  if (unique.size !== scopes.length) {
    throw invalidRequest("Duplicate scopes are not allowed.");
  }
  if (scopes.some((scope) => !API_SCOPES.includes(scope))) {
    throw invalidRequest("One or more scopes are invalid.");
  }
}

function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildTokenPrefix(token: string) {
  return token.slice(0, 18);
}

function tokenPrefixLabel() {
  return process.env.VERCEL_ENV === "production" ? API_TOKEN_PREFIX_LIVE : API_TOKEN_PREFIX_TEST;
}

function generateApiToken() {
  const random = randomBytes(32).toString("base64url");
  return `${tokenPrefixLabel()}_${random}`;
}

function toTokenSummary(row: Pick<
  InteroperabilityApiTokenRow,
  "id" | "name" | "token_prefix" | "scopes" | "created_at" | "expires_at" | "revoked_at" | "last_used_at"
>): InteroperabilityApiTokenSummary {
  const now = Date.now();
  const expired = row.expires_at ? Date.parse(row.expires_at) <= now : false;
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    scopes: row.scopes,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    status: row.revoked_at ? "revoked" : expired ? "expired" : "active",
  };
}

export async function listCurrentOwnerApiTokens() {
  const session = await requireCurrentSession();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("interoperability_api_tokens")
    .select("id, name, token_prefix, scopes, created_at, expires_at, revoked_at, last_used_at")
    .eq("owner_user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list API tokens: ${error.message}`);
  }

  return ((data ?? []) as Array<
    Pick<
      InteroperabilityApiTokenRow,
      "id" | "name" | "token_prefix" | "scopes" | "created_at" | "expires_at" | "revoked_at" | "last_used_at"
    >
  >).map(toTokenSummary);
}

export async function createCurrentOwnerApiToken(
  input: CreateInteroperabilityApiTokenInput,
): Promise<CreatedInteroperabilityApiToken> {
  const session = await requireCurrentSession();
  const supabase = createSupabaseAdminClient();
  const name = input.name.trim();
  assertValidTokenName(name);
  assertValidScopes(input.scopes);

  const token = generateApiToken();
  const tokenHash = hashApiToken(token);
  const tokenPrefix = buildTokenPrefix(token);

  const { data, error } = await supabase
    .from("interoperability_api_tokens")
    .insert({
      owner_user_id: session.user.id,
      name,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      scopes: input.scopes,
      expires_at: input.expiresAt,
    })
    .select("id, name, token_prefix, scopes, created_at, expires_at, revoked_at, last_used_at")
    .single();

  if (error) {
    throw new Error(`Failed to create API token: ${error.message}`);
  }

  revalidatePath(appRoutes.accountApi);
  return {
    summary: toTokenSummary(
      data as Pick<
        InteroperabilityApiTokenRow,
        "id" | "name" | "token_prefix" | "scopes" | "created_at" | "expires_at" | "revoked_at" | "last_used_at"
      >,
    ),
    token,
  };
}

export async function revokeCurrentOwnerApiToken(tokenId: string) {
  const session = await requireCurrentSession();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("interoperability_api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("owner_user_id", session.user.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to revoke API token: ${error.message}`);
  }
  if (!data) {
    throw notFound();
  }

  revalidatePath(appRoutes.accountApi);
}

export async function consumeApiTokenRateLimit(input: { token: string; limit: number }) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consume_interoperability_token_rate_limit", {
    p_token_hash: hashApiToken(input.token),
    p_limit: input.limit,
    p_window_seconds: 60,
  });

  if (error) {
    throw new Error(`Failed to validate API token: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : null) as ConsumedTokenRateLimitRow | null;
  return row;
}

export function parseTokenExpiry(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const expiresAt = new Date(trimmed);
  if (Number.isNaN(expiresAt.getTime())) {
    throw invalidRequest("Expiry must be a valid date.");
  }
  if (expiresAt.getTime() <= Date.now()) {
    throw invalidRequest("Expiry must be in the future.");
  }
  return expiresAt.toISOString();
}

export function parseScopeSelection(rawValues: FormDataEntryValue[]) {
  const scopes = rawValues.map(String) as ApiScope[];
  assertValidScopes(scopes);
  return scopes;
}
