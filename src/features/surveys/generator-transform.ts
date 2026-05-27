import {
  MappingContract,
  SurveyDefinition,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "./generator-types";
import { getGeneratorTargetConfig } from "./generator-config";
import type { MeasurementPlanBlueprint, MeasurementType } from "./measurement-plan";
import {
  SurveyGeneratorLLMOutput,
  SurveyGeneratorLLMQuestion,
} from "./survey-generation-contracts";

type TransformGeneratedSurveyInput = {
  output: SurveyGeneratorLLMOutput;
  baseDefinition: SurveyDefinition;
  defaultLanguage: string;
  supportedLanguages: string[];
  ontologyTargets: string[];
  measurementPlanBlueprint: MeasurementPlanBlueprint;
  fallbackSurveyTitle: string;
  fallbackSurveyDescription: string;
};

type TransformGeneratedSurveyResult = {
  definition: SurveyDefinition;
  mappingContract: MappingContract;
  slotBindings: Record<string, string>;
};

const GENERIC_RATING_INSTRUCTION_PATTERNS = [
  /\brate how true this is for you\b/i,
  /\brate your agreement\b/i,
  /\brate how willing you are\b/i,
  /\buse a scale\b/i,
  /\bscale\s+\d/i,
  /\bstrongly disagree\b/i,
];

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

function looksLikeStandalonePrompt(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.endsWith("?")) {
    return true;
  }

  return /\b(i|i'm|i’d|i'd|i am|my|me|we|our|you|your|would|could|should|can|prefer|trust|accept|understand|know|allow|want|need|tolerate|consider|feel|am|is|are)\b/i.test(
    trimmed,
  );
}

function looksLikeMetadataLabel(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  if (looksLikeStandalonePrompt(trimmed)) {
    return false;
  }

  return trimmed.split(/\s+/).length <= 12;
}

function normalizeQuestionCopy(question: SurveyGeneratorLLMQuestion) {
  const title = question.title.trim();
  const description = question.description.trim();
  const descriptionLooksGeneric = GENERIC_RATING_INSTRUCTION_PATTERNS.some((pattern) =>
    pattern.test(description),
  );

  if (
    description &&
    looksLikeMetadataLabel(title) &&
    looksLikeStandalonePrompt(description) &&
    !descriptionLooksGeneric
  ) {
    return {
      ...question,
      title: description,
      description: "",
    };
  }

  return {
    ...question,
    title,
    description,
  };
}

const PREFERRED_TARIFF_LABEL_BY_ONTOLOGY_VALUE: Record<string, string> = {
  fixed_price: "Same price most of the time",
  fixed_tariff: "Same price most of the time",
  same_price: "Same price most of the time",
  time_of_use: "Cheaper electricity at certain times of day",
  tou: "Cheaper electricity at certain times of day",
  shift_rewards: "Rewards for shifting use when asked",
  shift_reward: "Rewards for shifting use when asked",
  flexibility_rewards: "Rewards for shifting use when asked",
  dynamic_price: "Prices change often, with more risk and possible savings",
  dynamic_pricing: "Prices change often, with more risk and possible savings",
  variable_pricing: "Prices change often, with more risk and possible savings",
  not_sure: "Not sure / I would need more information",
  unsure: "Not sure / I would need more information",
  dont_know: "Not sure / I would need more information",
};

function getPreferredTariffOptionLabel(option: SurveyGeneratorLLMQuestion["options"][number]) {
  const canonical = PREFERRED_TARIFF_LABEL_BY_ONTOLOGY_VALUE[option.ontology_value.trim()];
  if (canonical) {
    return canonical;
  }

  return option.label.trim();
}

