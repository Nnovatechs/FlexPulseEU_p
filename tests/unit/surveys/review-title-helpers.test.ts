import { describe, expect, it } from "vitest";
import {
  buildQuestionTitleLookup,
  getMultilingualIssueQuestionTitle,
} from "@/features/surveys/review-title-helpers";
import { buildTranslationSurveyFixture } from "../../fixtures/surveys/translation/factory";

describe("review title helpers", () => {
  it("prefers the translated question title for multilingual issues", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
      sourceTitle: "I would trust an automated system to shift some household energy use on my behalf.",
      targetTitle: "Confiaria en un sistema automatizado para desplazar parte del consumo energetico del hogar por mi.",
    });

    const canonicalTitleByKey = buildQuestionTitleLookup(
      fixture.questions,
      fixture.sourceTranslations,
    );

    expect(
      getMultilingualIssueQuestionTitle({
        issue: {
          language: fixture.targetLanguage,
          question_key: fixture.question.question_key,
          type: "quality",
          message: "La expresion 'por mi' debe revisarse.",
        },
        canonicalTitleByKey,
        translationsByLanguage: fixture.definition.translations,
      }),
    ).toBe(fixture.targetTranslations.questions[fixture.question.question_key]?.title);
  });

  it("falls back to the canonical title when the translated title is missing", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
    });

    const canonicalTitleByKey = buildQuestionTitleLookup(
      fixture.questions,
      fixture.sourceTranslations,
    );

    fixture.definition.translations[fixture.targetLanguage] = {
      ...fixture.targetTranslations,
      questions: {},
    };

    expect(
      getMultilingualIssueQuestionTitle({
        issue: {
          language: fixture.targetLanguage,
          question_key: fixture.question.question_key,
          type: "quality",
          message: "Texto poco natural.",
        },
        canonicalTitleByKey,
        translationsByLanguage: fixture.definition.translations,
      }),
    ).toBe(fixture.sourceTranslations.questions[fixture.question.question_key]?.title);
  });
});
