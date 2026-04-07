import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/features/surveys/generator-repository", () => ({
  getPublicSurveyLinkByToken,
  getPublishedSurveyByIdPublic,
}));

vi.mock("@/features/surveys/response-repository", () => ({
  createSurveyResponseAndEnqueueJob,
}));

describe("public survey submission action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the response and redirects to the thank-you page", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
      optionLabels: ["Low", "Medium", "High"],
    });

    const survey = {
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
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
      mapping_compiled_json: null,
      mapping_hash: "mapping-hash",
    };

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

    const { submitPublicSurveyResponseAction } = await import(
      "@/features/surveys/public-actions"
    );

    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_2");

    await submitPublicSurveyResponseAction(formData);

    expect(createSurveyResponseAndEnqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedLanguage: fixture.language,
        answers: { Q_TEST_01: "opt_2" },
      }),
    );
    expect(redirect).toHaveBeenCalledWith("/s/public-token/thank-you?lang=English");
  });
});
