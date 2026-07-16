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
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
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

  it("requests a password recovery email without exposing account existence", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({
      error: new Error("User not found"),
    });
    createSupabaseServerClient.mockResolvedValue({
      auth: { resetPasswordForEmail },
    });

    const { requestPasswordResetAction } = await import("@/lib/auth/actions");
    const formData = new FormData();
    formData.set("email", "pilot@example.eu");

    await expect(requestPasswordResetAction(formData)).rejects.toThrow(
      "redirect:/forgot-password?message=reset-requested",
    );

    expect(resetPasswordForEmail).toHaveBeenCalledWith("pilot@example.eu", {
      redirectTo:
        "http://localhost:3000/auth/confirm?next=%2Faccount%2Fupdate-password",
    });
  });

  it("updates the password for the authenticated recovery session", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    createSupabaseServerClient.mockResolvedValue({
      auth: { updateUser },
    });

    const { updatePasswordAction } = await import("@/lib/auth/actions");
    const formData = new FormData();
    formData.set("password", "new-secure-password");
    formData.set("confirmPassword", "new-secure-password");

    await expect(updatePasswordAction(formData)).rejects.toThrow(
      "redirect:/account/update-password?message=password-updated",
    );

    expect(updateUser).toHaveBeenCalledWith({
      password: "new-secure-password",
    });
  });

  it("rejects mismatched passwords before calling Supabase", async () => {
    const { updatePasswordAction } = await import("@/lib/auth/actions");
    const formData = new FormData();
    formData.set("password", "new-secure-password");
    formData.set("confirmPassword", "different-password");

    await expect(updatePasswordAction(formData)).rejects.toThrow(
      "redirect:/account/update-password?error=password-mismatch",
    );

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
