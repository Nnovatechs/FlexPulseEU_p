import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, createSupabaseServerClient } = vi.hoisted(() => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`redirect:${target}`);
  }),
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

describe("auth actions with controlled signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SIGNUP_MODE", "closed");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks account creation at the server boundary when signup is closed", async () => {
    const { signUpWithPasswordAction } = await import("@/lib/auth/actions");
    const formData = new FormData();
    formData.set("email", "pilot@example.eu");
    formData.set("password", "example-password");
    formData.set("confirmPassword", "example-password");

    await expect(signUpWithPasswordAction(formData)).rejects.toThrow(
      "redirect:/login?error=signup-closed",
    );

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("keeps password sign-in available while signup is closed", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    createSupabaseServerClient.mockResolvedValue({
      auth: { signInWithPassword },
    });

    const { signInWithPasswordAction } = await import("@/lib/auth/actions");
    const formData = new FormData();
    formData.set("email", "pilot@example.eu");
    formData.set("password", "example-password");

    await expect(signInWithPasswordAction(formData)).rejects.toThrow(
      "redirect:/dashboard",
    );

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "pilot@example.eu",
      password: "example-password",
    });
  });
});
