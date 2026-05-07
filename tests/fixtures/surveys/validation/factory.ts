import {
  createInitialMappingContract,
  createInitialSurveyDefinition,
  type MeasurementPlan,
  type SurveyMappingDefinition,
  type SurveyQuestionDefinition,
} from "@/features/surveys/generator-types";

// Factory used by unit, integration and eval suites for the survey validation
// module. It produces the smallest possible survey shape that still looks like
// real product data: one canonical language, one question and one mapping.
// The goal is to keep every test readable and focused on its own case.
type BuildValidationSurveyInput = {
  language?: string;
  questionKey?: string;
  title: string;
  description?: string;
  optionLabels?: string[];
  ontologyTarget?: string;
  questionIntent?: {
    facet: string;
    intent: string;
    polarity: "positive" | "negative" | "neutral";
  };
};

export function buildValidationSurveyFixture({
  language = "English",
  questionKey = "Q_TEST_01",
  title,
  description,
  optionLabels = [],
  ontologyTarget = "flexpulse_behavioural_schema.trust_in_automation",
  questionIntent,
}: BuildValidationSurveyInput) {
  // We intentionally reuse the real domain factories so tests evolve together
  // with the application contract instead of maintaining a fake parallel shape.
  const definition = createInitialSurveyDefinition(language, [language]);

  const question: SurveyQuestionDefinition = {
    question_key: questionKey,
    type: optionLabels.length > 0 ? "single_choice" : "free_text",
    required: true,
    order: 1,
    ...(optionLabels.length > 0
      ? {
          options: optionLabels.map((label, index) => ({
            option_key: `opt_${index + 1}`,
            value: `value_${index + 1}`,
          })),
        }
      : {}),
  };

  definition.questions = [question];
  definition.translations[language].questions[questionKey] = {
    title,
    ...(description ? { description } : {}),
    ...(optionLabels.length > 0
      ? {
          options: Object.fromEntries(
            optionLabels.map((label, index) => [`opt_${index + 1}`, label]),
          ),
        }
      : {}),
  };

  const mapping: SurveyMappingDefinition = {
    question_key: questionKey,
    ontology_target: ontologyTarget,
    expected_type: "string",
    required_for_mapping: true,
    transform_strategy: {
      kind: "identity",
    },
  };

  const mappingContract = createInitialMappingContract();
  mappingContract.mappings = [mapping];

  const measurementPlan: MeasurementPlan = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: [
      {
        concept_key: ontologyTarget.replace("flexpulse_behavioural_schema.", ""),
        evidence_source: "survey_questions",
        measurement_type: "single_item_direct",
        output_type: "string",
        aggregation_rule: "identity",
        threshold_profile: "none",
        minimum_answer_count: 1,
        question_keys: [questionKey],
        required_question_keys: [questionKey],
        question_intents: questionIntent
          ? [
              {
                slot_key: `${questionKey}_slot`,
                question_key: questionKey,
                facet: questionIntent.facet,
                intent: questionIntent.intent,
                polarity: questionIntent.polarity,
              },
            ]
          : undefined,
      },
    ],
  };

  return {
    language,
    definition,
    translations: definition.translations[language],
    questions: definition.questions,
    mappings: mappingContract.mappings,
    measurementPlan,
  };
}
