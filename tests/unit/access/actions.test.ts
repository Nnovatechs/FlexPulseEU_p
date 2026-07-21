import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTermsDocument } from "@/features/access/terms";

const {
  getCurrentTermsAcceptance,
  recordCurrentTermsAcceptance,
  revalidatePath,
  redirect,
} = vi.hoisted(() => ({
  getCurrentTermsAcceptance: vi.fn(),
  recordCurrentTermsAcceptance: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/access/repository", () => ({
  getCurrentTermsAcceptance,
  recordCurrentTermsAcceptance,
}));

describe("terms acceptance action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "FlexPulseEU");
    vi.stubEnv("LEGAL_PRIVACY_EMAIL", "privacy@flexpulse.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records the exact terms document displayed to the user", async () => {
    getCurrentTermsAcceptance.mockResolvedValue(null);
    recordCurrentTermsAcceptance.mockResolvedValue({});
    const document = buildTermsDocument();
    const formData = new FormData();
    formData.set("accepted", "true");
    formData.set("documentHash", document.documentHash);

    const { acceptTermsAction } = await import("@/features/access/actions");
    await acceptTermsAction(formData);

    expect(recordCurrentTermsAcceptance).toHaveBeenCalledWith(document);
    expect(revalidatePath).toHaveBeenCalledWith("/terms");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
