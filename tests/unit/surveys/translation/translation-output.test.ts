import { describe, expect, it } from "vitest";
import { parseSurveyLanguageLLMOutput } from "@/features/surveys/translation-output";
import { buildTranslationSurveyFixture } from "../../../fixtures/surveys/translation/factory";

describe("parseSurveyLanguageLLMOutput", () => {
  it("maps a valid LLM payload into survey translations", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
    });

    const result = parseSurveyLanguageLLMOutput({
      content: JSON.stringify({
        survey_title: fixture.targetTranslations.survey_title,
        survey_description: fixture.targetTranslations.survey_description ?? "",
        questions: [
          {
            question_key: fixture.question.question_key,
            title: fixture.targetTranslations.questions[fixture.question.question_key].title,
            description:
              fixture.targetTranslations.questions[fixture.question.question_key].description ??
              "",
            options: Object.entries(
              fixture.targetTranslations.questions[fixture.question.question_key].options ?? {},
            ).map(([option_key, label]) => ({ option_key, label })),
          },
        ],
      }),
      refusal: null,
      questions: fixture.questions,
      targetLanguage: fixture.targetLanguage,
      operationLabel: "Translation",
    });

    expect(result).toEqual(fixture.targetTranslations);
  });

  it("rejects missing questions with the operation label in the error", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
    });

    expect(() =>
      parseSurveyLanguageLLMOutput({
        content: JSON.stringify({
          survey_title: "Encuesta",
          survey_description: "",
          questions: [],
        }),
        refusal: null,
        questions: fixture.questions,
        targetLanguage: fixture.targetLanguage,
        operationLabel: "Translation polish",
      }),
    ).toThrow(/Translation polish returned an unexpected number of questions/);
  });
});
