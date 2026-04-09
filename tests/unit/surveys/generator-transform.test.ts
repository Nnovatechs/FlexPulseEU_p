import { describe, expect, it } from "vitest";
import { createInitialSurveyDefinition } from "@/features/surveys/generator-types";
import { transformGeneratedSurvey } from "@/features/surveys/generator-transform";

describe("generator transform", () => {
  it("creates unique question keys when multiple questions share the same ontology target", () => {
    const baseDefinition = createInitialSurveyDefinition("English", ["English"]);
    const result = transformGeneratedSurvey({
      output: {
        survey_title: "Trust survey",
        survey_description: "Measures trust in automation.",
        estimated_completion_minutes: 4,
        questions: [
          {
            title: "How much do you trust automation in general?",
            description: "",
            ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
            type: "rating_scale",
            required: true,
            options: [],
            scale: {
              min: 1,
              max: 5,
              step: 1,
              min_label: "Very low",
              max_label: "Very high",
            },
            numeric: null,
          },
          {
            title: "How much do you trust automation during emergencies?",
            description: "",
            ontology_target: "flexpulse_behavioural_schema.trust_in_automation",
            type: "rating_scale",
            required: true,
            options: [],
            scale: {
              min: 1,
              max: 5,
              step: 1,
              min_label: "Very low",
              max_label: "Very high",
            },
            numeric: null,
          },
        ],
      },
      baseDefinition,
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      ontologyTargets: ["flexpulse_behavioural_schema.trust_in_automation"],
      fallbackSurveyTitle: "Trust survey",
      fallbackSurveyDescription: "Measures trust in automation.",
    });

    expect(result.definition.questions.map((question) => question.question_key)).toEqual([
      "Q_TRUST_IN_AUTOMATION_01",
      "Q_TRUST_IN_AUTOMATION_02",
    ]);
    expect(result.mappingContract.mappings.map((mapping) => mapping.question_key)).toEqual([
      "Q_TRUST_IN_AUTOMATION_01",
      "Q_TRUST_IN_AUTOMATION_02",
    ]);
  });
});
