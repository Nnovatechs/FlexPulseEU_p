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
    const baseDefinition = createInitialSurveyDefinition("Spanish", ["Spanish"]);
    const measurementPlanBlueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["trust_in_automation"]),
      {
        concepts: [
          {
            concept_key: "trust_in_automation",
            measurement_type: "multi_item_likert_mean",
            aggregation_rule: "mean",
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
              min_label: "Muy bajo",
              max_label: "Muy alto",
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
              min_label: "Muy bajo",
              max_label: "Muy alto",
            },
            numeric: null,
          },
        ],
      },
      baseDefinition,
      defaultLanguage: "Spanish",
      supportedLanguages: ["Spanish"],
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
    expect(
      result.definition.translations.Spanish.questions.Q_TRUST_IN_AUTOMATION_01
        .scale,
    ).toEqual({
      min_label: "Muy bajo",
      max_label: "Muy alto",
    });
    expect(result.definition.questions[0].scale).toEqual({
      min: 1,
      max: 5,
      step: 1,
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

  it("localizes preferred tariff labels in Spanish", () => {
    const baseDefinition = createInitialSurveyDefinition("Spanish", ["Spanish"]);
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
        survey_title: "Encuesta de tarifa",
        survey_description: "Mide la preferencia tarifaria.",
        estimated_completion_minutes: 2,
        questions: [
          {
            slot_key: "SLOT_PREFERRED_TARIFF_MODEL_01",
            title: "¿Qué tipo de tarifa eléctrica preferiría para su hogar?",
            description: "",
            ontology_target: "flexpulse_behavioural_schema.preferred_tariff_model",
            type: "single_choice",
            options: [
              {
                label: "same price",
                ontology_value: "same_price",
                is_truthy: true,
              },
              {
                label: "time based",
                ontology_value: "time_of_use",
                is_truthy: true,
              },
              {
                label: "rewards",
                ontology_value: "shift_rewards",
                is_truthy: true,
              },
              {
                label: "variable price",
                ontology_value: "dynamic_price",
                is_truthy: true,
              },
              {
                label: "not sure",
                ontology_value: "not_sure",
                is_truthy: true,
              },
            ],
            scale: null,
            numeric: null,
          },
        ],
      },
      baseDefinition,
      defaultLanguage: "Spanish",
      supportedLanguages: ["Spanish"],
      ontologyTargets: ["flexpulse_behavioural_schema.preferred_tariff_model"],
      measurementPlanBlueprint,
      fallbackSurveyTitle: "Encuesta de tarifa",
      fallbackSurveyDescription: "Mide la preferencia tarifaria.",
    });

    expect(
      result.definition.translations.Spanish.questions.Q_PREFERRED_TARIFF_MODEL_01?.options,
    ).toEqual({
      same_price: "El mismo precio la mayor parte del tiempo",
      time_of_use: "Electricidad más barata en ciertas horas del día",
      shift_rewards: "Recompensas por desplazar el consumo cuando se solicite",
      dynamic_price:
        "Los precios cambian con frecuencia, con más riesgo y posible ahorro",
      not_sure: "No lo sé / necesitaría más información",
    });
  });

  it("canonicalizes preferred tariff ontology values from common writer aliases", () => {
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
                label: "Same price most of the time",
                ontology_value: "stable_price",
                is_truthy: true,
              },
              {
                label: "Cheaper electricity at certain times of day",
                ontology_value: "time_based_discount",
                is_truthy: true,
              },
              {
                label: "Prices change often, with more risk and possible savings",
                ontology_value: "highly_variable_price",
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

    expect(result.definition.questions[0]?.options).toEqual([
      { option_key: "same_price", value: "same_price" },
      { option_key: "time_of_use", value: "time_of_use" },
      { option_key: "dynamic_price", value: "dynamic_price" },
    ]);

    expect(
      result.definition.translations.English.questions.Q_PREFERRED_TARIFF_MODEL_01?.options,
    ).toEqual({
      same_price: "Same price most of the time",
      time_of_use: "Cheaper electricity at certain times of day",
      dynamic_price: "Prices change often, with more risk and possible savings",
    });

    expect(
      result.mappingContract.mappings[0]?.transform_strategy.kind === "enum_lookup"
        ? result.mappingContract.mappings[0].transform_strategy.option_to_value
        : null,
    ).toEqual({
      same_price: "same_price",
      time_of_use: "time_of_use",
      dynamic_price: "dynamic_price",
    });
  });

  it("uses canonical respondent-facing labels for DER asset inventories", () => {
    const baseDefinition = createInitialSurveyDefinition("English", ["English"]);
    const measurementPlanBlueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["owned_der_assets"]),
      {
        concepts: [
          {
            concept_key: "owned_der_assets",
            measurement_type: "multi_choice_tag_set",
            aggregation_rule: "set_union",
            threshold_profile: "asset_inventory",
            slot_count: 1,
            slot_intents: [
              {
                facet: "asset_inventory",
                intent: "Capture the household energy assets or flexible appliances that are present.",
                polarity: "neutral",
              },
            ],
          },
        ],
      },
    );

    const result = transformGeneratedSurvey({
      output: {
        survey_title: "Asset survey",
        survey_description: "Measures household assets.",
        estimated_completion_minutes: 2,
        questions: [
          {
            slot_key: "SLOT_OWNED_DER_ASSETS_01",
            title:
              "Which of these energy-related assets or flexible appliances are present in your household or regularly available to you?",
            description: "",
            ontology_target: "flexpulse_behavioural_schema.owned_der_assets",
            type: "multiple_choice",
            options: [
              {
                label: "Inverter",
                ontology_value: "inverter",
                is_truthy: true,
              },
              {
                label: "Programmable appliance",
                ontology_value: "programmable_appliance",
                is_truthy: true,
              },
              {
                label: "Heating system",
                ontology_value: "heating_system",
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
      ontologyTargets: ["flexpulse_behavioural_schema.owned_der_assets"],
      measurementPlanBlueprint,
      fallbackSurveyTitle: "Asset survey",
      fallbackSurveyDescription: "Measures household assets.",
    });

    expect(
      result.definition.translations.English.questions.Q_OWNED_DER_ASSETS_01?.options,
    ).toEqual({
      inverter: "Solar or battery inverter (if you know you have one)",
      programmable_appliance: "Appliance with a timer or delayed-start setting",
      heating_system: "Home heating system (other than a heat pump)",
    });
  });

  it("uses localized canonical labels for DER asset inventories in Spanish", () => {
    const baseDefinition = createInitialSurveyDefinition("Spanish", ["Spanish"]);
    const measurementPlanBlueprint = applyMeasurementPlannerOutput(
      createMeasurementPlanBlueprint(["interested_der_assets"]),
      {
        concepts: [
          {
            concept_key: "interested_der_assets",
            measurement_type: "multi_choice_tag_set",
            aggregation_rule: "set_union",
            threshold_profile: "asset_inventory",
            slot_count: 1,
            slot_intents: [
              {
                facet: "asset_interest",
                intent: "Capture the household energy assets or flexible appliances the respondent may be interested in.",
                polarity: "neutral",
              },
            ],
          },
        ],
      },
    );

    const result = transformGeneratedSurvey({
      output: {
        survey_title: "Encuesta de activos",
        survey_description: "Mide el interés por activos del hogar.",
        estimated_completion_minutes: 2,
        questions: [
          {
            slot_key: "SLOT_INTERESTED_DER_ASSETS_01",
            title:
              "¿En cuáles de estas tecnologías o equipos de energía para el hogar tendría interés de cara al futuro?",
            description: "",
            ontology_target: "flexpulse_behavioural_schema.interested_der_assets",
            type: "multiple_choice",
            options: [
              {
                label: "Inverter",
                ontology_value: "inverter",
                is_truthy: true,
              },
              {
                label: "Programmable appliance",
                ontology_value: "programmable_appliance",
                is_truthy: true,
              },
              {
                label: "Heating system",
                ontology_value: "heating_system",
                is_truthy: true,
              },
            ],
            scale: null,
            numeric: null,
          },
        ],
      },
      baseDefinition,
      defaultLanguage: "Spanish",
      supportedLanguages: ["Spanish"],
      ontologyTargets: ["flexpulse_behavioural_schema.interested_der_assets"],
      measurementPlanBlueprint,
      fallbackSurveyTitle: "Encuesta de activos",
      fallbackSurveyDescription: "Mide el interés por activos del hogar.",
    });

    expect(
      result.definition.translations.Spanish.questions.Q_INTERESTED_DER_ASSETS_01?.options,
    ).toEqual({
      inverter: "Inversor solar o de batería (si sabe que dispone de uno)",
      programmable_appliance:
        "Electrodoméstico con temporizador o función de inicio diferido",
      heating_system:
        "Sistema de calefacción del hogar (que no sea una bomba de calor)",
    });
  });

});
