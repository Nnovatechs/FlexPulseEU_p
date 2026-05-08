import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeContentHash } from "@/features/surveys/content-validator";
import { buildTranslationSurveyFixture } from "../../../fixtures/surveys/translation/factory";

// Integration coverage for the multilingual review stage. These tests keep the
// action logic real while mocking external LLM/service boundaries.
const {
  revalidatePath,
  redirect,
  getOwnedSurveyById,
  updateSurveyDraft,
  publishSurvey,
  translateSurveyLanguage,
  polishSurveyLanguage,
  validateTranslatedSurveyLanguage,
} = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  getOwnedSurveyById: vi.fn(),
  updateSurveyDraft: vi.fn(),
  publishSurvey: vi.fn(),
  translateSurveyLanguage: vi.fn(),
  polishSurveyLanguage: vi.fn(),
  validateTranslatedSurveyLanguage: vi.fn(),
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
}));

vi.mock("@/features/surveys/translation-service", () => ({
  translateSurveyLanguage,
}));

vi.mock("@/features/surveys/translation-polish", () => ({
  polishSurveyLanguage,
}));

vi.mock("@/features/surveys/translation-validation", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/surveys/translation-validation")>(
      "@/features/surveys/translation-validation"
    );

  return {
    ...actual,
    validateTranslatedSurveyLanguage,
  };
});

