import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeApiTokenRateLimit, lookupActiveApiToken } = vi.hoisted(() => ({
  consumeApiTokenRateLimit: vi.fn(),
  lookupActiveApiToken: vi.fn(),
}));

vi.mock("@/features/interoperability/api-token-repository", () => ({
  consumeApiTokenRateLimit,
  lookupActiveApiToken,
}));

describe("interoperability api auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing authorization headers", async () => {
    const { authenticateApiRequest } = await import("@/features/interoperability/api-auth");
    await expect(
      authenticateApiRequest({
        request: new Request("http://localhost/api/v1"),
        limit: 120,
      }),
    ).rejects.toMatchObject({ code: "invalid_token", status: 401 });
    expect(lookupActiveApiToken).not.toHaveBeenCalled();
    expect(consumeApiTokenRateLimit).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens without revealing the reason", async () => {
    lookupActiveApiToken.mockResolvedValue(null);
    const { authenticateApiRequest } = await import("@/features/interoperability/api-auth");
    await expect(
      authenticateApiRequest({
        request: new Request("http://localhost/api/v1", {
          headers: { authorization: "Bearer fp_test_invalid" },
        }),
        limit: 120,
      }),
    ).rejects.toMatchObject({ code: "invalid_token", status: 401 });
    expect(consumeApiTokenRateLimit).not.toHaveBeenCalled();
  });

  it("rejects tokens without the required scope before consuming quota", async () => {
    lookupActiveApiToken.mockResolvedValue({
      tokenId: "token-1",
      ownerUserId: "owner-1",
      scopes: ["surveys:read"],
    });
    const { authenticateApiRequest } = await import("@/features/interoperability/api-auth");
    await expect(
      authenticateApiRequest({
        request: new Request("http://localhost/api/v1/surveys", {
          headers: { authorization: "Bearer fp_test_scope" },
        }),
        limit: 120,
        requiredScopes: ["analytics:read"],
      }),
    ).rejects.toMatchObject({ code: "insufficient_scope", status: 403 });
    expect(consumeApiTokenRateLimit).not.toHaveBeenCalled();
  });

  it("returns rate limit metadata for valid tokens", async () => {
    lookupActiveApiToken.mockResolvedValue({
      tokenId: "token-1",
      ownerUserId: "owner-1",
      scopes: ["surveys:read", "analytics:read"],
    });
    consumeApiTokenRateLimit.mockResolvedValue({
      token_id: "token-1",
      owner_user_id: "owner-1",
      scopes: ["surveys:read", "analytics:read"],
      allowed: true,
      remaining: 119,
      reset_at: new Date(Date.now() + 60_000).toISOString(),
    });
    const { authenticateApiRequest } = await import("@/features/interoperability/api-auth");
    await expect(
      authenticateApiRequest({
        request: new Request("http://localhost/api/v1/surveys/s1/analytics/query", {
          headers: { authorization: "Bearer fp_test_valid" },
        }),
        limit: 120,
        requiredScopes: ["analytics:read"],
      }),
    ).resolves.toMatchObject({
      tokenId: "token-1",
      ownerUserId: "owner-1",
      scopes: ["surveys:read", "analytics:read"],
      rateLimit: {
        limit: 120,
        remaining: 119,
      },
    });
    expect(consumeApiTokenRateLimit).toHaveBeenCalled();
  });

  it("returns 429 when the token is over quota", async () => {
    lookupActiveApiToken.mockResolvedValue({
      tokenId: "token-1",
      ownerUserId: "owner-1",
      scopes: ["analytics:read"],
    });
    consumeApiTokenRateLimit.mockResolvedValue({
      token_id: "token-1",
      owner_user_id: "owner-1",
      scopes: ["analytics:read"],
      allowed: false,
      remaining: 0,
      reset_at: new Date(Date.now() + 30_000).toISOString(),
    });
    const { authenticateApiRequest } = await import("@/features/interoperability/api-auth");
    await expect(
      authenticateApiRequest({
        request: new Request("http://localhost/api/v1/surveys/s1/analytics/query", {
          headers: { authorization: "Bearer fp_test_rate_limited" },
        }),
        limit: 120,
        requiredScopes: ["analytics:read"],
      }),
    ).rejects.toMatchObject({ code: "rate_limit_exceeded", status: 429 });
  });
});
