import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

describe("auth confirmation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies a recovery token and redirects to the password form", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    createSupabaseServerClient.mockResolvedValue({
      auth: { verifyOtp },
    });

    const { GET } = await import("@/app/auth/confirm/route");
    const response = await GET(
      new Request(
        "https://flex-pulse-eu-p.vercel.app/auth/confirm?token_hash=secret-token&type=recovery&next=/account/update-password",
      ),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "secret-token",
      type: "recovery",
    });
    expect(response.headers.get("location")).toBe(
      "https://flex-pulse-eu-p.vercel.app/account/update-password",
    );
  });

  it("rejects invalid or expired confirmation links", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      error: new Error("expired"),
    });
    createSupabaseServerClient.mockResolvedValue({
      auth: { verifyOtp },
    });

    const { GET } = await import("@/app/auth/confirm/route");
    const response = await GET(
      new Request(
        "https://flex-pulse-eu-p.vercel.app/auth/confirm?token_hash=expired&type=recovery",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://flex-pulse-eu-p.vercel.app/login?error=auth-confirmation-failed",
    );
  });

  it("does not allow an external next URL", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    createSupabaseServerClient.mockResolvedValue({
      auth: { verifyOtp },
    });

    const { GET } = await import("@/app/auth/confirm/route");
    const response = await GET(
      new Request(
        "https://flex-pulse-eu-p.vercel.app/auth/confirm?token_hash=secret-token&type=invite&next=https://attacker.example",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://flex-pulse-eu-p.vercel.app/dashboard",
    );
  });
});
