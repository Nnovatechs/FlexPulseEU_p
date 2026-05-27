import {
  MeasurementPlan,
  MappingContract,
  SurveyDefinition,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "./generator-types";
import type { MeasurementPlanBlueprint, MeasurementType } from "./measurement-plan";
import { getInvalidSurveyLanguages } from "./languages";
import { getFlexpulseBehaviouralConcept } from "@/features/ontology/flexpulse-behavioural-schema";

export type SurveyValidationIssue = {
  code: string;
  path: string;
  message: string;
};

type SurveyDefinitionValidationOptions = {
  require_complete_translations?: boolean;
};

function addIssue(
  issues: SurveyValidationIssue[],
  code: string,
  path: string,
  message: string,
) {
  issues.push({ code, path, message });
}

function hasUniqueValues(values: string[]) {
  return new Set(values).size === values.length;
}

function getCompatibleQuestionTypes(
  measurementType: MeasurementType,
): SurveyQuestionDefinition["type"][] {
  switch (measurementType) {
    case "multi_item_likert_median":
      return ["rating_scale"];
    case "single_choice_enum":
      return ["single_choice"];
    case "multi_choice_tag_set":
      return ["multiple_choice"];
    case "numeric_direct":
      return ["numeric"];
    case "single_item_direct":
      return ["rating_scale", "single_choice", "numeric", "boolean"];
    case "context_passthrough":
    case "quality_flag_passthrough":
      return [];
    default:
      return [];
  }
}

export function validateMeasurementPlanBlueprint(
  blueprint: MeasurementPlanBlueprint,
): SurveyValidationIssue[] {
  const issues: SurveyValidationIssue[] = [];
  const conceptKeys = blueprint.concepts.map((concept) => concept.concept_key);

  if (!hasUniqueValues(conceptKeys)) {
    addIssue(
      issues,
      "duplicate_measurement_concept_key",
      "measurement_plan_blueprint.concepts",
      "Measurement blueprint must not contain duplicate concept keys.",
    );
  }

  blueprint.concepts.forEach((concept, index) => {
    const basePath = `measurement_plan_blueprint.concepts[${index}]`;
    const slotKeys = concept.question_slots.map((slot) => slot.slot_key);

    if (!hasUniqueValues(slotKeys)) {
      addIssue(
        issues,
        "duplicate_measurement_slot_key",
        `${basePath}.question_slots`,
        `Concept "${concept.concept_key}" repeats slot keys in its measurement blueprint.`,
      );
    }

    for (const slotKey of slotKeys) {
      if (!/^SLOT_[A-Z0-9_]+_\d{2}$/.test(slotKey)) {
        addIssue(
          issues,
          "invalid_measurement_slot_key",
          `${basePath}.question_slots`,
          `Concept "${concept.concept_key}" contains invalid slot key "${slotKey}".`,
        );
      }
    }

    if (
      concept.evidence_source === "survey_questions" &&
      concept.question_slots.length === 0
    ) {
      addIssue(
        issues,
        "missing_question_coverage",
        `${basePath}.question_slots`,
        `Concept "${concept.concept_key}" requires survey question coverage but has no planned slots.`,
      );
    }

    if (
      concept.evidence_source !== "survey_questions" &&
      concept.question_slots.length > 0
    ) {
      addIssue(
        issues,
        "unexpected_question_slots",
        `${basePath}.question_slots`,
        `Concept "${concept.concept_key}" should not include survey question slots for evidence source "${concept.evidence_source}".`,
      );
    }

    if (concept.minimum_answer_count > concept.question_slots.length) {
      addIssue(
        issues,
        "invalid_minimum_answer_count",
        `${basePath}.minimum_answer_count`,
        `Concept "${concept.concept_key}" requires more answers than planned question slots.`,
      );
    }

    if (
      concept.evidence_source === "survey_questions" &&
      concept.minimum_answer_count < 1
    ) {
      addIssue(
        issues,
        "minimum_answer_count_too_low",
        `${basePath}.minimum_answer_count`,
        `Concept "${concept.concept_key}" must require at least one answer when measured via survey questions.`,
      );
    }
  });

  return issues;
}

export function validateMeasurementPlannerConceptCoverage(
  expectedConceptKeys: string[],
  actualConceptKeys: string[],
): SurveyValidationIssue[] {
  const issues: SurveyValidationIssue[] = [];
  const expected = new Set(expectedConceptKeys);
  const actual = new Set(actualConceptKeys);

  if (!hasUniqueValues(actualConceptKeys)) {
    addIssue(
      issues,
      "duplicate_planner_concept_key",
      "measurement_planner_output.concepts",
      "Measurement planner returned duplicate concept keys.",
    );
  }

  for (const conceptKey of expectedConceptKeys) {
    if (!actual.has(conceptKey)) {
      addIssue(
        issues,
        "missing_planner_concept_key",
        "measurement_planner_output.concepts",
        `Measurement planner must return a concept plan for "${conceptKey}".`,
      );
    }
  }

  for (const conceptKey of actualConceptKeys) {
    if (!expected.has(conceptKey)) {
      addIssue(
        issues,
        "unexpected_planner_concept_key",
        "measurement_planner_output.concepts",
        `Measurement planner returned an unexpected concept "${conceptKey}".`,
      );
    }
  }

  return issues;
}

function validateMeasurementPlanAlignment(
  definition: SurveyDefinition,
  contract: MappingContract,
  measurementPlan: MeasurementPlan,
): SurveyValidationIssue[] {
  const issues: SurveyValidationIssue[] = [];
  const questionIndex = new Map(
    definition.questions.map((question) => [question.question_key, question]),
  );
  const mappingIndex = new Map(
    contract.mappings.map((mapping) => [mapping.question_key, mapping]),
  );
  const plannedQuestionKeys = new Set<string>();

  measurementPlan.concepts.forEach((concept, index) => {
    const basePath = `survey_meta.measurement_plan_json.concepts[${index}]`;

    if (
      concept.evidence_source === "survey_questions" &&
      concept.question_keys.length === 0
    ) {
      addIssue(
        issues,
        "missing_question_coverage",
        `${basePath}.question_keys`,
        `Concept "${concept.concept_key}" requires survey questions but none were materialized.`,
      );
    }

    if (
      concept.evidence_source !== "survey_questions" &&
      concept.question_keys.length > 0
    ) {
      addIssue(
        issues,
        "unexpected_question_keys",
        `${basePath}.question_keys`,
        `Concept "${concept.concept_key}" should not carry question keys for evidence source "${concept.evidence_source}".`,
      );
    }

    if (concept.minimum_answer_count > concept.question_keys.length) {
      addIssue(
        issues,
        "invalid_minimum_answer_count",
        `${basePath}.minimum_answer_count`,
        `Concept "${concept.concept_key}" requires more answers than available materialized questions.`,
      );
    }

    if (!hasUniqueValues(concept.question_keys)) {
      addIssue(
        issues,
        "duplicate_measurement_question_key",
        `${basePath}.question_keys`,
        `Concept "${concept.concept_key}" repeats question keys in its measurement plan.`,
      );
    }

    const questionIntents = concept.question_intents ?? [];
    if (
      concept.evidence_source === "survey_questions" &&
      concept.question_keys.length > 0 &&
      questionIntents.length !== concept.question_keys.length
    ) {
      addIssue(
        issues,
        "question_intents_mismatch",
        `${basePath}.question_intents`,
        `Concept "${concept.concept_key}" must carry one question intent per materialized question.`,
      );
    }

    const compatibleQuestionTypes = getCompatibleQuestionTypes(concept.measurement_type);

    for (const questionKey of concept.question_keys) {
      plannedQuestionKeys.add(questionKey);
      const question = questionIndex.get(questionKey);
      if (!question) {
        addIssue(
          issues,
          "unknown_measurement_question_key",
          `${basePath}.question_keys`,
          `Measurement plan references unknown question "${questionKey}".`,
        );
        continue;
      }

      if (
        compatibleQuestionTypes.length > 0 &&
        !compatibleQuestionTypes.includes(question.type)
      ) {
        addIssue(
          issues,
          "measurement_type_question_type_mismatch",
          `${basePath}.measurement_type`,
          `Concept "${concept.concept_key}" expects question types ${compatibleQuestionTypes.join(", ")} but uses "${question.type}".`,
        );
      }

      const mapping = mappingIndex.get(questionKey);
      if (!mapping) {
        addIssue(
          issues,
          "missing_measurement_mapping",
          `${basePath}.question_keys`,
          `Measurement plan question "${questionKey}" is missing a mapping contract entry.`,
        );
        continue;
      }

      const expectedConcept = getFlexpulseBehaviouralConcept(concept.concept_key);
      if (
        expectedConcept &&
        mapping.ontology_target !== expectedConcept.schema_target
      ) {
        addIssue(
          issues,
          "measurement_mapping_target_mismatch",
          `${basePath}.question_keys`,
          `Measurement plan question "${questionKey}" maps to "${mapping.ontology_target}" but concept "${concept.concept_key}" expects "${expectedConcept.schema_target}".`,
        );
      }
    }

    if (concept.measurement_type === "multi_item_likert_median") {
      if (concept.question_keys.length < 2) {
        addIssue(
          issues,
          "insufficient_multi_item_coverage",
          `${basePath}.question_keys`,
          `Concept "${concept.concept_key}" needs at least 2 questions for multi-item aggregation.`,
        );
      }
    }
  });

  for (const question of definition.questions) {
    if (!plannedQuestionKeys.has(question.question_key)) {
      addIssue(
        issues,
        "question_missing_from_measurement_plan",
        `questions.${question.question_key}`,
        `Question "${question.question_key}" is not referenced by the measurement plan.`,
      );
    }
  }

  return issues;
}

function validateQuestionDefinition(
  question: SurveyQuestionDefinition,
  issues: SurveyValidationIssue[],
  index: number,
) {
  const basePath = `questions[${index}]`;

  if (!question.question_key.trim()) {
    addIssue(
      issues,
      "empty_question_key",
      `${basePath}.question_key`,
      "Each question must define a non-empty question_key.",
    );
  }

  if (question.order < 1) {
    addIssue(
      issues,
      "invalid_question_order",
      `${basePath}.order`,
      "Question order must start at 1.",
    );
  }

  if (question.type === "single_choice" || question.type === "multiple_choice") {
    if (!question.options || question.options.length === 0) {
      addIssue(
        issues,
        "missing_options",
        `${basePath}.options`,
        "Choice questions must define at least one option.",
      );
    } else if (
      !hasUniqueValues(question.options.map((option) => option.option_key))
    ) {
      addIssue(
        issues,
        "duplicate_option_key",
        `${basePath}.options`,
        "Option keys must be unique inside each question.",
      );
    }
  }

  if (question.type === "rating_scale") {
    if (!question.scale) {
      addIssue(
        issues,
        "missing_scale_definition",
        `${basePath}.scale`,
        "Rating scale questions must define their scale boundaries.",
      );
    } else if (question.scale.min >= question.scale.max) {
      addIssue(
        issues,
        "invalid_scale_bounds",
        `${basePath}.scale`,
        "Rating scale min must be lower than max.",
      );
    }
  }
}

export function validateSurveyDefinition(
  definition: SurveyDefinition,
  options: SurveyDefinitionValidationOptions = {},
): SurveyValidationIssue[] {
  const issues: SurveyValidationIssue[] = [];
  const requireCompleteTranslations =
    options.require_complete_translations ?? true;

  if (definition.schema_version !== 1) {
    addIssue(
      issues,
      "unsupported_schema_version",
      "schema_version",
      "Only schema version 1 is supported right now.",
    );
  }

  const {
    default_language: defaultLanguage,
    supported_languages: supportedLanguages,
    response_context: responseContext,
  } = definition.survey_meta;

  if (!defaultLanguage.trim()) {
    addIssue(
      issues,
      "missing_default_language",
      "survey_meta.default_language",
      "Survey must define a default language.",
    );
  }

  if (supportedLanguages.length === 0) {
    addIssue(
      issues,
      "missing_supported_languages",
      "survey_meta.supported_languages",
      "Survey must define at least one supported language.",
    );
  }

  if (!supportedLanguages.includes(defaultLanguage)) {
    addIssue(
      issues,
      "default_language_not_supported",
      "survey_meta.default_language",
      "Default language must be included in supported_languages.",
    );
  }

  if (!hasUniqueValues(supportedLanguages)) {
    addIssue(
      issues,
      "duplicate_supported_language",
      "survey_meta.supported_languages",
      "Supported languages must not contain duplicates.",
    );
  }

  const invalidLanguages = getInvalidSurveyLanguages([
    defaultLanguage,
    ...supportedLanguages,
  ]);

  if (invalidLanguages.length > 0) {
    addIssue(
      issues,
      "unsupported_language",
      "survey_meta.supported_languages",
      `Unsupported survey language(s): ${invalidLanguages.join(", ")}.`,
    );
  }

  if (
    responseContext?.collect_postal_code === true &&
    responseContext.collect_country_code !== true
  ) {
    addIssue(
      issues,
      "postal_code_requires_country_code",
      "survey_meta.response_context.collect_country_code",
      "Collecting postal_code requires collect_country_code to be enabled as well.",
    );
  }

  if (
    responseContext?.enrich_weather_context === true &&
    (responseContext.collect_postal_code !== true ||
      responseContext.collect_country_code !== true)
  ) {
    addIssue(
      issues,
      "weather_enrichment_requires_location_context",
      "survey_meta.response_context.enrich_weather_context",
      "Weather enrichment requires both collect_postal_code and collect_country_code.",
    );
  }

  const questionKeys = definition.questions.map((question) => question.question_key);

  if (!hasUniqueValues(questionKeys)) {
    addIssue(
      issues,
      "duplicate_question_key",
      "questions",
      "Question keys must be unique across the survey definition.",
    );
  }

  definition.questions.forEach((question, index) => {
    validateQuestionDefinition(question, issues, index);
  });

  const languagesToValidate = requireCompleteTranslations
    ? supportedLanguages
    : [defaultLanguage];

  for (const language of languagesToValidate) {
    const translationBundle = definition.translations[language];

    if (!translationBundle) {
      addIssue(
        issues,
        "missing_language_bundle",
        `translations.${language}`,
        `Missing translations bundle for language "${language}".`,
      );
      continue;
    }

    if (!translationBundle.survey_title.trim()) {
      addIssue(
        issues,
        "missing_survey_title",
        `translations.${language}.survey_title`,
        `Survey title is required for language "${language}".`,
      );
    }

    for (const question of definition.questions) {
      const questionTranslation = translationBundle.questions[question.question_key];

      if (!questionTranslation || !questionTranslation.title.trim()) {
        addIssue(
          issues,
          "missing_question_title",
          `translations.${language}.questions.${question.question_key}.title`,
          `Question "${question.question_key}" is missing a title for language "${language}".`,
        );
      }

      if (
        (question.type === "single_choice" || question.type === "multiple_choice") &&
        question.options
      ) {
        for (const option of question.options) {
          const optionLabel = questionTranslation?.options?.[option.option_key];

          if (!optionLabel?.trim()) {
            addIssue(
              issues,
              "missing_option_label",
              `translations.${language}.questions.${question.question_key}.options.${option.option_key}`,
              `Option "${option.option_key}" is missing a label for language "${language}".`,
            );
          }
        }
      }
    }
  }

  return issues;
}

function validateMappingDefinition(
  mapping: SurveyMappingDefinition,
  issues: SurveyValidationIssue[],
  index: number,
  questionIndex: Map<string, SurveyQuestionDefinition>,
) {
  const basePath = `mappings[${index}]`;
  const question = questionIndex.get(mapping.question_key);

  if (!question) {
    addIssue(
      issues,
      "unknown_question_reference",
      `${basePath}.question_key`,
      `Mapping references unknown question "${mapping.question_key}".`,
    );
    return;
  }

  if (!mapping.ontology_target.trim()) {
    addIssue(
      issues,
      "missing_ontology_target",
      `${basePath}.ontology_target`,
      "Each mapping must define an ontology_target.",
    );
  }

  if (mapping.transform_strategy.kind === "enum_lookup") {
    if (
      question.type !== "single_choice" &&
      question.type !== "multiple_choice"
    ) {
      addIssue(
        issues,
        "invalid_enum_lookup",
        `${basePath}.transform_strategy`,
        "enum_lookup can only be used with choice questions.",
      );
    }

    const optionKeys = new Set(question.options?.map((option) => option.option_key) ?? []);

    for (const optionKey of Object.keys(mapping.transform_strategy.option_to_value)) {
      if (!optionKeys.has(optionKey)) {
        addIssue(
          issues,
          "unknown_option_reference",
          `${basePath}.transform_strategy.option_to_value.${optionKey}`,
          `Mapping references unknown option "${optionKey}".`,
        );
      }
    }
  }

  if (mapping.transform_strategy.kind === "numeric_range") {
    if (question.type !== "numeric" && question.type !== "rating_scale") {
      addIssue(
        issues,
        "invalid_numeric_range",
        `${basePath}.transform_strategy`,
        "numeric_range can only be used with numeric or rating_scale questions.",
      );
    }
  }

  if (mapping.transform_strategy.kind === "boolean_lookup") {
    if (
      question.type !== "single_choice" &&
      question.type !== "multiple_choice" &&
      question.type !== "boolean"
    ) {
      addIssue(
        issues,
        "invalid_boolean_lookup",
        `${basePath}.transform_strategy`,
        "boolean_lookup can only be used with boolean or choice questions.",
      );
    }
  }
}

export function validateMappingContract(
  contract: MappingContract,
  definition: SurveyDefinition,
): SurveyValidationIssue[] {
  const issues: SurveyValidationIssue[] = [];

  if (contract.schema_version !== 1) {
    addIssue(
      issues,
      "unsupported_mapping_schema_version",
      "schema_version",
      "Only mapping schema version 1 is supported right now.",
    );
  }

  const questionIndex = new Map(
    definition.questions.map((question) => [question.question_key, question]),
  );
  const mappingKeys = contract.mappings.map((mapping) => mapping.question_key);

  if (!hasUniqueValues(mappingKeys)) {
    addIssue(
      issues,
      "duplicate_mapping_question_key",
      "mappings",
      "Each question can only appear once in the mapping contract at this stage.",
    );
  }

  contract.mappings.forEach((mapping, index) => {
    validateMappingDefinition(mapping, issues, index, questionIndex);
  });

  return issues;
}

export function validateSurveyPublication(
  definition: SurveyDefinition,
  contract: MappingContract,
): SurveyValidationIssue[] {
  const measurementPlan = definition.survey_meta.measurement_plan_json;
  const issues = [
    ...validateSurveyDefinition(definition, {
      require_complete_translations: true,
    }),
    ...validateMappingContract(contract, definition),
  ];

  if (definition.questions.length === 0) {
    addIssue(
      issues,
      "missing_questions",
      "questions",
      "A survey must define at least one question before publication.",
    );
  }

  if (contract.mappings.length === 0) {
    addIssue(
      issues,
      "missing_mappings",
      "mappings",
      "A survey must define at least one semantic mapping before publication.",
    );
  }

  const mappedQuestionKeys = new Set(
    contract.mappings.map((mapping) => mapping.question_key),
  );

  for (const question of definition.questions) {
    if (!mappedQuestionKeys.has(question.question_key)) {
      addIssue(
        issues,
        "question_without_mapping",
        `questions.${question.question_key}`,
        `Question "${question.question_key}" does not have a mapping contract entry.`,
      );
    }
  }

  if (!measurementPlan) {
    addIssue(
      issues,
      "missing_measurement_plan",
      "survey_meta.measurement_plan_json",
      "A survey must define a measurement plan before publication.",
    );
    return issues;
  }

  if (measurementPlan.concepts.length === 0) {
    addIssue(
      issues,
      "missing_measurement_plan_concepts",
      "survey_meta.measurement_plan_json.concepts",
      "A survey must define at least one measurement plan concept before publication.",
    );
    return issues;
  }

  issues.push(...validateMeasurementPlanAlignment(definition, contract, measurementPlan));

  return issues;
}

export function validateGeneratedSurveyDraft(
  definition: SurveyDefinition,
  contract: MappingContract,
  measurementPlan?: MeasurementPlan,
): SurveyValidationIssue[] {
  const issues = [
    ...validateSurveyDefinition(definition, {
      require_complete_translations: false,
    }),
    ...validateMappingContract(contract, definition),
  ];

  if (definition.questions.length === 0) {
    addIssue(
      issues,
      "missing_questions",
      "questions",
      "A generated draft must define at least one question.",
    );
  }

  if (contract.mappings.length === 0) {
    addIssue(
      issues,
      "missing_mappings",
      "mappings",
      "A generated draft must define at least one semantic mapping.",
    );
  }

  const mappedQuestionKeys = new Set(
    contract.mappings.map((mapping) => mapping.question_key),
  );

  for (const question of definition.questions) {
    if (!mappedQuestionKeys.has(question.question_key)) {
      addIssue(
        issues,
        "question_without_mapping",
        `questions.${question.question_key}`,
        `Question "${question.question_key}" does not have a mapping contract entry.`,
      );
    }
  }

  if (measurementPlan) {
    issues.push(
      ...validateMeasurementPlanAlignment(
        definition,
        contract,
        measurementPlan,
      ),
    );
  }

  return issues;
}
