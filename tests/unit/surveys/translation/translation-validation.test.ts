import { describe, expect, it } from "vitest";
import {
  buildTranslationValidationPrompt,
  computeMultilingualTranslationHash,
} from "@/features/surveys/translation-validation";
import { buildTranslationSurveyFixture } from "../../../fixtures/surveys/translation/factory";

// These tests focus on the deterministic multilingual hash used to detect when
// translation validation becomes stale after canonical or localized edits.
describe("translation validation — deterministic layer", () => {
  it("changes the multilingual hash when a translated question title changes", () => {
    // This protects the publish gate against silent edits in a localized bundle.
    const baseFixture = buildTranslationSurveyFixture();
    const editedFixture = buildTranslationSurveyFixture({
      targetTitle:
        "Quel est votre degre de confiance envers le pilotage automatise de la consommation ?",
    });

    expect(
      computeMultilingualTranslationHash(baseFixture.definition, [
        baseFixture.sourceLanguage,
        baseFixture.targetLanguage,
      ]),
    ).not.toBe(
      computeMultilingualTranslationHash(editedFixture.definition, [
        editedFixture.sourceLanguage,
        editedFixture.targetLanguage,
      ]),
    );
  });

  it("changes the multilingual hash when the supported language set changes", () => {
    // This covers the invalidation path triggered by adding or removing a target
    // language even if the visible text in existing bundles stays untouched.
    const baseFixture = buildTranslationSurveyFixture();
    const extendedFixture = buildTranslationSurveyFixture();
    extendedFixture.definition.survey_meta.supported_languages.push("Spanish");
    extendedFixture.definition.translations.Spanish = {
      survey_title: "Encuesta sobre flexibilidad energetica",
      survey_description:
        "Un cuestionario breve sobre preferencias de flexibilidad del hogar.",
      questions: {
        Q_TEST_01: {
          title:
            "Como de comodo te sientes con el desplazamiento automatizado del consumo?",
          description:
            "Responde segun las preferencias actuales de tu hogar.",
          options: {
            opt_1: "Muy incomodo",
            opt_2: "Neutral",
            opt_3: "Muy comodo",
          },
        },
      },
    };

    expect(
      computeMultilingualTranslationHash(baseFixture.definition, [
        baseFixture.sourceLanguage,
        baseFixture.targetLanguage,
      ]),
    ).not.toBe(
      computeMultilingualTranslationHash(extendedFixture.definition, [
        extendedFixture.sourceLanguage,
        extendedFixture.targetLanguage,
        "Spanish",
      ]),
    );
  });
});

describe("translation validation prompt", () => {
  it("uses a conservative parity threshold instead of literal matching", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
    });

    const prompt = buildTranslationValidationPrompt({
      sourceLanguage: fixture.sourceLanguage,
      targetLanguage: fixture.targetLanguage,
      sourceTranslations: fixture.sourceTranslations,
      targetTranslations: fixture.targetTranslations,
      questions: fixture.questions,
      mappings: fixture.mappings,
    });

    expect(prompt.system).toContain(
      "Judge parity at the level of likely respondent interpretation and measurement intent",
    );
    expect(prompt.system).toContain(
      "Do not flag parity for harmless changes in syntax, register, idiom, or close paraphrase",
    );
    expect(prompt.system).toContain(
      "A translation can fail quality even when parity is mostly preserved.",
    );
    expect(prompt.system).toContain(
      "Treat native clarity, respondent-facing framing, idiomaticity, and publishability as mandatory quality checks for every item.",
    );
    expect(prompt.system).toContain(
      "Do not use parity for slight wording imprecision, translationese, or awkward phrasing",
    );
    expect(prompt.system).toContain(
      "Do not emit survey-level quality issues for ordinary survey title or survey description style problems.",
    );
    expect(prompt.system).toContain(
      "Do not pass an item just because its meaning can be recovered.",
    );
    expect(prompt.user).toContain(
      "Pass natural paraphrases when the survey meaning and measurement intent are still preserved.",
    );
    expect(prompt.user).toContain(
      "Ask yourself whether the target item sounds like it was originally written by a native survey author",
    );
  });

  it("forces high-confidence rewrite suggestions instead of multiple speculative alternatives", () => {
    const fixture = buildTranslationSurveyFixture({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
    });

    const prompt = buildTranslationValidationPrompt({
      sourceLanguage: fixture.sourceLanguage,
      targetLanguage: fixture.targetLanguage,
      sourceTranslations: fixture.sourceTranslations,
      targetTranslations: fixture.targetTranslations,
      questions: fixture.questions,
      mappings: fixture.mappings,
    });

    expect(prompt.system).toContain(
      "If you propose a rewrite, provide exactly one high-confidence, minimal, idiomatic alternative in the target language.",
    );
    expect(prompt.system).toContain(
      "Do not provide multiple speculative alternatives, and do not suggest awkward literal rewrites.",
    );
  });
});
