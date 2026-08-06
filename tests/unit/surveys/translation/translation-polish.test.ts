import { describe, expect, it } from "vitest";
import { buildSurveyPolishPrompt } from "@/features/surveys/translation-polish";
import { buildTranslationSurveyFixture } from "../../../fixtures/surveys/translation/factory";

describe("buildSurveyPolishPrompt", () => {
  it("turns a translated draft into a native-language rewrite task", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
    });

    const prompt = buildSurveyPolishPrompt({
      sourceLanguage: fixture.sourceLanguage,
      targetLanguage: fixture.targetLanguage,
      sourceTranslations: fixture.sourceTranslations,
      draftTranslations: fixture.targetTranslations,
      questions: fixture.questions,
    });

    expect(prompt.system).toBe(
      "Rewrite the target-language survey text so it sounds natural and human. Use the source text only to preserve meaning. Return JSON only.",
    );
    expect(prompt.user).toContain("target-language draft");
    expect(prompt.user).toContain("written directly by a native speaker");
    expect(prompt.user).toContain("Treat domain phrases as meaning, not fixed labels.");
    expect(prompt.user).toContain("Use the respondent as the subject for feelings");
    expect(prompt.user).toContain("Do not make a household, home, system or device the subject of mental states");
    expect(prompt.user).toContain("Avoid vague placeholders");
    expect(prompt.user).toContain("Avoid repeating the same technical domain phrase");
    expect(prompt.user).toContain("Option labels must read naturally as standalone response choices.");
    expect(prompt.user).toContain("Target locale: Spain Spanish (es-ES)");
    expect(prompt.user).toContain("Target audience: general adult population");
    expect(prompt.user).toContain("Target register: neutral, professional and accessible");
    expect(prompt.user).toContain("Target survey style:");
    expect(prompt.user).toContain("Target inclusivity guidance:");
    expect(prompt.user).not.toContain("Spanish-specific naturalness checks:");
    expect(prompt.user).toContain("question_key");
    expect(prompt.user).toContain("option_key");
    expect(prompt.user).toContain("source_title");
    expect(prompt.user).toContain("draft_title");
    expect(prompt.user).not.toContain("ontology_target");
    expect(prompt.user).toContain("Rating-scale min_label and max_label");
  });

  it("passes only failed check types during validation retries", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
    });

    const prompt = buildSurveyPolishPrompt({
      sourceLanguage: fixture.sourceLanguage,
      targetLanguage: fixture.targetLanguage,
      sourceTranslations: fixture.sourceTranslations,
      draftTranslations: fixture.targetTranslations,
      questions: fixture.questions,
      validationIssues: [
        {
          language: fixture.targetLanguage,
          question_key: fixture.question.question_key,
          type: "quality",
          message: "La expresion suena poco natural en espanol general.",
        },
      ],
    });

    expect(prompt.user).toContain("Some items failed validation.");
    expect(prompt.user).toContain(
      "Rewrite only the flagged question_key values and keep every other question exactly unchanged.",
    );
    expect(prompt.user).toContain(
      "Return the full survey bundle, including every question_key in the draft. Do not omit unchanged questions; copy them exactly unchanged.",
    );
    expect(prompt.user).toContain("Rewrite only these question_key values:");
    expect(prompt.user).toContain(
      "Return every question_key from the draft in the final JSON output.",
    );
    expect(prompt.user).toContain(
      "Keep all other question titles, descriptions, options and scale labels exactly unchanged.",
    );
    expect(prompt.user).toContain("Failed validation checks:");
    expect(prompt.user).toContain("failed_check");
    expect(prompt.user).toContain("La expresion suena poco natural en espanol general.");
    expect(prompt.user).toContain('"recommendation": null');
  });
});
