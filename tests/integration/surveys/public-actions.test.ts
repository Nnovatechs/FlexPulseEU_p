import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildValidationSurveyFixture } from "../../fixtures/surveys/validation/factory";

const {
  redirect,
  getPublicSurveyLinkByToken,
  getPublishedSurveyByIdPublic,
  getPublicSurveyLegalSnapshot,
  createSurveyResponseAndEnqueueJob,
  getActivePublicProlificIntegration,
  buildProlificRecruitmentTokens,
} =
  vi.hoisted(() => ({
    redirect: vi.fn(),
    getPublicSurveyLinkByToken: vi.fn(),
    getPublishedSurveyByIdPublic: vi.fn(),
    getPublicSurveyLegalSnapshot: vi.fn(),
    createSurveyResponseAndEnqueueJob: vi.fn(),
    getActivePublicProlificIntegration: vi.fn(),
    buildProlificRecruitmentTokens: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/features/surveys/public-survey-load", () => ({
  getPublicSurveyLinkByToken,
  getPublishedSurveyByIdPublic,
}));

vi.mock("@/features/surveys/response-repository", () => ({
  createSurveyResponseAndEnqueueJob,
}));

vi.mock("@/features/surveys/integrations/repository", () => ({
  getActivePublicProlificIntegration,
}));

vi.mock("@/features/surveys/integrations/tokenization", () => ({
  buildProlificRecruitmentTokens,
}));

vi.mock("@/features/privacy/repository", () => ({
  getPublicSurveyLegalSnapshot,
}));

const ORIGINAL_TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const ORIGINAL_TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const ORIGINAL_TURNSTILE_REQUIRED = process.env.TURNSTILE_REQUIRED;
const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function buildPublishedSurveyFixture() {
  const fixture = buildValidationSurveyFixture({
    title: "How comfortable are you with automated load shifting?",
    optionLabels: ["Low", "Medium", "High"],
  });

  return {
    fixture,
    survey: {
      id: "survey-1",
      name: "Baseline survey",
      status: "published" as const,
      created_by: "user-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1 as const, mappings: fixture.mappings },
      mapping_compiled_json: null,
      mapping_hash: "mapping-hash",
      measurement_hash: "measurement-hash-v1",
    },
  };
}

function mockPublicSurveyRuntime(survey: ReturnType<typeof buildPublishedSurveyFixture>["survey"]) {
  getPublicSurveyLinkByToken.mockResolvedValue({
    id: "link-1",
    survey_id: "survey-1",
    link_token: "public-token",
    audience_label: "Default audience",
    audience_token: "default",
    is_active: true,
    created_at: new Date().toISOString(),
  });
  getPublishedSurveyByIdPublic.mockResolvedValue(survey);
}