function normalizeChoiceOptions(question: SurveyGeneratorLLMQuestion) {
  const baseKeys = question.options.map((option) =>
    slugify(option.ontology_value || option.label || "option"),
  );
  const uniqueKeys = ensureUniqueKeys(baseKeys);

  return question.options.map((option, index) => ({
    option_key: uniqueKeys[index] || `option_${index + 1}`,
    value: option.ontology_value.trim(),
    label:
      question.ontology_target === "flexpulse_behavioural_schema.preferred_tariff_model"
        ? getPreferredTariffOptionLabel(option)
        : option.label.trim(),
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

function assertQuestionMatchesPlan(
  question: SurveyGeneratorLLMQuestion,
  blueprintBySlot: Map<string, MeasurementPlanBlueprint["concepts"][number]>,
) {
  const config = getGeneratorTargetConfig(question.ontology_target);
  const plannedConcept = blueprintBySlot.get(question.slot_key);

  if (!plannedConcept) {
    throw new Error(`Unexpected slot "${question.slot_key}" in generated survey.`);
  }

  if (plannedConcept.concept_key !== config.concept.concept_key) {
    throw new Error(
      `Slot "${question.slot_key}" belongs to "${plannedConcept.concept_key}" but question targets "${config.concept.concept_key}".`,
    );
  }

  const compatibleQuestionTypes = getCompatibleQuestionTypes(
    plannedConcept.measurement_type,
  );

  if (
    compatibleQuestionTypes.length > 0 &&
    !compatibleQuestionTypes.includes(question.type)
  ) {
    throw new Error(
      `Question for "${question.ontology_target}" uses "${question.type}" but measurement type "${plannedConcept.measurement_type}" only allows ${compatibleQuestionTypes.join(", ")}.`,
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
  const blueprintBySlot = new Map<
    string,
    MeasurementPlanBlueprint["concepts"][number]
  >();

  nextDefinition.survey_meta.default_language = input.defaultLanguage;
  nextDefinition.survey_meta.supported_languages = input.supportedLanguages;
  nextDefinition.survey_meta.estimated_completion_minutes =
    input.output.estimated_completion_minutes;
  nextDefinition.survey_meta.ontology_targets = input.ontologyTargets;

  const questions: SurveyQuestionDefinition[] = [];
  const mappings: SurveyMappingDefinition[] = [];
  const slotBindings: Record<string, string> = {};
  const defaultLanguageQuestions: SurveyDefinition["translations"][string]["questions"] =
    {};

  input.measurementPlanBlueprint.concepts.forEach((concept) => {
    concept.question_slots.forEach((slot) => {
      blueprintBySlot.set(slot.slot_key, concept);
    });
  });

  input.output.questions.forEach((question, index) => {
    const normalizedQuestion = normalizeQuestionCopy(question);
    const config = assertQuestionMatchesPlan(normalizedQuestion, blueprintBySlot);
    const duplicateCount =
      (duplicatesByTarget.get(normalizedQuestion.ontology_target) ?? 0) + 1;
    duplicatesByTarget.set(normalizedQuestion.ontology_target, duplicateCount);

    const questionKey = buildQuestionKey(normalizedQuestion, duplicateCount);
    if (slotBindings[normalizedQuestion.slot_key]) {
      throw new Error(
        `Duplicate measurement slot "${normalizedQuestion.slot_key}" in generated survey.`,
      );
    }
    slotBindings[normalizedQuestion.slot_key] = questionKey;
    const normalizedOptions = normalizeChoiceOptions(normalizedQuestion);

    questions.push({
      question_key: questionKey,
      type: normalizedQuestion.type,
      required: true,
      order: index + 1,
      options:
        normalizedQuestion.type === "single_choice" ||
        normalizedQuestion.type === "multiple_choice"
          ? normalizedOptions.map((option) => ({
              option_key: option.option_key,
              value: option.value,
            }))
          : undefined,
      scale:
        normalizedQuestion.type === "rating_scale" && normalizedQuestion.scale
          ? {
              min: normalizedQuestion.scale.min,
              max: normalizedQuestion.scale.max,
              step: normalizedQuestion.scale.step,
              min_label: normalizedQuestion.scale.min_label,
              max_label: normalizedQuestion.scale.max_label,
            }
          : undefined,
      numeric:
        normalizedQuestion.type === "numeric" && normalizedQuestion.numeric
          ? {
              min: normalizedQuestion.numeric.min ?? undefined,
              max: normalizedQuestion.numeric.max ?? undefined,
              unit: normalizedQuestion.numeric.unit ?? undefined,
            }
          : undefined,
    });

    defaultLanguageQuestions[questionKey] = {
      title: normalizedQuestion.title.trim(),
      description: normalizedQuestion.description.trim() || undefined,
      options:
        normalizedQuestion.type === "single_choice" ||
        normalizedQuestion.type === "multiple_choice"
          ? Object.fromEntries(
              normalizedOptions.map((option) => [option.option_key, option.label]),
            )
          : undefined,
    };

    mappings.push({
      question_key: questionKey,
      ontology_target: normalizedQuestion.ontology_target,
      expected_type: config.expected_type,
      required_for_mapping: true,
      transform_strategy: buildTransformStrategy(
        normalizedQuestion,
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
    slotBindings,
  };
}
