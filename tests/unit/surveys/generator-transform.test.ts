import { describe, expect, it } from "vitest";
import {
  applyMeasurementPlannerOutput,
  createMeasurementPlanBlueprint,
} from "@/features/surveys/measurement-plan";
import { createInitialSurveyDefinition } from "@/features/surveys/generator-types";
import { transformGeneratedSurvey } from "@/features/surveys/generator-transform";

describe("generator transform", () => {
  it("creates unique question keys when multiple questions share the same ontology target", () => {
    const baseDefinition = createInitialSurveyDefinition("English", ["English"]);
    const measurementPlanBlueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["trust_in_automation"]),
      {
        concepts: [
          {
            concept_key: "trust_in_automation",
            measurement_type: "multi_item_likert_median",
            aggregation_rule: "median",
            threshold_profile: "likert_1_5_low_mid_high",
            slot_count: 2,
            required_slot_count: 2,
          },
        ],
      },
    );
    const result = transformGeneratedSurvey({
      output: {
        survey_title: "Trust survey",
        survey_description: "Measures trust in automation.",
        estimated_completion_minutes: 4,
        questions: [
          {
            slot_key: "SLOT_TRUST_IN_AUTOMATION_01",
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
            slot_key: "SLOT_TRUST_IN_AUTOMATION_02",
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
      measurementPlanBlueprint,
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
    expect(result.slotBindings).toEqual({
      SLOT_TRUST_IN_AUTOMATION_01: "Q_TRUST_IN_AUTOMATION_01",
      SLOT_TRUST_IN_AUTOMATION_02: "Q_TRUST_IN_AUTOMATION_02",
    });
  });

  it("promotes a real respondent-facing prompt from description into title when writer splits label and item", () => {
    const baseDefinition = createInitialSurveyDefinition("English", ["English"]);
    const measurementPlanBlueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["der_engagement"]),
      {
        concepts: [
          {
            concept_key: "der_engagement",
            measurement_type: "single_item_direct",
            aggregation_rule: "identity",
            threshold_profile: "likert_1_5_low_mid_high",
            slot_count: 1,
            required_slot_count: 1,
          },
        ],
      },
    );

    const result = transformGeneratedSurvey({
      output: {
        survey_title: "DER survey",
        survey_description: "Measures DER engagement.",
        estimated_completion_minutes: 4,
        questions: [
          {
            slot_key: "SLOT_DER_ENGAGEMENT_01",
            title: "Willingness to invest time to set up flexibility",
            description:
              "I would be willing to spend some time setting up or learning a system that helps my home use energy more flexibly.",
            ontology_target: "flexpulse_behavioural_schema.der_engagement",
            type: "rating_scale",
            required: true,
            options: [],
            scale: {
              min: 1,
              max: 5,
              step: 1,
              min_label: "Strongly disagree",
              max_label: "Strongly agree",
            },
            numeric: null,
          },
        ],
      },
      baseDefinition,
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      ontologyTargets: ["flexpulse_behavioural_schema.der_engagement"],
      measurementPlanBlueprint,
      fallbackSurveyTitle: "DER survey",
      fallbackSurveyDescription: "Measures DER engagement.",
    });

    expect(
      result.definition.translations.English.questions.Q_DER_ENGAGEMENT_01?.title,
    ).toBe(
      "I would be willing to spend some time setting up or learning a system that helps my home use energy more flexibly.",
    );
    expect(
      result.definition.translations.English.questions.Q_DER_ENGAGEMENT_01?.description,
    ).toBeUndefined();
  });

});
