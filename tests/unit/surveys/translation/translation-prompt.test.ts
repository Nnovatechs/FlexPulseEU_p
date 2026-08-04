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
    expect(prompt.user).toContain("rating-scale endpoint labels");
    expect(prompt.user).not.toContain("type");
    expect(prompt.user).toContain("source_description");
    expect(prompt.user).toContain(
      "Rewrite the survey title, description, questions, option labels and rating-scale endpoint labels in the target language.",
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
});
