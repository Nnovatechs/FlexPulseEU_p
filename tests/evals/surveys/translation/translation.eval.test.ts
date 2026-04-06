import { describe, expect, it } from "vitest";
import { validateTranslatedSurveyLanguage } from "@/features/surveys/translation-validation";
import { buildTranslationSurveyFixture } from "../../../fixtures/surveys/translation/factory";
import {
  translationEvalFixtures,
  type TranslationEvalFixture,
} from "../../../fixtures/surveys/translation/llm-eval-fixtures";

// Translation evals are product-behaviour checks that depend on a real model.
const describeWithOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;

function buildEvalCase(fixture: TranslationEvalFixture) {
  return buildTranslationSurveyFixture({
    sourceLanguage: fixture.sourceLanguage,
    targetLanguage: fixture.targetLanguage,
    sourceTitle: fixture.sourceTitle,
    targetTitle: fixture.targetTitle,
    sourceDescription: fixture.sourceDescription,
    targetDescription: fixture.targetDescription,
    optionLabels: fixture.optionLabels,
    translatedOptionLabels: fixture.translatedOptionLabels,
  });
}

describeWithOpenAI("survey translation product evals", () => {
  it("runs only when an OpenAI key is available", () => {
    expect(Boolean(process.env.OPENAI_API_KEY)).toBe(true);
  });

  it.each(translationEvalFixtures)(
    "$id",
    async (fixture) => {
      const surveyFixture = buildEvalCase(fixture);

      const issues = await validateTranslatedSurveyLanguage({
        sourceLanguage: surveyFixture.sourceLanguage,
        targetLanguage: surveyFixture.targetLanguage,
        sourceTranslations: surveyFixture.sourceTranslations,
        targetTranslations: surveyFixture.targetTranslations,
        questions: surveyFixture.questions,
        mappings: surveyFixture.mappings,
      });

      expect(
        {
          purpose: fixture.purpose,
          passed: issues.length === 0,
          issues,
        },
        fixture.purpose,
      ).toMatchObject({
        passed: fixture.expectedOverall === "pass",
      });
    },
    120_000,
  );
});
