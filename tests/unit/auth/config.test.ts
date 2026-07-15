import { afterEach, describe, expect, it, vi } from "vitest";
import { getSignupMode, isSignupEnabled } from "@/lib/auth/config";

describe("signup mode config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to closed on Vercel Production", () => {
    vi.stubEnv("SIGNUP_MODE", "");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(getSignupMode()).toBe("closed");
    expect(isSignupEnabled()).toBe(false);
  });

  it("keeps signup available outside production by default", () => {
    vi.stubEnv("SIGNUP_MODE", "");
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(getSignupMode()).toBe("open");
    expect(isSignupEnabled()).toBe(true);
  });

  it("allows an explicit per-environment override", () => {
    vi.stubEnv("SIGNUP_MODE", "closed");
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(getSignupMode()).toBe("closed");
  });

  it("rejects unsupported modes", () => {
    vi.stubEnv("SIGNUP_MODE", "invite");

    expect(() => getSignupMode()).toThrow(
      'SIGNUP_MODE must be either "open" or "closed".',
    );
  });
});
