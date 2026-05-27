import { describe, expect, it } from "vitest";
import {
  applyMeasurementPlannerOutput,
  createMeasurementPlanBlueprint,
} from "@/features/surveys/measurement-plan";
import { createInitialSurveyDefinition } from "@/features/surveys/generator-types";
import { transformGeneratedSurvey } from "@/features/surveys/generator-transform";

function slotIntents(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    facet: `facet_${index + 1}`,
    intent: `Measure facet ${index + 1}.`,
    polarity: "positive" as const,
  }));
}

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
            slot_intents: slotIntents(2),
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
    expect(result.definition.questions.every((question) => question.required)).toBe(true);
    expect(result.mappingContract.mappings.every((mapping) => mapping.required_for_mapping)).toBe(
      true,
    );
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
            slot_intents: slotIntents(1),
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

  it("normalizes preferred tariff option labels into respondent-facing language", () => {
    const baseDefinition = createInitialSurveyDefinition("English", ["English"]);
    const measurementPlanBlueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["preferred_tariff_model"]),
      {
        concepts: [
          {
            concept_key: "preferred_tariff_model",
            measurement_type: "single_choice_enum",
            aggregation_rule: "identity",
            threshold_profile: "enum_identity",
            slot_count: 1,
            slot_intents: [
              {
                facet: "tariff_choice",
                intent: "Measure preferred tariff model.",
                polarity: "neutral",
              },
            ],
          },
        ],
      },
    );

    const result = transformGeneratedSurvey({
      output: {
        survey_title: "Tariff survey",
        survey_description: "Measures tariff preference.",
        estimated_completion_minutes: 2,
        questions: [
          {
            slot_key: "SLOT_PREFERRED_TARIFF_MODEL_01",
            title: "Which tariff would you prefer?",
            description: "",
            ontology_target: "flexpulse_behavioural_schema.preferred_tariff_model",
            type: "single_choice",
            options: [
              {
                label: "dynamic variable pricing",
                ontology_value: "dynamic_price",
                is_truthy: true,
              },
              {
                label: "shift rewards",
                ontology_value: "shift_rewards",
                is_truthy: true,
              },
            ],
            scale: null,
            numeric: null,
          },
        ],
      },
      baseDefinition,
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      ontologyTargets: ["flexpulse_behavioural_schema.preferred_tariff_model"],
      measurementPlanBlueprint,
      fallbackSurveyTitle: "Tariff survey",
      fallbackSurveyDescription: "Measures tariff preference.",
    });

    expect(
      result.definition.translations.English.questions.Q_PREFERRED_TARIFF_MODEL_01?.options,
    ).toEqual({
      dynamic_price: "Prices change often, with more risk and possible savings",
      shift_rewards: "Rewards for shifting use when asked",
    });
  });

  it("maps preferred tariff labels from ontology_value even when the raw label is ambiguous", () => {
    const baseDefinition = createInitialSurveyDefinition("English", ["English"]);
    const measurementPlanBlueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["preferred_tariff_model"]),
      {
        concepts: [
          {
            concept_key: "preferred_tariff_model",
            measurement_type: "single_choice_enum",
            aggregation_rule: "identity",
            threshold_profile: "enum_identity",
            slot_count: 1,
            slot_intents: [
              {
                facet: "tariff_choice",
                intent: "Measure preferred tariff model.",
                polarity: "neutral",
              },
            ],
          },
        ],
      },
    );

    const result = transformGeneratedSurvey({
      output: {
        survey_title: "Tariff survey",
        survey_description: "Measures tariff preference.",
        estimated_completion_minutes: 2,
        questions: [
          {
            slot_key: "SLOT_PREFERRED_TARIFF_MODEL_01",
            title: "Which tariff would you prefer?",
            description: "",
            ontology_target: "flexpulse_behavioural_schema.preferred_tariff_model",
            type: "single_choice",
            options: [
              {
                label: "market rewards everywhere",
                ontology_value: "dynamic_price",
                is_truthy: true,
              },
            ],
            scale: null,
            numeric: null,
          },
        ],
      },
      baseDefinition,
      defaultLanguage: "English",
      supportedLanguages: ["English"],
      ontologyTargets: ["flexpulse_behavioural_schema.preferred_tariff_model"],
      measurementPlanBlueprint,
      fallbackSurveyTitle: "Tariff survey",
      fallbackSurveyDescription: "Measures tariff preference.",
    });

    expect(
      result.definition.translations.English.questions.Q_PREFERRED_TARIFF_MODEL_01?.options,
    ).toEqual({
      dynamic_price: "Prices change often, with more risk and possible savings",
    });
  });

});
