import {
  MappingContract,
  SurveyDefinition,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "./generator-types";

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

  const { default_language: defaultLanguage, supported_languages: supportedLanguages } =
    definition.survey_meta;

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

  return issues;
}

export function validateGeneratedSurveyDraft(
  definition: SurveyDefinition,
  contract: MappingContract,
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

  return issues;
}
