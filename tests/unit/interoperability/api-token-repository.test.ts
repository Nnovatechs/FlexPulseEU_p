import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCurrentSession,
  createSupabaseAdminClient,
  revalidatePath,
} = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

describe("api token repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentSession.mockResolvedValue({ user: { id: "owner-1" } });
  });

  it("stores a hash instead of the raw token and returns the token only once", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "token-1",
        name: "Production sync",
        token_prefix: "fp_test_1234567890",
        scopes: ["surveys:read", "analytics:read"],
        created_at: "2026-08-18T12:00:00.000Z",
        expires_at: null,
        revoked_at: null,
        last_used_at: null,
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    createSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => ({ insert })),
    });

    const { createCurrentOwnerApiToken } = await import(
      "@/features/interoperability/api-token-repository"
    );
    const created = await createCurrentOwnerApiToken({
      name: "Production sync",
      scopes: ["surveys:read", "analytics:read"],
      expiresAt: null,
    });

    const insertedCall = insert.mock.calls.at(0) as [Record<string, string>] | undefined;
    const inserted = insertedCall?.[0];
    if (!inserted) {
      throw new Error("Expected token insert payload.");
    }
    expect(typeof created.token).toBe("string");
    expect(created.token.startsWith("fp_test_")).toBe(true);
    expect(inserted.token_hash).not.toBe(created.token);
    expect(inserted.token_prefix).toBe(created.token.slice(0, 18));
    expect(inserted).not.toHaveProperty("token");
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("uses the atomic rpc for token consumption", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          token_id: "token-1",
          owner_user_id: "owner-1",
          scopes: ["surveys:read"],
          allowed: true,
          remaining: 119,
          reset_at: "2026-08-18T12:01:00.000Z",
        },
      ],
      error: null,
    });
    createSupabaseAdminClient.mockReturnValue({ rpc });

    const { consumeApiTokenRateLimit } = await import(
      "@/features/interoperability/api-token-repository"
    );
    const consumed = await consumeApiTokenRateLimit({
      token: "fp_test_demo",
      limit: 120,
    });

    expect(rpc).toHaveBeenCalledWith("consume_interoperability_token_rate_limit", {
      p_token_hash: expect.any(String),
      p_limit: 120,
      p_window_seconds: 60,
    });
    expect(consumed).toMatchObject({
      token_id: "token-1",
      owner_user_id: "owner-1",
      remaining: 119,
    });
  });

  it("looks up active tokens without consuming quota", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "token-1",
        owner_user_id: "owner-1",
        scopes: ["surveys:read"],
        expires_at: null,
        revoked_at: null,
      },
      error: null,
    });
    const rpc = vi.fn();
    createSupabaseAdminClient.mockReturnValue({
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({ maybeSingle })),
          })),
        })),
      })),
    });

    const { lookupActiveApiToken } = await import("@/features/interoperability/api-token-repository");
    await expect(lookupActiveApiToken("fp_test_demo")).resolves.toMatchObject({
      tokenId: "token-1",
      ownerUserId: "owner-1",
      scopes: ["surveys:read"],
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("treats expired tokens as missing without consuming quota", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "token-1",
        owner_user_id: "owner-1",
        scopes: ["surveys:read"],
        expires_at: "2020-01-01T00:00:00.000Z",
        revoked_at: null,
      },
      error: null,
    });
    const rpc = vi.fn();
    createSupabaseAdminClient.mockReturnValue({
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({ maybeSingle })),
          })),
        })),
      })),
    });

    const { lookupActiveApiToken } = await import("@/features/interoperability/api-token-repository");
    await expect(lookupActiveApiToken("fp_test_demo")).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("preserves an explicit timezone on token expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { parseTokenExpiry } = await import("@/features/interoperability/api-token-repository");
    expect(parseTokenExpiry("2026-09-03T16:00:00.000Z")).toBe("2026-09-03T16:00:00.000Z");
    vi.useRealTimers();
  });
});
