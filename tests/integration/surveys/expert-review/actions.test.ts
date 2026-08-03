import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeContentHash } from "@/features/surveys/content-validator";
import { applyExpertReviewChanges } from "@/features/surveys/expert-review";
import { computeMultilingualTranslationHash } from "@/features/surveys/translation-validation";
import { buildTranslationSurveyFixture } from "../../../fixtures/surveys/translation/factory";
import { buildValidationSurveyFixture } from "../../../fixtures/surveys/validation/factory";

const {
  revalidatePath,
  redirect,
  getOwnedSurveyById,
  updateSurveyDraft,
  publishSurvey,
  getCurrentOwnerLegalProfile,
  prepareSurveyLegalSnapshot,
  getCurrentDpaAcceptance,
} = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  getOwnedSurveyById: vi.fn(),
  updateSurveyDraft: vi.fn(),
  publishSurvey: vi.fn(),
  getCurrentOwnerLegalProfile: vi.fn(),
  prepareSurveyLegalSnapshot: vi.fn(),
  getCurrentDpaAcceptance: vi.fn(),
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
  duplicateOwnedSurvey: vi.fn(),
  createSurveyDraft: vi.fn(),
  deleteOwnedSurveyDraft: vi.fn(),
  archiveOwnedSurvey: vi.fn(),
}));

vi.mock("@/features/privacy/repository", () => ({
  getCurrentOwnerLegalProfile,
  prepareSurveyLegalSnapshot,
}));

vi.mock("@/features/privacy/dpa-repository", () => ({
  getCurrentDpaAcceptance,
}));

