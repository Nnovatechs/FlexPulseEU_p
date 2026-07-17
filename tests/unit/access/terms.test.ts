import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTermsDocument, TERMS_ACCEPTANCE_STATEMENT } from "@/features/access/terms";
import { TERMS_DOCUMENT_VERSION, isTermsAcceptanceRequired } from "@/features/access/terms-config";

describe("platform access terms", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "FlexPulseEU");
    vi.stubEnv("LEGAL_PRIVACY_EMAIL", "privacy@flexpulse.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a versioned terms document with a stable hash", () => {
    const document = buildTermsDocument();

    expect(document).toMatchObject({
      title: "Platform Access Terms",
      version: TERMS_DOCUMENT_VERSION,
      appliesTo: "FlexPulseEU hosted Stage 3 environment",
      contactEmail: "privacy@flexpulse.example",
    });
    expect(document.documentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(document.sections.some((section) => section.title.includes("Permitted use"))).toBe(
      true,
    );
    expect(document.sections.some((section) => section.title.includes("Security"))).toBe(
      true,
    );
    expect(TERMS_ACCEPTANCE_STATEMENT).toContain("accept");
  });

  it("uses a flag to determine whether acceptance is mandatory", () => {
    vi.stubEnv("TERMS_REQUIRED", "1");
    expect(isTermsAcceptanceRequired()).toBe(true);

    vi.stubEnv("TERMS_REQUIRED", "true");
    expect(isTermsAcceptanceRequired()).toBe(true);

    vi.stubEnv("TERMS_REQUIRED", "0");
    expect(isTermsAcceptanceRequired()).toBe(false);
  });
});
