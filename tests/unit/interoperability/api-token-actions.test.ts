import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, revokeCurrentOwnerApiToken } = vi.hoisted(() => ({
  redirect: vi.fn((location: string) => {
    throw new Error(`REDIRECT:${location}`);
  }),
  revokeCurrentOwnerApiToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/features/interoperability/api-token-repository", () => ({
  revokeCurrentOwnerApiToken,
  createCurrentOwnerApiToken: vi.fn(),
  parseScopeSelection: vi.fn(),
  parseTokenExpiry: vi.fn(),
}));

describe("api token actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to success after revoking a token", async () => {
    revokeCurrentOwnerApiToken.mockResolvedValue(undefined);
    const { revokeApiTokenAction } = await import("@/features/interoperability/api-token-actions");
    const formData = new FormData();
    formData.set("tokenId", "token-1");

    await expect(revokeApiTokenAction(formData)).rejects.toThrow(
      "REDIRECT:/account/api?revoked=1",
    );
  });
});