describe("public survey submission action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicSurveyLegalSnapshot.mockResolvedValue(null);
    getActivePublicProlificIntegration.mockResolvedValue(null);
    buildProlificRecruitmentTokens.mockReturnValue({
      participantToken: "participant-token",
      submissionToken: "submission-token",
      tokenVersion: "v1",
      noticeVersion: "external-recruitment-v1",
    });
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_REQUIRED;
    delete process.env.VERCEL_ENV;
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    restoreEnv("TURNSTILE_SECRET_KEY", ORIGINAL_TURNSTILE_SECRET_KEY);
    restoreEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", ORIGINAL_TURNSTILE_SITE_KEY);
    restoreEnv("TURNSTILE_REQUIRED", ORIGINAL_TURNSTILE_REQUIRED);
    restoreEnv("VERCEL_ENV", ORIGINAL_VERCEL_ENV);
    vi.unstubAllGlobals();
  });

  it("stores the response and redirects to the thank-you page", async () => {
    const { fixture, survey } = buildPublishedSurveyFixture();
    mockPublicSurveyRuntime(survey);

    const { submitPublicSurveyResponseAction } = await import(
      "@/features/surveys/public-actions"
    );

    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_2");
    formData.set("legalConsentAccepted", "true");

    await submitPublicSurveyResponseAction(formData);

    expect(createSurveyResponseAndEnqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedLanguage: fixture.language,
        answers: { Q_TEST_01: "opt_2" },
        legalConsent: expect.objectContaining({
          accepted: true,
          statement:
            "I consent to the processing of my survey response for the stated purposes and confirm that I have read:",
          source: "public_survey_form",
        }),
        survey: expect.objectContaining({
          mapping_hash: "mapping-hash",
          measurement_hash: "measurement-hash-v1",
        }),
      }),
    );
    expect(redirect).toHaveBeenCalledWith("/s/public-token/thank-you?lang=English");
  });

  it("stores Prolific-linked responses and redirects to the completion URL", async () => {
    const { fixture, survey } = buildPublishedSurveyFixture();
    mockPublicSurveyRuntime(survey);
    getActivePublicProlificIntegration.mockResolvedValue({
      id: "integration-1",
      survey_link_id: "link-1",
      provider: "prolific",
      external_study_id: "study-123",
      completion_url: "https://app.prolific.com/submissions/complete?cc=ABC123",
      provider_config_json: {},
      privacy_notice_version: "external-recruitment-v1",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const { submitPublicSurveyResponseAction } = await import(
      "@/features/surveys/public-actions"
    );

    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_2");
    formData.set("legalConsentAccepted", "true");
    formData.set("PROLIFIC_PID", "participant-1");
    formData.set("STUDY_ID", "study-123");
    formData.set("SESSION_ID", "session-1");

    await submitPublicSurveyResponseAction(formData);

    expect(createSurveyResponseAndEnqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        externalRecruitment: expect.objectContaining({
          integration: expect.objectContaining({ id: "integration-1" }),
          participantToken: "participant-token",
          submissionToken: "submission-token",
          tokenVersion: "v1",
          noticeVersion: "external-recruitment-v1",
        }),
      }),
    );
    expect(redirect).toHaveBeenCalledWith(
      "https://app.prolific.com/submissions/complete?cc=ABC123",
    );
  });

  it("rejects incomplete Prolific parameters", async () => {
    const { fixture, survey } = buildPublishedSurveyFixture();
    mockPublicSurveyRuntime(survey);

    const { submitPublicSurveyResponseAction } = await import(
      "@/features/surveys/public-actions"
    );

    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_2");
    formData.set("legalConsentAccepted", "true");
    formData.set("PROLIFIC_PID", "participant-1");
    formData.set("STUDY_ID", "study-123");

    await expect(submitPublicSurveyResponseAction(formData)).rejects.toThrow(
      "This Prolific study link is incomplete. Please return to Prolific and reopen the study.",
    );

    expect(createSurveyResponseAndEnqueueJob).not.toHaveBeenCalled();
  });

  it("rejects a mismatched Prolific study id", async () => {
    const { fixture, survey } = buildPublishedSurveyFixture();
    mockPublicSurveyRuntime(survey);
    getActivePublicProlificIntegration.mockResolvedValue({
      id: "integration-1",
      survey_link_id: "link-1",
      provider: "prolific",
      external_study_id: "study-123",
      completion_url: "https://app.prolific.com/submissions/complete?cc=ABC123",
      provider_config_json: {},
      privacy_notice_version: "external-recruitment-v1",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const { submitPublicSurveyResponseAction } = await import(
      "@/features/surveys/public-actions"
    );

    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_2");
    formData.set("legalConsentAccepted", "true");
    formData.set("PROLIFIC_PID", "participant-1");
    formData.set("STUDY_ID", "study-wrong");
    formData.set("SESSION_ID", "session-1");

    await expect(submitPublicSurveyResponseAction(formData)).rejects.toThrow(
      "This Prolific study link does not match the configured study. Please return to Prolific and reopen the study.",
    );

    expect(createSurveyResponseAndEnqueueJob).not.toHaveBeenCalled();
  });

  it("rejects submissions without privacy acceptance", async () => {
    const { fixture, survey } = buildPublishedSurveyFixture();
    mockPublicSurveyRuntime(survey);

    const { submitPublicSurveyResponseAction } = await import(
      "@/features/surveys/public-actions"
    );

    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_2");

    await expect(submitPublicSurveyResponseAction(formData)).rejects.toThrow(
      "Privacy information acceptance is required.",
    );

    expect(createSurveyResponseAndEnqueueJob).not.toHaveBeenCalled();
  });

  it("rejects submissions without Turnstile token when Turnstile is configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "turnstile-site-key";

    const { submitPublicSurveyResponseAction } = await import(
      "@/features/surveys/public-actions"
    );

    const formData = new FormData();
    formData.set("linkToken", "public-token");

    await expect(submitPublicSurveyResponseAction(formData)).rejects.toThrow(
      "Turnstile verification is required.",
    );

    expect(getPublicSurveyLinkByToken).not.toHaveBeenCalled();
    expect(createSurveyResponseAndEnqueueJob).not.toHaveBeenCalled();
  });

  it("does not require Turnstile when only the server secret is configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";

    const { fixture, survey } = buildPublishedSurveyFixture();
    mockPublicSurveyRuntime(survey);

    const { submitPublicSurveyResponseAction } = await import(
      "@/features/surveys/public-actions"
    );

    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_2");
    formData.set("legalConsentAccepted", "true");

    await submitPublicSurveyResponseAction(formData);

    expect(createSurveyResponseAndEnqueueJob).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/s/public-token/thank-you?lang=English");
  });

  it("fails closed when Turnstile is required but incompletely configured", async () => {
    process.env.TURNSTILE_REQUIRED = "1";
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";

    const { submitPublicSurveyResponseAction } = await import(
      "@/features/surveys/public-actions"
    );

    const formData = new FormData();
    formData.set("linkToken", "public-token");

    await expect(submitPublicSurveyResponseAction(formData)).rejects.toThrow(
      "Turnstile protection is required but both Turnstile keys are not configured.",
    );

    expect(getPublicSurveyLinkByToken).not.toHaveBeenCalled();
    expect(createSurveyResponseAndEnqueueJob).not.toHaveBeenCalled();
  });

  it("stores the response after a successful Turnstile verification", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "turnstile-site-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );

    const { fixture, survey } = buildPublishedSurveyFixture();
    mockPublicSurveyRuntime(survey);

    const { submitPublicSurveyResponseAction } = await import(
      "@/features/surveys/public-actions"
    );

    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_2");
    formData.set("cf-turnstile-response", "valid-token");
    formData.set("legalConsentAccepted", "true");

    await submitPublicSurveyResponseAction(formData);

    expect(fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    );
    expect(createSurveyResponseAndEnqueueJob).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/s/public-token/thank-you?lang=English");
  });
});
