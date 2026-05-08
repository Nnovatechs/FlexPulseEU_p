import { describe, expect, it } from "vitest";
import { buildSurveyTranslationPrompt } from "@/features/surveys/translation-prompt";
import { buildTranslationSurveyFixture } from "../../../fixtures/surveys/translation/factory";

describe("buildSurveyTranslationPrompt", () => {
  it("uses a minimal rewrite task with only visible text and stable keys", () => {
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
    });

    expect(prompt.system).toBe(
      "Rewrite survey text into the target language. Understand what each source item asks and write it naturally, as a clear human survey question. Return JSON only.",
    );
    expect(prompt.user).not.toContain("ontology_target");
    expect(prompt.user).not.toContain("scale");
    expect(prompt.user).not.toContain("type");
    expect(prompt.user).toContain("source_description");
    expect(prompt.user).toContain(
      "Rewrite the survey title, description, questions and option labels in the target language.",
    );
    expect(prompt.user).toContain(
      "If the source sounds robotic, technical or unclear, write a natural equivalent",
    );
    expect(prompt.user).toContain("Treat domain phrases as meaning, not fixed labels.");
    expect(prompt.user).toContain("Use the respondent as the subject for feelings");
    expect(prompt.user).toContain("Option labels must read naturally as standalone response choices.");
    expect(prompt.user).toContain("question_key");
    expect(prompt.user).toContain("option_key");
    expect(prompt.system).not.toContain("sistema de energía doméstica");
    expect(prompt.system).not.toContain("programarse para más tarde");
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

    expect(prompt.user).toContain("This is a revision pass.");
    expect(prompt.user).toContain(
      "Some previous items failed. Rewrite those items from the source meaning",
    );
    expect(prompt.user).toContain("Failed validation checks from the previous draft:");
    expect(prompt.user).toContain("failed_check");
    expect(prompt.user).not.toContain("Previous target-language draft:");
    expect(prompt.user).not.toContain("La expresion suena poco natural en espanol general.");
  });
});
