import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type MeasurementPlanEntry,
  type PersistedSurvey,
  type SurveyMappingDefinition,
  type SurveyQuestionDefinition,
} from "@/features/surveys/generator-types";
import { compileMappingContract } from "@/features/surveys/generator-mapping";
import {
  createDeclaredFlexibilityCapabilityDefinitionArtifacts,
  DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION,
} from "@/features/surveys/declared-flexibility-capability-module";

/** Stable mapping hash asserted by the DFC mapper compatibility fixture. */
export const DFC_EVAL_MAPPING_HASH = "dfc_eval_mapping_hash_v1";

/** Stable measurement hash asserted by the DFC profiling fixture. */
export const DFC_EVAL_MEASUREMENT_HASH = "dfc_eval_measurement_hash_v1";

/** Independent direct trust control question used only by DFC evals. */
export const DFC_TRUST_QUESTION_KEY = "Q_DFC_EVAL_TRUST";

/** Independent direct willingness control question used only by DFC evals. */
export const DFC_WILLINGNESS_QUESTION_KEY = "Q_DFC_EVAL_WILLINGNESS";

function createDirectQuestion(
  questionKey: string,
  order: number,
): SurveyQuestionDefinition {
  return {
    question_key: questionKey,
    type: "rating_scale",
    required: true,
    order,
    scale: {
      min: 1,
      max: 5,
      step: 1,
      min_label: "Low",
      max_label: "High",
    },
  };
}

function createDirectMapping(
  questionKey: string,
  ontologyTarget: string,
): SurveyMappingDefinition {
  return {
    question_key: questionKey,
    ontology_target: ontologyTarget,
    expected_type: "number",
    required_for_mapping: true,
    transform_strategy: {
      kind: "numeric_range",
      min: 1,
      max: 5,
    },
    validation_constraints: {
      min: 1,
      max: 5,
    },
  };
}

function createDirectMeasurementEntry(
  conceptKey: "trust_in_automation" | "flexibility_willingness",
  questionKey: string,
): MeasurementPlanEntry {
  return {
    concept_key: conceptKey,
    evidence_source: "survey_questions",
    measurement_type: "single_item_direct",
    output_type: "number",
    aggregation_rule: "identity",
    threshold_profile: "likert_1_5_low_mid_high",
    minimum_answer_count: 1,
    question_keys: [questionKey],
    required_question_keys: [questionKey],
    question_intents: [
      {
        slot_key: `SLOT_${questionKey}`,
        question_key: questionKey,
        facet: "direct_eval_signal",
        intent: `Provide an independent ${conceptKey} control variable for DFC compatibility evaluation.`,
        polarity: "positive",
      },
    ],
  };
}

/**
 * Builds the frozen DFC-v1 eval survey without changing Stage 2 fixtures.
 */
export function buildDfcEvalSurveyFixture(): PersistedSurvey {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  const dfc = createDeclaredFlexibilityCapabilityDefinitionArtifacts(3);
  const directQuestions = [
    createDirectQuestion(DFC_TRUST_QUESTION_KEY, 1),
    createDirectQuestion(DFC_WILLINGNESS_QUESTION_KEY, 2),
  ];

  definition.survey_meta.capability_module_version =
    DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION;
  definition.survey_meta.response_context = {
    collect_country_code: true,
    collect_postal_code: false,
    enrich_weather_context: false,
  };
  definition.questions = [...directQuestions, ...dfc.questions];
  definition.survey_meta.measurement_plan_json = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: [
      createDirectMeasurementEntry(
        "trust_in_automation",
        DFC_TRUST_QUESTION_KEY,
      ),
      createDirectMeasurementEntry(
        "flexibility_willingness",
        DFC_WILLINGNESS_QUESTION_KEY,
      ),
      ...dfc.measurementPlan.concepts,
    ],
  };
  definition.translations.English.survey_title =
    "Declared flexibility capability eval survey";
  definition.translations.English.questions = Object.fromEntries(
    definition.questions.map((question) => [
      question.question_key,
      { title: question.question_key.replaceAll("_", " ") },
    ]),
  );

  const mappingContract = createInitialMappingContract();
  mappingContract.mappings = [
    createDirectMapping(
      DFC_TRUST_QUESTION_KEY,
      "flexpulse_behavioural_schema.trust_in_automation",
    ),
    createDirectMapping(
      DFC_WILLINGNESS_QUESTION_KEY,
      "flexpulse_behavioural_schema.flexibility_willingness",
    ),
    ...dfc.mappingContract.mappings,
  ];

  return {
    id: "dfc_eval_survey_v1",
    name: "Declared flexibility capability eval survey",
    status: "published",
    created_by: "eval_user",
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z",
    published_at: "2026-07-21T00:00:00.000Z",
    default_language: "English",
    supported_languages: ["English"],
    definition_json: definition,
    mapping_contract_json: mappingContract,
    mapping_compiled_json: compileMappingContract(mappingContract),
    mapping_hash: DFC_EVAL_MAPPING_HASH,
    measurement_hash: DFC_EVAL_MEASUREMENT_HASH,
  };
}
