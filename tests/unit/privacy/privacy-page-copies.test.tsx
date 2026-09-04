import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DERIVED_PROCESSING_COPY,
  EXTERNAL_PANEL_TOKENIZATION_COPY,
  INTERNATIONAL_TRANSFERS_COPY,
  SUPERVISORY_AUTHORITY_COPY,
} from "@/features/privacy/notice-copy";

const {
  getLegalConfig,
  getRawLocationRetentionLabel,
  getPublicSurveyLegalSnapshot,
  buildLegacySurveyLegalSnapshot,
  getPublicSurveyRuntimeByLinkToken,
  getCurrentOwnerLegalProfile,
  isOwnerLegalProfileComplete,
  buildSurveyLegalSnapshot,
} = vi.hoisted(() => ({
  getLegalConfig: vi.fn(),
  getRawLocationRetentionLabel: vi.fn(),
  getPublicSurveyLegalSnapshot: vi.fn(),
  buildLegacySurveyLegalSnapshot: vi.fn(),
  getPublicSurveyRuntimeByLinkToken: vi.fn(),
  getCurrentOwnerLegalProfile: vi.fn(),
  isOwnerLegalProfileComplete: vi.fn(),
  buildSurveyLegalSnapshot: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/layout/page-header", () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  ),
}));

vi.mock("@/lib/config/legal", () => ({
  getLegalConfig,
}));

vi.mock("@/lib/config/response-retention", () => ({
  getRawLocationRetentionLabel,
}));

vi.mock("@/features/privacy/repository", () => ({
  getPublicSurveyLegalSnapshot,
  getCurrentOwnerLegalProfile,
}));

vi.mock("@/features/privacy/types", () => ({
  buildLegacySurveyLegalSnapshot,
  buildSurveyLegalSnapshot,
  isOwnerLegalProfileComplete,
}));

vi.mock("@/features/surveys/use-cases", () => ({
  getPublicSurveyRuntimeByLinkToken,
}));

const snapshot = {
  notices: { privacyNoticeVersion: "privacy-v1" },
  controller: {
    name: "Controller Ltd",
    country: "Spain",
    contactEmail: "public@example.com",
    privacyEmail: "privacy@example.com",
    dpoEmail: "dpo@example.com",
  },
  retention: {
    rawLocation: "72 hours",
    responses: "Responses are retained for the documented research period.",
  },
  platform: {
    processorName: "FlexPulseEU",
    privacyUrl: "/privacy",
    cookiesUrl: "/cookies",
  },
};

describe("privacy page copies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLegalConfig.mockReturnValue({
      privacyNoticeVersion: "privacy-v1",
      processorName: "FlexPulseEU",
      privacyEmail: "privacy@example.com",
      cookiesUrl: "/cookies",
    });
    getRawLocationRetentionLabel.mockReturnValue("72 hours");
    getPublicSurveyRuntimeByLinkToken.mockResolvedValue({
      survey: { id: "survey-1" },
    });
    getPublicSurveyLegalSnapshot.mockResolvedValue({
      snapshot,
    });
    buildLegacySurveyLegalSnapshot.mockReturnValue(snapshot);
    getCurrentOwnerLegalProfile.mockResolvedValue({ id: "profile-1" });
    isOwnerLegalProfileComplete.mockReturnValue(true);
    buildSurveyLegalSnapshot.mockReturnValue(snapshot);
  });

  it("shows the new platform privacy copies", async () => {
    const { default: PrivacyPage } = await import("@/app/(public)/privacy/page");
    const html = renderToStaticMarkup(<PrivacyPage />);

    expect(html).toContain(DERIVED_PROCESSING_COPY);
    expect(html).toContain(SUPERVISORY_AUTHORITY_COPY);
    expect(html).toContain(INTERNATIONAL_TRANSFERS_COPY);
    expect(html).toContain(
      "Authenticated workspace accounts use email, session data, and workspace configuration to provide and protect the service.",
    );
    expect(html).toContain(
      "Account closure may be requested through the privacy contact shown on this page.",
    );
  });

  it("keeps the public survey privacy notice aligned with derived processing, rights, transfers, and panel tokenisation", async () => {
    const { default: SurveyPrivacyPage } = await import(
      "@/app/(public)/s/[linkToken]/privacy/page"
    );
    const element = await SurveyPrivacyPage({
      params: Promise.resolve({ linkToken: "public-token" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain(DERIVED_PROCESSING_COPY);
    expect(html).toContain(SUPERVISORY_AUTHORITY_COPY);
    expect(html).toContain(INTERNATIONAL_TRANSFERS_COPY);
    expect(html).toContain(EXTERNAL_PANEL_TOKENIZATION_COPY);
  });

  it("keeps the preview aligned with the public survey notice", async () => {
    const { default: PrivacySettingsPreviewPage } = await import(
      "@/app/(app)/account/privacy/preview/page"
    );
    const element = await PrivacySettingsPreviewPage();
    const html = renderToStaticMarkup(element);

    expect(html).toContain(DERIVED_PROCESSING_COPY);
    expect(html).toContain(SUPERVISORY_AUTHORITY_COPY);
    expect(html).toContain(INTERNATIONAL_TRANSFERS_COPY);
    expect(html).toContain(EXTERNAL_PANEL_TOKENIZATION_COPY);
  });
});
