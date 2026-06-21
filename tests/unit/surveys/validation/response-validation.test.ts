import { describe, expect, it } from "vitest";
import { createInitialMappingContract } from "@/features/surveys/generator-types";
import { validatePublicSurveySubmission } from "@/features/surveys/response-validation";
import { buildValidationSurveyFixture } from "../../../fixtures/surveys/validation/factory";

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
          "I have read the privacy information and cookie notice, and I consent to the processing of my survey response for the stated purposes.",
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
});
