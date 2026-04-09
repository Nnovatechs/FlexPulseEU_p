import {
  MappingContract,
  SurveyDefinition,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "./generator-types";
import { getGeneratorTargetConfig } from "./generator-config";
import {
  SurveyGeneratorLLMOutput,
  SurveyGeneratorLLMQuestion,
} from "./generator-llm-types";

type TransformGeneratedSurveyInput = {
  output: SurveyGeneratorLLMOutput;
  baseDefinition: SurveyDefinition;
  defaultLanguage: string;
  supportedLanguages: string[];
  ontologyTargets: string[];
  fallbackSurveyTitle: string;
  fallbackSurveyDescription: string;
};

type TransformGeneratedSurveyResult = {
  definition: SurveyDefinition;
  mappingContract: MappingContract;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function ensureUniqueKeys(values: string[]) {
  const seen = new Map<string, number>();

  return values.map((value) => {
    const current = seen.get(value) ?? 0;
    seen.set(value, current + 1);

    if (current === 0) {
      return value;
    }

    return `${value}_${current + 1}`;
  });
}

function buildQuestionKey(
  question: SurveyGeneratorLLMQuestion,
  duplicateIndex: number,
) {
  const targetSuffix = question.ontology_target
    .replace(/^flexpulse_behavioural_schema\./, "")
    .split(".")
    .join("_");
  const safeTarget = slugify(targetSuffix).toUpperCase();

  return `Q_${safeTarget}_${duplicateIndex.toString().padStart(2, "0")}`;
}

function normalizeChoiceOptions(question: SurveyGeneratorLLMQuestion) {
  const baseKeys = question.options.map((option) =>
    slugify(option.ontology_value || option.label || "option"),
  );
  const uniqueKeys = ensureUniqueKeys(baseKeys);

  return question.options.map((option, index) => ({
    option_key: uniqueKeys[index] || `option_${index + 1}`,
    value: option.ontology_value.trim(),
    label: option.label.trim(),
    is_truthy: option.is_truthy,
  }));
}

function buildTransformStrategy(
  question: SurveyGeneratorLLMQuestion,
  normalizedOptions: ReturnType<typeof normalizeChoiceOptions>,
  expectedType: "string" | "number" | "boolean" | "string[]",
): SurveyMappingDefinition["transform_strategy"] {
  if (question.type === "rating_scale" || question.type === "numeric") {
    return {
      kind: "numeric_range",
      min:
        question.type === "rating_scale"
          ? question.scale?.min
          : question.numeric?.min ?? undefined,
      max:
        question.type === "rating_scale"
          ? question.scale?.max
          : question.numeric?.max ?? undefined,
      unit: question.numeric?.unit ?? undefined,
    };
  }

  if (expectedType === "boolean") {
    return {
      kind: "boolean_lookup",
      truthy_option_keys: normalizedOptions
        .filter((option) => option.is_truthy)
        .map((option) => option.option_key),
    };
  }

  return {
    kind: "enum_lookup",
    option_to_value: Object.fromEntries(
      normalizedOptions.map((option) => [option.option_key, option.value]),
    ),
  };
}

function assertQuestionMatchesConfig(question: SurveyGeneratorLLMQuestion) {
  const config = getGeneratorTargetConfig(question.ontology_target);

  if (question.type !== config.question_type) {
    throw new Error(
      `Question for "${question.ontology_target}" must use "${config.question_type}", got "${question.type}".`,
    );
  }

  if (
    (question.type === "single_choice" || question.type === "multiple_choice") &&
    question.options.length === 0
  ) {
    throw new Error(
      `Question for "${question.ontology_target}" must include at least one option.`,
    );
  }

  if (question.type === "rating_scale" && !question.scale) {
    throw new Error(
      `Question for "${question.ontology_target}" must define a rating scale.`,
    );
  }

  if (question.type === "numeric" && !question.numeric) {
    throw new Error(
      `Question for "${question.ontology_target}" must define numeric bounds.`,
    );
  }

  return config;
}

export function transformGeneratedSurvey(
  input: TransformGeneratedSurveyInput,
): TransformGeneratedSurveyResult {
  const nextDefinition = structuredClone(input.baseDefinition);
  const duplicatesByTarget = new Map<string, number>();

  nextDefinition.survey_meta.default_language = input.defaultLanguage;
  nextDefinition.survey_meta.supported_languages = input.supportedLanguages;
  nextDefinition.survey_meta.estimated_completion_minutes =
    input.output.estimated_completion_minutes;
  nextDefinition.survey_meta.ontology_targets = input.ontologyTargets;

  const questions: SurveyQuestionDefinition[] = [];
  const mappings: SurveyMappingDefinition[] = [];
  const defaultLanguageQuestions: SurveyDefinition["translations"][string]["questions"] =
    {};

  input.output.questions.forEach((question, index) => {
    const config = assertQuestionMatchesConfig(question);
    const duplicateCount = (duplicatesByTarget.get(question.ontology_target) ?? 0) + 1;
    duplicatesByTarget.set(question.ontology_target, duplicateCount);

    const questionKey = buildQuestionKey(question, duplicateCount);
    const normalizedOptions = normalizeChoiceOptions(question);

    questions.push({
      question_key: questionKey,
      type: question.type,
      required: question.required,
      order: index + 1,
      options:
        question.type === "single_choice" || question.type === "multiple_choice"
          ? normalizedOptions.map((option) => ({
              option_key: option.option_key,
              value: option.value,
            }))
          : undefined,
      scale:
        question.type === "rating_scale" && question.scale
          ? {
              min: question.scale.min,
              max: question.scale.max,
              step: question.scale.step,
              min_label: question.scale.min_label,
              max_label: question.scale.max_label,
            }
          : undefined,
      numeric:
        question.type === "numeric" && question.numeric
          ? {
              min: question.numeric.min ?? undefined,
              max: question.numeric.max ?? undefined,
              unit: question.numeric.unit ?? undefined,
            }
          : undefined,
    });

    defaultLanguageQuestions[questionKey] = {
      title: question.title.trim(),
      description: question.description.trim() || undefined,
      options:
        question.type === "single_choice" || question.type === "multiple_choice"
          ? Object.fromEntries(
              normalizedOptions.map((option) => [option.option_key, option.label]),
            )
          : undefined,
    };

    mappings.push({
      question_key: questionKey,
      ontology_target: question.ontology_target,
      expected_type: config.expected_type,
      required_for_mapping: question.required,
      transform_strategy: buildTransformStrategy(
        question,
        normalizedOptions,
        config.expected_type,
      ),
    });
  });

  nextDefinition.questions = questions;

  for (const language of input.supportedLanguages) {
    nextDefinition.translations[language] ??= {
      survey_title: "",
      survey_description: "",
      questions: {},
    };

    if (language === input.defaultLanguage) {
      nextDefinition.translations[language] = {
        survey_title:
          input.output.survey_title.trim() || input.fallbackSurveyTitle.trim(),
        survey_description:
          input.output.survey_description.trim() ||
          input.fallbackSurveyDescription.trim(),
        questions: defaultLanguageQuestions,
      };
      continue;
    }

    nextDefinition.translations[language] = {
      survey_title: nextDefinition.translations[language].survey_title ?? "",
      survey_description:
        nextDefinition.translations[language].survey_description ?? "",
      questions: {},
    };
  }

  return {
    definition: nextDefinition,
    mappingContract: {
      schema_version: 1,
      mappings,
    },
  };
}
