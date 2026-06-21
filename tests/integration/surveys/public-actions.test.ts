import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildValidationSurveyFixture } from "../../fixtures/surveys/validation/factory";

const { redirect, getPublicSurveyLinkByToken, getPublishedSurveyByIdPublic, createSurveyResponseAndEnqueueJob } =
  vi.hoisted(() => ({
    redirect: vi.fn(),
    getPublicSurveyLinkByToken: vi.fn(),
    getPublishedSurveyByIdPublic: vi.fn(),
    createSurveyResponseAndEnqueueJob: vi.fn(),
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

const ORIGINAL_TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const ORIGINAL_TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    restoreEnv("TURNSTILE_SECRET_KEY", ORIGINAL_TURNSTILE_SECRET_KEY);
    restoreEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", ORIGINAL_TURNSTILE_SITE_KEY);
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
            "I have read the privacy information and cookie notice, and I consent to the processing of my survey response for the stated purposes.",
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
