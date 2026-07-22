import { describe, expect, it } from "vitest";
import {
  createInitialMappingContract,
  type PersistedSurvey,
} from "@/features/surveys/generator-types";
import { validatePublicSurveySubmission } from "@/features/surveys/response-validation";
import { buildValidationSurveyFixture } from "../../../fixtures/surveys/validation/factory";

function buildConditionalSurvey(): PersistedSurvey {
  const fixture = buildValidationSurveyFixture({
    title: "Which assets are available?",
    optionLabels: ["EV", "None"],
  });
  fixture.definition.questions[0] = {
    question_key: "Q_TEST_01",
    type: "multiple_choice",
    required: true,
    order: 1,
    exclusive_option_keys: ["opt_2"],
    options: [
      { option_key: "opt_1", value: "ev" },
      { option_key: "opt_2", value: "none" },
    ],
  };
  fixture.definition.questions.push({
    question_key: "Q_DFC_EV_01",
    type: "rating_scale",
    required: true,
    order: 2,
    scale: { min: 1, max: 5, step: 1 },
    visibility_rule: {
      source_question_key: "Q_TEST_01",
      operator: "contains_any",
      values: ["opt_1"],
    },
  });

  return {
    id: "survey-conditional",
    name: "Conditional survey",
    status: "published",
    created_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    default_language: fixture.language,
    supported_languages: [fixture.language],
    definition_json: fixture.definition,
    mapping_contract_json: createInitialMappingContract(),
    mapping_compiled_json: null,
    mapping_hash: "mapping-hash",
  };
}

describe("public survey submission validation", () => {
  it("requires country code when the survey response context asks for it", () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
      optionLabels: ["Low", "Medium", "High"],
    });
    fixture.definition.survey_meta.response_context = {
      collect_country_code: true,
      collect_postal_code: false,
      enrich_weather_context: false,
    };

    const survey = {
      id: "survey-1",
      name: "Baseline survey",
      status: "published" as const,
      created_by: "user-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: createInitialMappingContract(),
      mapping_compiled_json: null,
      mapping_hash: "mapping-hash",
    };

    const formData = new FormData();
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_1");
    formData.set("legalConsentAccepted", "true");

    expect(() => validatePublicSurveySubmission(survey, formData)).toThrow(
      "Country code is required for this survey.",
    );
  });

  it("parses and validates answers keyed by canonical question key", () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
      optionLabels: ["Low", "Medium", "High"],
    });

    const survey = {
      id: "survey-1",
      name: "Baseline survey",
      status: "published" as const,
      created_by: "user-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: createInitialMappingContract(),
      mapping_compiled_json: null,
      mapping_hash: "mapping-hash",
    };

    const formData = new FormData();
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_2");
    formData.set("legalConsentAccepted", "true");

    expect(validatePublicSurveySubmission(survey, formData)).toMatchObject({
      submittedLanguage: fixture.language,
      answers: {
        Q_TEST_01: "opt_2",
      },
      legalConsent: {
        accepted: true,
        statement:
          "I consent to the processing of my survey response for the stated purposes and confirm that I have read:",
        source: "public_survey_form",
      },
    });
  });

  it("requires privacy information acceptance", () => {
    const fixture = buildValidationSurveyFixture({
      title: "How comfortable are you with automated load shifting?",
      optionLabels: ["Low", "Medium", "High"],
    });

    const survey = {
      id: "survey-1",
      name: "Baseline survey",
      status: "published" as const,
      created_by: "user-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      default_language: fixture.language,
      supported_languages: [fixture.language],
      definition_json: fixture.definition,
      mapping_contract_json: createInitialMappingContract(),
      mapping_compiled_json: null,
      mapping_hash: "mapping-hash",
    };

    const formData = new FormData();
    formData.set("submittedLanguage", fixture.language);
    formData.set("question:Q_TEST_01", "opt_2");

    expect(() => validatePublicSurveySubmission(survey, formData)).toThrow(
      "Privacy information acceptance is required.",
    );
  });

  it("requires only visible conditional questions", () => {
    const survey = buildConditionalSurvey();
    const hidden = new FormData();
    hidden.set("submittedLanguage", survey.default_language);
    hidden.set("question:Q_TEST_01", "opt_2");
    hidden.set("legalConsentAccepted", "true");
    expect(validatePublicSurveySubmission(survey, hidden).answers).toEqual({
      Q_TEST_01: ["opt_2"],
    });

    const visible = new FormData();
    visible.set("submittedLanguage", survey.default_language);
    visible.set("question:Q_TEST_01", "opt_1");
    visible.set("legalConsentAccepted", "true");
    expect(() => validatePublicSurveySubmission(survey, visible)).toThrow(
      'Question "Q_DFC_EV_01" is required.',
    );
  });

  it("discards submitted answers that are hidden by the parsed source", () => {
    const survey = buildConditionalSurvey();
    const formData = new FormData();
    formData.set("submittedLanguage", survey.default_language);
    formData.set("question:Q_TEST_01", "opt_2");
    formData.set("question:Q_DFC_EV_01", "5");
    formData.set("legalConsentAccepted", "true");

    expect(validatePublicSurveySubmission(survey, formData).answers).toEqual({
      Q_TEST_01: ["opt_2"],
    });
  });

  it("rejects mutually exclusive multiple-choice combinations", () => {
    const survey = buildConditionalSurvey();
    const formData = new FormData();
    formData.set("submittedLanguage", survey.default_language);
    formData.append("question:Q_TEST_01", "opt_1");
    formData.append("question:Q_TEST_01", "opt_2");
    formData.set("legalConsentAccepted", "true");

    expect(() => validatePublicSurveySubmission(survey, formData)).toThrow(
      'Question "Q_TEST_01" contains mutually exclusive options.',
    );
  });

  it("rejects rating-scale answers that do not align with step", () => {
    const survey = buildConditionalSurvey();
    const formData = new FormData();
    formData.set("submittedLanguage", survey.default_language);
    formData.set("question:Q_TEST_01", "opt_1");
    formData.set("question:Q_DFC_EV_01", "1.5");
    formData.set("legalConsentAccepted", "true");

    expect(() => validatePublicSurveySubmission(survey, formData)).toThrow(
      'Question "Q_DFC_EV_01" does not match the allowed scale step.',
    );
  });
});