describe("survey translation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists translated bundles and multilingual validation result", async () => {
    // This checks the core step-2 contract: once canonical validation passed,
    // translation output and multilingual audit results must be saved together.
    const fixture = buildTranslationSurveyFixture();
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: computeContentHash(
        fixture.questions,
        fixture.sourceTranslations,
      ),
      passed: true,
      issues: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-translation-1",
      name: "Energy flexibility survey",
      default_language: fixture.sourceLanguage,
      supported_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    translateSurveyLanguage.mockResolvedValue(fixture.targetTranslations);
    polishSurveyLanguage.mockResolvedValue(fixture.targetTranslations);
    validateTranslatedSurveyLanguage.mockResolvedValue([]);

    const { generateSurveyTranslationsAction } = await import(
      "@/features/surveys/actions"
    );

    const formData = new FormData();
    formData.set("surveyId", "survey-translation-1");

    await generateSurveyTranslationsAction(formData);

    expect(translateSurveyLanguage).toHaveBeenCalledTimes(1);
    expect(polishSurveyLanguage).toHaveBeenCalledTimes(1);
    expect(validateTranslatedSurveyLanguage).toHaveBeenCalledTimes(1);
    expect(updateSurveyDraft).toHaveBeenCalledTimes(1);

    const updatePayload = updateSurveyDraft.mock.calls[0]?.[0];
    expect(updatePayload.surveyId).toBe("survey-translation-1");
    expect(
      updatePayload.definition_json.translations[fixture.targetLanguage].questions
        .Q_TEST_01.title,
    ).toBe(fixture.targetTranslations.questions.Q_TEST_01.title);
    expect(
      updatePayload.definition_json.survey_meta.multilingual_validation_result,
    ).toMatchObject({
      passed: true,
      validated_languages: [fixture.sourceLanguage, fixture.targetLanguage],
    });
  });

  it("retries translation with validator feedback until the language passes", async () => {
    const fixture = buildTranslationSurveyFixture();
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: computeContentHash(
        fixture.questions,
        fixture.sourceTranslations,
      ),
      passed: true,
      issues: [],
    };

    const revisedTranslation = {
      ...fixture.targetTranslations,
      questions: {
        ...fixture.targetTranslations.questions,
        Q_TEST_01: {
          ...fixture.targetTranslations.questions.Q_TEST_01,
          title:
            "Quel est votre niveau de confort vis-a-vis du pilotage automatise de la consommation ?",
        },
      },
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-translation-retry-1",
      name: "Energy flexibility survey",
      default_language: fixture.sourceLanguage,
      supported_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    translateSurveyLanguage.mockResolvedValueOnce(fixture.targetTranslations);
    polishSurveyLanguage
      .mockResolvedValueOnce(fixture.targetTranslations)
      .mockResolvedValueOnce(revisedTranslation);
    validateTranslatedSurveyLanguage
      .mockResolvedValueOnce([
        {
          language: fixture.targetLanguage,
          question_key: "Q_TEST_01",
          type: "quality",
          message: "La formulacion suena poco natural.",
        },
      ])
      .mockResolvedValueOnce([]);

    const { generateSurveyTranslationsAction } = await import(
      "@/features/surveys/actions"
    );

    const formData = new FormData();
    formData.set("surveyId", "survey-translation-retry-1");

    await generateSurveyTranslationsAction(formData);

    expect(translateSurveyLanguage).toHaveBeenCalledTimes(1);
    expect(polishSurveyLanguage).toHaveBeenCalledTimes(2);
    expect(validateTranslatedSurveyLanguage).toHaveBeenCalledTimes(2);
    expect(polishSurveyLanguage.mock.calls[1]?.[0]).toMatchObject({
      draftTranslations: fixture.targetTranslations,
      validationIssues: [
        {
          language: fixture.targetLanguage,
          question_key: "Q_TEST_01",
          type: "quality",
        },
      ],
    });

    const updatePayload = updateSurveyDraft.mock.calls[0]?.[0];
    expect(
      updatePayload.definition_json.translations[fixture.targetLanguage].questions
        .Q_TEST_01.title,
    ).toBe(revisedTranslation.questions.Q_TEST_01.title);
    expect(
      updatePayload.definition_json.survey_meta.multilingual_validation_result,
    ).toMatchObject({
      passed: true,
    });
  });

  it("stops retrying after the maximum refinement attempts", async () => {
    const fixture = buildTranslationSurveyFixture();
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: computeContentHash(
        fixture.questions,
        fixture.sourceTranslations,
      ),
      passed: true,
      issues: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-translation-retry-2",
      name: "Energy flexibility survey",
      default_language: fixture.sourceLanguage,
      supported_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    translateSurveyLanguage.mockResolvedValueOnce(fixture.targetTranslations);
    polishSurveyLanguage.mockResolvedValue(fixture.targetTranslations);
    validateTranslatedSurveyLanguage.mockResolvedValue([
      {
        language: fixture.targetLanguage,
        question_key: "Q_TEST_01",
        type: "quality",
        message: "Sigue sonando poco natural.",
      },
    ]);

    const { generateSurveyTranslationsAction } = await import(
      "@/features/surveys/actions"
    );

    const formData = new FormData();
    formData.set("surveyId", "survey-translation-retry-2");

    await generateSurveyTranslationsAction(formData);

    expect(translateSurveyLanguage).toHaveBeenCalledTimes(1);
    expect(polishSurveyLanguage).toHaveBeenCalledTimes(3);
    expect(validateTranslatedSurveyLanguage).toHaveBeenCalledTimes(3);

    const updatePayload = updateSurveyDraft.mock.calls[0]?.[0];
    expect(
      updatePayload.definition_json.survey_meta.multilingual_validation_result,
    ).toMatchObject({
      passed: true,
      issues: [
        {
          language: fixture.targetLanguage,
          question_key: "Q_TEST_01",
          type: "quality",
          severity: "advisory",
          message: "This wording may be worth reviewing for respondent clarity.",
        },
      ],
    });
  });

  it("uses advisory translation findings for retries but stores product-safe recommendations", async () => {
    const fixture = buildTranslationSurveyFixture();
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: computeContentHash(
        fixture.questions,
        fixture.sourceTranslations,
      ),
      passed: true,
      issues: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-translation-advisory-1",
      name: "Energy flexibility survey",
      default_language: fixture.sourceLanguage,
      supported_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    translateSurveyLanguage.mockResolvedValueOnce(fixture.targetTranslations);
    polishSurveyLanguage.mockResolvedValue(fixture.targetTranslations);
    validateTranslatedSurveyLanguage.mockResolvedValue([
      {
        language: fixture.targetLanguage,
        question_key: "Q_TEST_01",
        type: "quality",
        severity: "advisory",
        message: "The option labels could be clearer for respondents.",
        recommendation: "Use simpler household wording.",
      },
    ]);

    const { generateSurveyTranslationsAction } = await import(
      "@/features/surveys/actions"
    );

    const formData = new FormData();
    formData.set("surveyId", "survey-translation-advisory-1");

    await generateSurveyTranslationsAction(formData);

    expect(translateSurveyLanguage).toHaveBeenCalledTimes(1);
    expect(polishSurveyLanguage).toHaveBeenCalledTimes(3);
    expect(validateTranslatedSurveyLanguage).toHaveBeenCalledTimes(3);

    const updatePayload = updateSurveyDraft.mock.calls[0]?.[0];
    expect(
      updatePayload.definition_json.survey_meta.multilingual_validation_result,
    ).toMatchObject({
      passed: true,
      issues: [
        {
          language: fixture.targetLanguage,
          question_key: "Q_TEST_01",
          type: "quality",
          severity: "advisory",
          message: "This wording may be worth reviewing for respondent clarity.",
        },
      ],
      language_statuses: [
        { language: fixture.sourceLanguage, passed: true, issue_count: 0 },
        { language: fixture.targetLanguage, passed: true, issue_count: 0 },
      ],
    });
  });

  it("rejects translation generation when canonical validation is outdated", async () => {
    // This protects the sequential workflow: step 2 must not run on content that
    // changed after the canonical validation hash was issued.
    const fixture = buildTranslationSurveyFixture();
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: "outdated-content-hash",
      passed: true,
      issues: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-translation-2",
      default_language: fixture.sourceLanguage,
      supported_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { generateSurveyTranslationsAction } = await import(
      "@/features/surveys/actions"
    );

    const formData = new FormData();
    formData.set("surveyId", "survey-translation-2");

    await expect(generateSurveyTranslationsAction(formData)).rejects.toThrow(
      "Content validation is outdated. Re-run content validation before generating translations.",
    );
    expect(translateSurveyLanguage).not.toHaveBeenCalled();
    expect(updateSurveyDraft).not.toHaveBeenCalled();
  });

  it("blocks publication when multilingual validation is missing for a multi-language survey", async () => {
    // This enforces the new backend publication gate for surveys with more than
    // one supported language.
    const fixture = buildTranslationSurveyFixture();
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: computeContentHash(
        fixture.questions,
        fixture.sourceTranslations,
      ),
      passed: true,
      issues: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-translation-3",
      default_language: fixture.sourceLanguage,
      supported_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      definition_json: fixture.definition,
    });

    const { publishSurveyAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-translation-3");

    await expect(publishSurveyAction(formData)).rejects.toThrow(
      "Survey must pass multilingual validation before publishing.",
    );
    expect(publishSurvey).not.toHaveBeenCalled();
  });

  it("blocks publication when multilingual validation hash is outdated", async () => {
    // This covers the last stale-state guard on localized content itself.
    const fixture = buildTranslationSurveyFixture();
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: computeContentHash(
        fixture.questions,
        fixture.sourceTranslations,
      ),
      passed: true,
      issues: [],
    };
    fixture.definition.survey_meta.multilingual_validation_result = {
      validated_at: "2026-04-01T12:05:00.000Z",
      translation_hash: "outdated-translation-hash",
      validated_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      passed: true,
      issues: [],
      language_statuses: [
        { language: fixture.sourceLanguage, passed: true, issue_count: 0 },
        { language: fixture.targetLanguage, passed: true, issue_count: 0 },
      ],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-translation-4",
      default_language: fixture.sourceLanguage,
      supported_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      definition_json: fixture.definition,
    });

    const { publishSurveyAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-translation-4");

    await expect(publishSurveyAction(formData)).rejects.toThrow(
      "Multilingual validation is outdated. Re-run translation validation before publishing.",
    );
    expect(publishSurvey).not.toHaveBeenCalled();
  });

  it("allows publication without multilingual validation when only the canonical language is selected", async () => {
    // Single-language surveys should not be forced through a fake translation
    // step. The backend should still publish when canonical validation is current.
    const fixture = buildTranslationSurveyFixture();
    fixture.definition.survey_meta.supported_languages = [fixture.sourceLanguage];
    delete fixture.definition.translations[fixture.targetLanguage];
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-04-01T12:00:00.000Z",
      content_hash: computeContentHash(
        fixture.questions,
        fixture.sourceTranslations,
      ),
      passed: true,
      issues: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-translation-5",
      created_by: "user-1",
      default_language: fixture.sourceLanguage,
      supported_languages: [fixture.sourceLanguage],
      definition_json: fixture.definition,
    });
    publishSurvey.mockResolvedValue({
      id: "survey-translation-5",
    });

    const { publishSurveyAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-translation-5");

    await publishSurveyAction(formData);

    expect(publishSurvey).toHaveBeenCalledWith("survey-translation-5");
    expect(redirect).toHaveBeenCalled();
  });
});
