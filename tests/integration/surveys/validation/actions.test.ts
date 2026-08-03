import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildValidationSurveyFixture } from "../../../fixtures/surveys/validation/factory";
import { computeContentHash } from "@/features/surveys/content-validator";

// Integration tests for the review/publication flow.
// These tests mock external boundaries but keep the action-level behaviour real,
// so they measure whether the module wiring enforces the intended product rules.
const {
  revalidatePath,
  redirect,
  getOwnedSurveyById,
  updateSurveyDraft,
  publishSurvey,
  runContentValidation,
} = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  getOwnedSurveyById: vi.fn(),
  updateSurveyDraft: vi.fn(),
  publishSurvey: vi.fn(),
  runContentValidation: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/features/surveys/generator-repository", () => ({
  getOwnedSurveyById,
  updateSurveyDraft,
  publishSurvey,
  createSurveyDraft: vi.fn(),
  duplicateOwnedSurvey: vi.fn(),
}));

vi.mock("@/features/surveys/content-validator", async () => {
  const actual = await vi.importActual<typeof import("@/features/surveys/content-validator")>(
    "@/features/surveys/content-validator",
  );

  return {
    ...actual,
    runContentValidation,
  };
});

describe("survey validation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists the validation result produced for the canonical survey content", async () => {
    // This test checks that the review flow saves the validator output into the
    // editable survey definition, which is what later gates publication.
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
      optionLabels: ["Very uncomfortable", "Neutral", "Very comfortable"],
    });

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-1",
      default_language: fixture.language,
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    runContentValidation.mockResolvedValue({
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: "abc123456789def0",
      passed: true,
      issues: [],
    });

    const { validateSurveyContentAction } = await import(
      "@/features/surveys/actions"
    );

    const formData = new FormData();
    formData.set("surveyId", "survey-1");

    await validateSurveyContentAction(formData);

    expect(runContentValidation).toHaveBeenCalledWith(
      fixture.questions,
      fixture.mappings,
      fixture.translations,
      fixture.language,
      fixture.definition.survey_meta.measurement_plan_json,
    );
    expect(updateSurveyDraft).toHaveBeenCalledTimes(1);
    expect(updateSurveyDraft.mock.calls[0]?.[0]).toMatchObject({
      surveyId: "survey-1",
      definition_json: {
        survey_meta: {
          validation_result: {
            content_hash: "abc123456789def0",
            passed: true,
          },
        },
      },
    });
  });

  it("clears the stored validation result when a canonical question is edited", async () => {
    // This test measures stale-validation invalidation after manual editing.
    // If this breaks, users could edit a question and still publish with an old validation.
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
      optionLabels: ["Very uncomfortable", "Neutral", "Very comfortable"],
    });
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.translations),
      passed: true,
      issues: [],
    };
    fixture.definition.survey_meta.multilingual_validation_result = {
      validated_at: "2026-04-01T12:10:00.000Z",
      translation_hash: "translation-hash",
      validated_languages: [fixture.language, "French"],
      passed: true,
      issues: [],
      language_statuses: [
        { language: fixture.language, passed: true, issue_count: 0 },
        { language: "French", passed: true, issue_count: 0 },
      ],
    };
    fixture.definition.survey_meta.expert_review_result = {
      schema_version: 1,
      baseline_content_hash: fixture.definition.survey_meta.validation_result.content_hash,
      baseline_copy_hash: "translation-hash",
      final_content_hash: "expert-final-content-hash",
      final_copy_hash: "expert-final-copy-hash",
      applied_at: "2026-04-01T12:20:00.000Z",
      applied_by_user_id: "user-1",
      reviewer_type: "language_expert",
      review_basis: "Checked by a native reviewer.",
      acknowledgement_version: "v1",
      changes: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-2",
      definition_json: fixture.definition,
    });

    const { updateQuestionTranslationAction } = await import(
      "@/features/surveys/actions"
    );

    const formData = new FormData();
    formData.set("surveyId", "survey-2");
    formData.set("questionKey", "Q_TEST_01");
    formData.set("defaultLanguage", fixture.language);
    formData.set("title", "How confident are you in automated load shifting?");
    formData.set("option_opt_1", "Very uncomfortable");
    formData.set("option_opt_2", "Neutral");
    formData.set("option_opt_3", "Very comfortable");

    await updateQuestionTranslationAction(formData);

    const updatePayload = updateSurveyDraft.mock.calls[0]?.[0];
    expect(updatePayload.surveyId).toBe("survey-2");
    expect(
      updatePayload.definition_json.survey_meta.validation_result,
    ).toBeUndefined();
    expect(
      updatePayload.definition_json.survey_meta.multilingual_validation_result,
    ).toBeUndefined();
    expect(
      updatePayload.definition_json.survey_meta.expert_review_result,
    ).toBeUndefined();
    expect(
      updatePayload.definition_json.translations[fixture.language].questions
        .Q_TEST_01.title,
    ).toBe("How confident are you in automated load shifting?");
  });

  it("blocks publication when the validated hash no longer matches the current content", async () => {
    // This test covers the final backend safety net. Even if the UI somehow
    // shows a green state, publish must fail when the content changed afterward.
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: "outdated-hash",
      passed: true,
      issues: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-3",
      status: "draft",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
    });

    const { publishSurveyAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-3");

    await expect(publishSurveyAction(formData)).rejects.toThrow(
      "Validation result is outdated. Re-run validation after your recent edits.",
    );
    expect(publishSurvey).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("blocks publication when no validation result exists yet", async () => {
    // This is the most basic publication gate: a draft that has never been
    // reviewed must not be publishable even if the rest of the content exists.
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-4",
      status: "draft",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
    });

    const { publishSurveyAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-4");

    await expect(publishSurveyAction(formData)).rejects.toThrow(
      "Survey must pass content validation before publishing.",
    );
    expect(publishSurvey).not.toHaveBeenCalled();
  });

  it("rejects validation when the survey has no generated questions yet", async () => {
    // This covers the empty-state path of the review flow. The user can open the
    // tab before generation, but the backend must fail clearly instead of saving
    // a meaningless validation result for an empty draft.
    const fixture = buildValidationSurveyFixture({
      title: "Temporary placeholder title",
    });
    fixture.definition.questions = [];
    fixture.definition.translations[fixture.language].questions = {};

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-5",
      default_language: fixture.language,
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: [] },
    });

    const { validateSurveyContentAction } = await import(
      "@/features/surveys/actions"
    );

    const formData = new FormData();
    formData.set("surveyId", "survey-5");

    await expect(validateSurveyContentAction(formData)).rejects.toThrow(
      "No questions to validate. Generate the survey first.",
    );
    expect(runContentValidation).not.toHaveBeenCalled();
    expect(updateSurveyDraft).not.toHaveBeenCalled();
  });

  it("rejects validation when expert review has already been applied", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.expert_review_result = {
      schema_version: 1,
      baseline_content_hash: "baseline-content-hash",
      baseline_copy_hash: "baseline-copy-hash",
      final_content_hash: "final-content-hash",
      final_copy_hash: "final-copy-hash",
      applied_at: "2026-07-30T10:00:00.000Z",
      applied_by_user_id: "user-1",
      reviewer_type: "domain_expert",
      review_basis: "Checked by the research team.",
      acknowledgement_version: "v1",
      changes: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-expert-locked-validation",
      status: "draft",
      default_language: fixture.language,
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { validateSurveyContentAction } = await import(
      "@/features/surveys/actions"
    );

    const formData = new FormData();
    formData.set("surveyId", "survey-expert-locked-validation");

    await expect(validateSurveyContentAction(formData)).rejects.toThrow(
      "Validation is locked after expert review. Make a normal edit to clear the expert review snapshot first.",
    );
    expect(runContentValidation).not.toHaveBeenCalled();
  });

  it("persists normalized response context settings when survey configuration is saved", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-6",
      name: "Baseline survey",
      status: "draft",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { updateSurveySettingsAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-6");
    formData.set("name", "Baseline survey");
    formData.set("surveyDescription", "Short intro");
    formData.set("defaultLanguage", fixture.language);
    formData.set("intent", "save");
    formData.set("surveyContextMode", "weather_enriched");
    formData.append("supportedLanguages", fixture.language);

    await updateSurveySettingsAction(formData);

    expect(updateSurveyDraft).toHaveBeenCalledTimes(1);
    expect(updateSurveyDraft.mock.calls[0]?.[0]).toMatchObject({
      surveyId: "survey-6",
      definition_json: {
        survey_meta: {
          response_context: {
            collect_country_code: true,
            collect_postal_code: true,
            enrich_weather_context: true,
            postal_collection_mode: "full",
          },
        },
      },
    });
  });

  it("keeps the measurement plan unchanged when only response context settings are saved", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
      questionIntent: {
        facet: "delegation",
        intent: "Measure willingness to delegate.",
        polarity: "positive",
      },
    });
    fixture.definition.survey_meta.measurement_plan_json = {
      ...fixture.measurementPlan,
      concepts: [
        {
          ...fixture.measurementPlan.concepts[0],
          aggregation_rule: "mean",
        },
      ],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-7",
      name: "Baseline survey",
      status: "draft",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { updateSurveySettingsAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-7");
    formData.set("name", "Baseline survey");
    formData.set("surveyDescription", "Short intro");
    formData.set("defaultLanguage", fixture.language);
    formData.set("intent", "save");
    formData.set("surveyContextMode", "full_postal");
    formData.append("supportedLanguages", fixture.language);

    await updateSurveySettingsAction(formData);

    expect(updateSurveyDraft).toHaveBeenCalledTimes(1);
    expect(
      updateSurveyDraft.mock.calls[0]?.[0].definition_json.survey_meta.measurement_plan_json,
    ).toEqual(fixture.definition.survey_meta.measurement_plan_json);
    expect(
      updateSurveyDraft.mock.calls[0]?.[0].definition_json.survey_meta.measurement_plan_json
        ?.concepts[0]?.aggregation_rule,
    ).toBe("mean");
  });

  it("preserves validation, multilingual validation and expert review when only name and survey context change", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.translations[fixture.language].survey_description = "Original intro";
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-08-01T09:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.translations),
      passed: true,
      issues: [],
    };
    fixture.definition.survey_meta.multilingual_validation_result = {
      validated_at: "2026-08-01T09:01:00.000Z",
      translation_hash: "translation-hash-1",
      validated_languages: [fixture.language],
      passed: true,
      issues: [],
      language_statuses: [
        {
          language: fixture.language,
          passed: true,
          issue_count: 0,
        },
      ],
    };
    fixture.definition.survey_meta.expert_review_result = {
      schema_version: 1,
      acknowledgement_version: "v1",
      reviewer_type: "language_expert",
      review_basis: "Checked wording.",
      changes: [],
      baseline_content_hash: "content-hash-1",
      baseline_copy_hash: "copy-hash-1",
      final_content_hash: "content-hash-1",
      final_copy_hash: "copy-hash-1",
      applied_at: "2026-08-01T09:02:00.000Z",
      applied_by_user_id: "user-1",
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-8",
      name: "Baseline survey",
      status: "draft",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { updateSurveySettingsAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-8");
    formData.set("name", "Baseline survey renamed");
    formData.set("surveyDescription", "Original intro");
    formData.set("defaultLanguage", fixture.language);
    formData.set("intent", "save");
    formData.set("surveyContextMode", "country_only");
    formData.append("supportedLanguages", fixture.language);

    await updateSurveySettingsAction(formData);

    expect(updateSurveyDraft).toHaveBeenCalledTimes(1);
    expect(updateSurveyDraft.mock.calls[0]?.[0]).toMatchObject({
      surveyId: "survey-8",
      name: "Baseline survey renamed",
      definition_json: {
        survey_meta: {
          validation_result: fixture.definition.survey_meta.validation_result,
          multilingual_validation_result:
            fixture.definition.survey_meta.multilingual_validation_result,
          expert_review_result: fixture.definition.survey_meta.expert_review_result,
          response_context: {
            collect_country_code: true,
            collect_postal_code: false,
            enrich_weather_context: false,
            postal_collection_mode: "full",
          },
        },
      },
    });
  });

  it("clears stored snapshots when the visible survey description changes", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.translations[fixture.language].survey_description = "Original intro";
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-08-01T09:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.translations),
      passed: true,
      issues: [],
    };
    fixture.definition.survey_meta.multilingual_validation_result = {
      validated_at: "2026-08-01T09:01:00.000Z",
      translation_hash: "translation-hash-1",
      validated_languages: [fixture.language],
      passed: true,
      issues: [],
      language_statuses: [
        {
          language: fixture.language,
          passed: true,
          issue_count: 0,
        },
      ],
    };
    fixture.definition.survey_meta.expert_review_result = {
      schema_version: 1,
      acknowledgement_version: "v1",
      reviewer_type: "language_expert",
      review_basis: "Checked wording.",
      changes: [],
      baseline_content_hash: "content-hash-1",
      baseline_copy_hash: "copy-hash-1",
      final_content_hash: "content-hash-1",
      final_copy_hash: "copy-hash-1",
      applied_at: "2026-08-01T09:02:00.000Z",
      applied_by_user_id: "user-1",
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-9",
      name: "Baseline survey",
      status: "draft",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { updateSurveySettingsAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-9");
    formData.set("name", "Baseline survey");
    formData.set("surveyDescription", "Updated intro");
    formData.set("defaultLanguage", fixture.language);
    formData.set("intent", "save");
    formData.set("surveyContextMode", "country_only");
    formData.append("supportedLanguages", fixture.language);

    await updateSurveySettingsAction(formData);

    expect(updateSurveyDraft).toHaveBeenCalledTimes(1);
    expect(updateSurveyDraft.mock.calls[0]?.[0].definition_json.survey_meta).toMatchObject({
      response_context: {
        collect_country_code: true,
        collect_postal_code: false,
        enrich_weather_context: false,
        postal_collection_mode: "full",
      },
    });
    expect(
      updateSurveyDraft.mock.calls[0]?.[0].definition_json.survey_meta.validation_result,
    ).toBeUndefined();
    expect(
      updateSurveyDraft.mock.calls[0]?.[0].definition_json.survey_meta
        .multilingual_validation_result,
    ).toBeUndefined();
    expect(
      updateSurveyDraft.mock.calls[0]?.[0].definition_json.survey_meta.expert_review_result,
    ).toBeUndefined();
  });
});
