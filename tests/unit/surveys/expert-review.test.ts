import { describe, expect, it } from "vitest";
import { computeContentHash } from "@/features/surveys/content-validator";
import {
  applyExpertReviewChanges,
  computeSurveyCopyHash,
  getSurveyIntegrityState,
  normalizeExpertReviewBatch,
} from "@/features/surveys/expert-review";
import { buildTranslationSurveyFixture } from "../../fixtures/surveys/translation/factory";
import { buildValidationSurveyFixture } from "../../fixtures/surveys/validation/factory";

describe("expert review helpers", () => {
  it("normalizes and deduplicates expert review changes deterministically", () => {
    const normalized = normalizeExpertReviewBatch([
      {
        language: "French",
        field: "question_title",
        question_key: "Q_TEST_01",
        reviewed_value: " Version 1 ",
      },
      {
        language: "French",
        field: "question_title",
        question_key: "Q_TEST_01",
        reviewed_value: "Version 2",
      },
      {
        language: "English",
        field: "survey_title",
        reviewed_value: "  Energy survey  ",
      },
    ]);

    expect(normalized).toEqual([
      {
        key: "English::survey::survey_title::",
        language: "English",
        target: "survey",
        question_key: undefined,
        field: "survey_title",
        reviewed_value: "Energy survey",
      },
      {
        key: "French::question::question_title::Q_TEST_01",
        language: "French",
        target: "question",
        question_key: "Q_TEST_01",
        field: "question_title",
        reviewed_value: "Version 2",
      },
    ]);
  });

  it("reports expert-reviewed surveys as publishable through final hashes", () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
      questionIntent: {
        facet: "confidence",
        intent: "Assess comfort with automation",
        polarity: "positive",
      },
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

    const integrity = getSurveyIntegrityState({
      definition: reviewed.definition,
      defaultLanguage: fixture.language,
      supportedLanguages: [fixture.language],
    });

    expect(integrity.automatic_content_current).toBe(false);
    expect(integrity.expert_review_baseline_linked).toBe(true);
    expect(integrity.expert_review_final_current).toBe(true);
    expect(integrity.can_publish_expert_reviewed).toBe(true);
  });

  it("links multilingual expert review baselines to stored translation hashes", () => {
    const fixture = buildTranslationSurveyFixture();
    const baselineCopyHash = computeSurveyCopyHash(fixture.definition, [
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
      translation_hash: baselineCopyHash,
      validated_languages: [fixture.sourceLanguage, fixture.targetLanguage],
      passed: true,
      issues: [],
      language_statuses: [
        { language: fixture.sourceLanguage, passed: true, issue_count: 0 },
        { language: fixture.targetLanguage, passed: true, issue_count: 0 },
      ],
    };

    const reviewed = applyExpertReviewChanges({
      definition: fixture.definition,
      supportedLanguages: [fixture.sourceLanguage, fixture.targetLanguage],
      normalizedChanges: [
        {
          key: "French::question::question_title::Q_TEST_01",
          language: fixture.targetLanguage,
          target: "question",
          question_key: "Q_TEST_01",
          field: "question_title",
          reviewed_value: "Quel est votre niveau de confiance dans le pilotage automatise ?",
        },
      ],
      reviewerType: "language_expert",
      reviewBasis: "Reviewed by a native French linguist.",
      appliedByUserId: "user-1",
      appliedAt: "2026-07-30T10:05:00.000Z",
    });

    const integrity = getSurveyIntegrityState({
      definition: reviewed.definition,
      defaultLanguage: fixture.sourceLanguage,
      supportedLanguages: [fixture.sourceLanguage, fixture.targetLanguage],
    });

    expect(
      reviewed.result.baseline_copy_hash,
    ).toBe(fixture.definition.survey_meta.multilingual_validation_result.translation_hash);
    expect(integrity.expert_review_baseline_linked).toBe(true);
    expect(integrity.can_publish_expert_reviewed).toBe(true);
  });
});
