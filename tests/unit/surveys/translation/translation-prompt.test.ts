import { describe, expect, it } from "vitest";
import { buildSurveyTranslationPrompt } from "@/features/surveys/translation-prompt";
import { buildTranslationSurveyFixture } from "../../../fixtures/surveys/translation/factory";

describe("buildSurveyTranslationPrompt", () => {
  it("frames multilingual generation as localization instead of literal translation", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
    });

    const prompt = buildSurveyTranslationPrompt({
      surveyName: "Energy flexibility survey",
      sourceLanguage: fixture.sourceLanguage,
      targetLanguage: fixture.targetLanguage,
      sourceTranslations: fixture.sourceTranslations,
      questions: fixture.questions,
      mappings: fixture.mappings,
    });

    expect(prompt.system).toContain(
      "Write each item as if it had originally been authored in the requested target language",
    );
    expect(prompt.system).toContain(
      "Do not produce word-for-word or mechanically literal translations.",
    );
    expect(prompt.user).toContain("Localize the following survey content");
    expect(prompt.user).toContain(
      "The output must read like a native target-language survey version",
    );
  });

  it("adds Spanish guidance against awkward English calques", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
    });

    const prompt = buildSurveyTranslationPrompt({
      surveyName: "Energy flexibility survey",
      sourceLanguage: fixture.sourceLanguage,
      targetLanguage: fixture.targetLanguage,
      sourceTranslations: fixture.sourceTranslations,
      questions: fixture.questions,
      mappings: fixture.mappings,
    });

    expect(prompt.system).toContain("Avoid region-specific slang, awkward calques");
    expect(prompt.system).toContain("'por mi' or 'en mi lugar'");
    expect(prompt.system).toContain("'en mi nombre'");
  });

  it("includes previous draft and validator feedback during revision passes", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
    });

    const prompt = buildSurveyTranslationPrompt({
      surveyName: "Energy flexibility survey",
      sourceLanguage: fixture.sourceLanguage,
      targetLanguage: fixture.targetLanguage,
      sourceTranslations: fixture.sourceTranslations,
      questions: fixture.questions,
      mappings: fixture.mappings,
      previousTranslation: fixture.targetTranslations,
      validationIssues: [
        {
          language: fixture.targetLanguage,
          question_key: fixture.question.question_key,
          type: "quality",
          message: "La expresion suena poco natural en espanol general.",
        },
      ],
    });

    expect(prompt.system).toContain(
      "You may receive validator feedback on a previous draft.",
    );
    expect(prompt.user).toContain("This is a revision pass.");
    expect(prompt.user).toContain("Previous target-language draft:");
    expect(prompt.user).toContain("Validator feedback on that draft:");
    expect(prompt.user).toContain("La expresion suena poco natural en espanol general.");
  });
});