describe("expert review actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DPA_REQUIRED", "0");
    getCurrentOwnerLegalProfile.mockResolvedValue({
      userId: "user-1",
      controllerName: "Example Research Institute",
      controllerCountry: "Spain",
      contactEmail: "research@example.eu",
      privacyEmail: "privacy@example.eu",
      dpoEmail: null,
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });
    prepareSurveyLegalSnapshot.mockResolvedValue({});
  });

  it("stores an applied expert review even when no text changes were needed", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-07-30T10:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.translations),
      passed: true,
      issues: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-expert-1",
      status: "draft",
      created_by: "user-1",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { applyExpertReviewAction } = await import(
      "@/features/surveys/actions"
    );

    const result = await applyExpertReviewAction({
      surveyId: "survey-expert-1",
      reviewerType: "language_expert",
      reviewBasis: "Reviewed with a native English linguist.",
      confirmation: "EXPERT REVIEW",
      changes: [],
    });

    expect(result).toEqual({ appliedChangeCount: 0 });
    const updatePayload = updateSurveyDraft.mock.calls[0]?.[0];
    expect(updatePayload.definition_json.survey_meta.expert_review_result).toMatchObject({
      reviewer_type: "language_expert",
      review_basis: "Reviewed with a native English linguist.",
      changes: [],
    });
    expect(
      updatePayload.definition_json.survey_meta.expert_review_result
        .baseline_content_hash,
    ).toBe(
      updatePayload.definition_json.survey_meta.expert_review_result
        .final_content_hash,
    );
    expect(
      updatePayload.definition_json.survey_meta.expert_review_result
        .baseline_copy_hash,
    ).toBe(
      updatePayload.definition_json.survey_meta.expert_review_result.final_copy_hash,
    );
  });

  it("applies multilingual expert review changes without deleting automatic results", async () => {
    const fixture = buildTranslationSurveyFixture();
    const translationHash = computeMultilingualTranslationHash(fixture.definition, [
      fixture.sourceLanguage,
      fixture.targetLanguage,
    ]);

    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-07-30T10:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.sourceTranslations),
      passed: true,
      issues: [],
    };
    fixture.definition.survey_meta.multilingual_validation_result = {
      validated_at: "2026-07-30T10:01:00.000Z",
      translation_hash: translationHash,
      validated_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      passed: true,
      issues: [],
      language_statuses: [
        { language: fixture.sourceLanguage, passed: true, issue_count: 0 },
        { language: fixture.targetLanguage, passed: true, issue_count: 0 },
      ],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-expert-2",
      status: "draft",
      created_by: "user-1",
      default_language: fixture.sourceLanguage,
      supported_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { applyExpertReviewAction } = await import(
      "@/features/surveys/actions"
    );

    await applyExpertReviewAction({
      surveyId: "survey-expert-2",
      reviewerType: "language_expert",
      reviewBasis: "Reviewed with a native French linguist.",
      confirmation: "EXPERT REVIEW",
      changes: [
        {
          language: fixture.targetLanguage,
          field: "question_title",
          question_key: "Q_TEST_01",
          reviewed_value: "Quel est votre niveau de confiance dans le pilotage automatise ?",
        },
      ],
    });

    const updatePayload = updateSurveyDraft.mock.calls[0]?.[0];
    expect(updatePayload.definition_json.survey_meta.validation_result).toMatchObject({
      passed: true,
    });
    expect(
      updatePayload.definition_json.survey_meta.multilingual_validation_result,
    ).toMatchObject({
      passed: true,
      translation_hash: translationHash,
    });
    expect(updatePayload.definition_json.survey_meta.expert_review_result).toMatchObject({
      baseline_copy_hash: translationHash,
      changes: [
        expect.objectContaining({
          language: fixture.targetLanguage,
          field: "question_title",
          question_key: "Q_TEST_01",
        }),
      ],
    });
  });

  it("allows applying expert review again while preserving the automatic baseline", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-07-30T10:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.translations),
      passed: true,
      issues: [],
    };

    const firstReview = applyExpertReviewChanges({
      definition: fixture.definition,
      supportedLanguages: [fixture.language],
      normalizedChanges: [
        {
          key: "English::question::question_title::Q_TEST_01",
          language: fixture.language,
          target: "question",
          question_key: "Q_TEST_01",
          field: "question_title",
          reviewed_value: "How confident are you in automated load shifting?",
        },
      ],
      reviewerType: "domain_expert",
      reviewBasis: "First expert review round.",
      appliedByUserId: "user-1",
      appliedAt: "2026-07-30T10:05:00.000Z",
    });

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-expert-repeat",
      status: "draft",
      created_by: "user-1",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: firstReview.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { applyExpertReviewAction } = await import(
      "@/features/surveys/actions"
    );

    const result = await applyExpertReviewAction({
      surveyId: "survey-expert-repeat",
      reviewerType: "research_team",
      reviewBasis: "Second expert review round.",
      confirmation: "EXPERT REVIEW",
      changes: [
        {
          language: fixture.language,
          field: "question_title",
          question_key: "Q_TEST_01",
          reviewed_value: "How comfortable are you with automated load shifting overall?",
        },
      ],
    });

    expect(result).toEqual({ appliedChangeCount: 1 });
    const updatePayload = updateSurveyDraft.mock.calls[0]?.[0];
    expect(updatePayload.definition_json.survey_meta.validation_result).toMatchObject({
      passed: true,
    });
    expect(updatePayload.definition_json.survey_meta.expert_review_result).toMatchObject({
      baseline_content_hash: firstReview.result.baseline_content_hash,
      baseline_copy_hash: firstReview.result.baseline_copy_hash,
      reviewer_type: "research_team",
      review_basis: "Second expert review round.",
      changes: [
        expect.objectContaining({
          question_key: "Q_TEST_01",
          previous_value: "How confident are you in automated load shifting?",
          reviewed_value:
            "How comfortable are you with automated load shifting overall?",
        }),
      ],
    });
  });

  it("rejects expert review when reviewer type is invalid at runtime", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-07-30T10:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.translations),
      passed: true,
      issues: [],
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-expert-invalid-reviewer",
      status: "draft",
      created_by: "user-1",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { applyExpertReviewAction } = await import(
      "@/features/surveys/actions"
    );

    await expect(
      applyExpertReviewAction({
        surveyId: "survey-expert-invalid-reviewer",
        reviewerType: "other" as never,
        reviewBasis: "Reviewed internally.",
        confirmation: "EXPERT REVIEW",
        changes: [],
      }),
    ).rejects.toThrow("Reviewer type is invalid.");
    expect(updateSurveyDraft).not.toHaveBeenCalled();
  });

  it("rejects question title changes for keys outside the survey definition", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-07-30T10:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.translations),
      passed: true,
      issues: [],
    };
    fixture.definition.translations[fixture.language].questions.Q_GHOST = {
      title: "Ghost question title",
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-expert-invalid-question",
      status: "draft",
      created_by: "user-1",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { applyExpertReviewAction } = await import(
      "@/features/surveys/actions"
    );

    await expect(
      applyExpertReviewAction({
        surveyId: "survey-expert-invalid-question",
        reviewerType: "domain_expert",
        reviewBasis: "Reviewed internally.",
        confirmation: "EXPERT REVIEW",
        changes: [
          {
            language: fixture.language,
            field: "question_title",
            question_key: "Q_GHOST",
            reviewed_value: "Updated ghost title",
          },
        ],
      }),
    ).rejects.toThrow('Question "Q_GHOST" is not part of the survey definition.');
    expect(updateSurveyDraft).not.toHaveBeenCalled();
  });

  it("publishes the final expert-reviewed version when automatic baseline linkage is preserved", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-07-30T10:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.translations),
      passed: true,
      issues: [],
    };

    const reviewed = applyExpertReviewChanges({
      definition: fixture.definition,
      supportedLanguages: [fixture.language],
      normalizedChanges: [
        {
          key: "English::question::question_title::Q_TEST_01",
          language: fixture.language,
          target: "question",
          question_key: "Q_TEST_01",
          field: "question_title",
          reviewed_value: "How confident are you in automated load shifting?",
        },
      ],
      reviewerType: "domain_expert",
      reviewBasis: "Checked by the energy behaviour research team.",
      appliedByUserId: "user-1",
      appliedAt: "2026-07-30T10:05:00.000Z",
    });

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-expert-3",
      status: "draft",
      created_by: "user-1",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: reviewed.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { publishSurveyAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-expert-3");

    await publishSurveyAction(formData);

    expect(prepareSurveyLegalSnapshot).toHaveBeenCalledWith(
      "survey-expert-3",
      "user-1",
    );
    expect(publishSurvey).toHaveBeenCalledWith("survey-expert-3");
  });

  it("rejects publication when the current survey no longer matches the frozen expert-reviewed final hashes", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-07-30T10:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.translations),
      passed: true,
      issues: [],
    };

    const reviewed = applyExpertReviewChanges({
      definition: fixture.definition,
      supportedLanguages: [fixture.language],
      normalizedChanges: [
        {
          key: "English::question::question_title::Q_TEST_01",
          language: fixture.language,
          target: "question",
          question_key: "Q_TEST_01",
          field: "question_title",
          reviewed_value: "How confident are you in automated load shifting?",
        },
      ],
      reviewerType: "domain_expert",
      reviewBasis: "Checked by the energy behaviour research team.",
      appliedByUserId: "user-1",
      appliedAt: "2026-07-30T10:05:00.000Z",
    });
    reviewed.definition.translations[fixture.language].questions.Q_TEST_01.title =
      "Mutated after expert review";

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-expert-4",
      status: "draft",
      created_by: "user-1",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: reviewed.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { publishSurveyAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-expert-4");

    await expect(publishSurveyAction(formData)).rejects.toThrow(
      "Expert-reviewed content is outdated. Re-apply expert review or make a normal edit and validate again.",
    );
    expect(publishSurvey).not.toHaveBeenCalled();
  });

  it("rejects publication when the expert review baseline no longer links to the automatic baseline", async () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
    });
    fixture.definition.survey_meta.validation_result = {
      validated_at: "2026-07-30T10:00:00.000Z",
      content_hash: computeContentHash(fixture.questions, fixture.translations),
      passed: true,
      issues: [],
    };

    const reviewed = applyExpertReviewChanges({
      definition: fixture.definition,
      supportedLanguages: [fixture.language],
      normalizedChanges: [],
      reviewerType: "domain_expert",
      reviewBasis: "Checked by the energy behaviour research team.",
      appliedByUserId: "user-1",
      appliedAt: "2026-07-30T10:05:00.000Z",
    });
    reviewed.definition.survey_meta.validation_result = {
      ...reviewed.definition.survey_meta.validation_result!,
      content_hash: "different-baseline-hash",
    };

    getOwnedSurveyById.mockResolvedValue({
      id: "survey-expert-5",
      status: "draft",
      created_by: "user-1",
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: reviewed.definition,
      mapping_contract_json: { schema_version: 1, mappings: fixture.mappings },
    });

    const { publishSurveyAction } = await import("@/features/surveys/actions");

    const formData = new FormData();
    formData.set("surveyId", "survey-expert-5");

    await expect(publishSurveyAction(formData)).rejects.toThrow(
      "Expert review baseline is no longer linked to the validated automatic baseline.",
    );
    expect(publishSurvey).not.toHaveBeenCalled();
  });
});
