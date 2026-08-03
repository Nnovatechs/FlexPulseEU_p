import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath, redirect, duplicateOwnedSurvey } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  duplicateOwnedSurvey: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/features/surveys/generator-repository", () => ({
  createSurveyDraft: vi.fn(),
  duplicateOwnedSurvey,
  getOwnedSurveyById: vi.fn(),
  updateSurveyDraft: vi.fn(),
  publishSurvey: vi.fn(),
  deleteOwnedSurveyDraft: vi.fn(),
  archiveOwnedSurvey: vi.fn(),
}));

describe("survey duplication action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new draft copy and redirects to its edit page", async () => {
    duplicateOwnedSurvey.mockResolvedValue({
      id: "survey-copy-1",
      name: "Flexibility survey (copy)",
      status: "draft",
      created_by: "user-1",
      created_at: "2026-08-03T08:00:00.000Z",
      updated_at: "2026-08-03T08:00:00.000Z",
      published_at: null,
      default_language: "English",
      supported_languages: ["English", "Spanish"],
      definition_json: {
        survey_meta: {
          default_language: "English",
          supported_languages: ["English", "Spanish"],
          response_context: {
            collect_country_code: false,
            collect_postal_code: false,
            enrich_weather_context: false,
          },
          validation_result: {
            validated_at: "2026-08-01T09:00:00.000Z",
            content_hash: "content-hash-1",
            passed: true,
            issues: [],
          },
          multilingual_validation_result: {
            validated_at: "2026-08-01T09:01:00.000Z",
            translation_hash: "translation-hash-1",
            validated_languages: ["English", "Spanish"],
            passed: true,
            issues: [],
            language_statuses: [
              { language: "English", passed: true, issue_count: 0 },
              { language: "Spanish", passed: true, issue_count: 0 },
            ],
          },
          expert_review_result: {
            reviewer_type: "language_expert",
            review_basis: "Checked by linguist.",
            changes: [],
            baseline_content_hash: "content-hash-1",
            baseline_copy_hash: "translation-hash-1",
            final_content_hash: "content-hash-1",
            final_copy_hash: "translation-hash-1",
            applied_at: "2026-08-01T09:02:00.000Z",
            applied_by_user_id: "user-1",
          },
        },
        questions: [],
        translations: {
          English: {
            survey_title: "Flexibility survey",
            survey_description: "",
            questions: {},
          },
          Spanish: {
            survey_title: "Encuesta de flexibilidad",
            survey_description: "",
            questions: {},
          },
        },
      },
      mapping_contract_json: { schema_version: 1, mappings: [] },
      mapping_compiled_json: null,
      mapping_hash: null,
      measurement_hash: null,
    });

    const { duplicateSurveyAction } = await import("@/features/surveys/actions");
    const formData = new FormData();
    formData.set("surveyId", "survey-source-1");

    await duplicateSurveyAction(formData);

    expect(duplicateOwnedSurvey).toHaveBeenCalledWith("survey-source-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/surveys");
    expect(revalidatePath).toHaveBeenCalledWith("/surveys/survey-source-1");
    expect(revalidatePath).toHaveBeenCalledWith("/surveys/survey-copy-1");
    expect(revalidatePath).toHaveBeenCalledWith("/surveys/survey-copy-1/edit");
    expect(redirect).toHaveBeenCalledWith("/surveys/survey-copy-1/edit?duplicated=1");
  });
});
