import { getFlexpulseBehaviouralConcept } from "@/features/ontology/flexpulse-behavioural-schema";
import type {
  CompiledMappingContract,
  MapperOutput,
  MeasurementPlanEntry,
  PersistedSurvey,
  SurveyMappingDefinition,
} from "./generator-types";
import { compileMappingContract } from "./generator-mapping";
import { getFacetEvidenceLevel } from "./measurement-plan";
import type { SubmittedSurveyAnswer } from "./response-validation";

export const RESPONSE_MAPPER_VERSION = "v1";
export const THRESHOLD_PROFILE_VERSION = "v1";

export type ResponseEnrichmentRecord = {
  provider: string | null;
  normalized_country_code: string | null;
  location_agg_code: string | null;
  location_agg_label: string | null;
  location_granularity: string | null;
  centroid_lat: number | null;
  centroid_lon: number | null;
  normalized_location_json: unknown;
  temp_outdoor_c: number | null;
  humidity_pct: number | null;
  observed_at: string | null;
  quality_flag: string | null;
};

export type ResponseMapperInput = {
  survey: PersistedSurvey;
  answers: Record<string, SubmittedSurveyAnswer>;
  submittedLanguage: string;
  countryCodeRaw: string | null;
  mappingHashAtSubmission: string | null;
  measurementHashAtSubmission: string | null;
  enrichment: ResponseEnrichmentRecord | null;
};

function normalizeCountryCode(value: string | null) {
  return value?.trim().toUpperCase() || null;
}

function getCompiledMappingContract(survey: PersistedSurvey): CompiledMappingContract {
  return survey.mapping_compiled_json ?? compileMappingContract(survey.mapping_contract_json);
}

function applyTransformStrategy(
  answer: SubmittedSurveyAnswer | undefined,
  mapping: SurveyMappingDefinition,
): string | number | boolean | string[] | number[] | null {
  const strategy = mapping.transform_strategy;

  if (answer == null) {
    return null;
  }

  if (strategy.kind === "identity") {
    return answer;
  }

  if (strategy.kind === "numeric_range") {
    return typeof answer === "number" ? answer : null;
  }

  if (strategy.kind === "boolean_lookup") {
    if (typeof answer === "boolean") {
      return answer;
    }

    if (typeof answer === "string") {
      return strategy.truthy_option_keys.includes(answer);
    }

    if (Array.isArray(answer)) {
      return answer.some((value) =>
        typeof value === "string" && strategy.truthy_option_keys.includes(value),
      );
    }

    return null;
  }

  if (strategy.kind === "enum_lookup") {
    if (typeof answer === "string") {
      return strategy.option_to_value[answer] ?? null;
    }

    if (Array.isArray(answer)) {
      const values = answer
        .map((value) =>
          typeof value === "string" ? strategy.option_to_value[value] : null,
        )
        .filter((value): value is string => Boolean(value));

      return Array.from(new Set(values));
    }
  }

  return null;
}

function computeMedian(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function deriveTag(
  value: string | number | boolean | string[] | number[] | null,
  thresholdProfile: MeasurementPlanEntry["threshold_profile"],
) {
  if (typeof value !== "number") {
    return undefined;
  }

  if (
    thresholdProfile === "likert_1_5_low_mid_high" ||
    thresholdProfile === "likert_1_5_low_mid_high_strict"
  ) {
    if (value <= 2) {
      return "low" as const;
    }

    if (value >= 4) {
      return "high" as const;
    }

    return "medium" as const;
  }

  return undefined;
}

function applyQuestionPolarity(
  questionKey: string,
  value: string | number | boolean | string[] | number[] | null,
  concept: MeasurementPlanEntry,
  mapping: SurveyMappingDefinition,
) {
  const questionIntent = concept.question_intents?.find(
    (intent) => intent.question_key === questionKey,
  );

  if (
    questionIntent?.polarity !== "negative" ||
    typeof value !== "number" ||
    mapping.transform_strategy.kind !== "numeric_range"
  ) {
    return value;
  }

  const { min, max } = mapping.transform_strategy;
  if (typeof min !== "number" || typeof max !== "number") {
    return value;
  }

  return min + max - value;
}

type QuestionValue = {
  questionKey: string;
  value: string | number | boolean | string[] | number[];
};

function getQuestionValues(
  concept: MeasurementPlanEntry,
  compiledMapping: CompiledMappingContract,
  answers: Record<string, SubmittedSurveyAnswer>,
): QuestionValue[] | null {
  for (const questionKey of concept.required_question_keys) {
    const mapping = compiledMapping.by_question_key[questionKey];
    if (!mapping) {
      return null;
    }

    const value = applyTransformStrategy(answers[questionKey], mapping);

    if (value == null) {
      return null;
    }
  }

  return concept.question_keys
    .map((questionKey) => {
      const mapping = compiledMapping.by_question_key[questionKey];
      const value = applyTransformStrategy(answers[questionKey], mapping);

      return {
        questionKey,
        value: applyQuestionPolarity(questionKey, value, concept, mapping),
      };
    })
    .filter((item): item is QuestionValue => item.value != null);
}

function aggregateValues(
  values: Array<string | number | boolean | string[] | number[]>,
  concept: MeasurementPlanEntry,
) {
  if (values.length < concept.minimum_answer_count) {
    return null;
  }

  switch (concept.aggregation_rule) {
    case "identity":
    case "context_passthrough":
      return values[0] ?? null;
    case "mean": {
      const numericValues = values.filter(
        (value): value is number => typeof value === "number",
      );
      if (numericValues.length < concept.minimum_answer_count) {
        return null;
      }
      return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
    }
    case "median": {
      const numericValues = values.filter(
        (value): value is number => typeof value === "number",
      );
      if (numericValues.length < concept.minimum_answer_count) {
        return null;
      }
      return computeMedian(numericValues);
    }
    case "set_union": {
      const flatValues = values.flatMap((value) =>
        Array.isArray(value) ? value : [value],
      );
      return Array.from(
        new Set(flatValues.filter((value): value is string => typeof value === "string")),
      );
    }
    default:
      return values[0] ?? null;
  }
}

function aggregateQuestionValues(
  concept: MeasurementPlanEntry,
  questionValues: QuestionValue[] | null,
) {
  if (questionValues == null) {
    return null;
  }

  return aggregateValues(
    questionValues.map((item) => item.value),
    concept,
  );
}

function buildFacetSignals(
  concept: MeasurementPlanEntry,
  questionValues: QuestionValue[],
): MapperOutput["profile"][string]["facets"] {
  const intentsByQuestion = new Map(
    (concept.question_intents ?? []).map((intent) => [intent.question_key, intent]),
  );
  const valuesByFacet = new Map<
    string,
    Array<string | number | boolean | string[] | number[]>
  >();

  for (const item of questionValues) {
    const intent = intentsByQuestion.get(item.questionKey);
    if (!intent?.facet.trim()) {
      continue;
    }

    const values = valuesByFacet.get(intent.facet) ?? [];
    values.push(item.value);
    valuesByFacet.set(intent.facet, values);
  }

  if (valuesByFacet.size === 0) {
    return undefined;
  }

  return Object.fromEntries(
    Array.from(valuesByFacet.entries()).map(([facet, values]) => [
      facet,
      {
        value:
          values.length >= 2
            ? aggregateValues(values, { ...concept, minimum_answer_count: values.length })
            : values[0],
        evidence_count: values.length,
        evidence_level: getFacetEvidenceLevel(concept, facet),
      },
    ]),
  );
}

function buildProfile(
  input: ResponseMapperInput,
  compiledMapping: CompiledMappingContract,
): MapperOutput["profile"] {
  const measurementPlan = input.survey.definition_json.survey_meta.measurement_plan_json;

  if (!measurementPlan) {
    throw new Error("Survey is missing measurement_plan_json.");
  }

  return Object.fromEntries(
    measurementPlan.concepts
      .filter((concept) => {
        const ontologyConcept = getFlexpulseBehaviouralConcept(concept.concept_key);
        return (
          ontologyConcept &&
          ontologyConcept.concept_role !== "context_signal" &&
          // quality_signal concepts (e.g. mapping_low_confidence) are planned in the
          // ontology/measurement plan but not emitted here yet; see feat/evals-mapper-profiling
          // for profiling evidence work that may extend MapperOutput later.
          ontologyConcept.concept_role !== "quality_signal"
        );
      })
      .map((concept) => {
        const questionValues = getQuestionValues(concept, compiledMapping, input.answers);
        const value = aggregateQuestionValues(concept, questionValues);
        const tag = deriveTag(value, concept.threshold_profile);
        const facets =
          value == null || questionValues == null
            ? undefined
            : buildFacetSignals(concept, questionValues);

        return [
          concept.concept_key,
          {
            value,
            ...(tag ? { tag } : {}),
            ...(facets ? { facets } : {}),
          },
        ];
      }),
  );
}

function buildContextMetadata(input: ResponseMapperInput): MapperOutput["context_metadata"] {
  return {
    country_code:
      input.enrichment?.normalized_country_code ??
      normalizeCountryCode(input.countryCodeRaw),
    survey_language: input.submittedLanguage,
    location: input.enrichment
      ? {
          agg_code: input.enrichment.location_agg_code,
          label: input.enrichment.location_agg_label,
          granularity: input.enrichment.location_granularity,
          centroid_lat: input.enrichment.centroid_lat,
          centroid_lon: input.enrichment.centroid_lon,
        }
      : null,
    climate: input.enrichment
      ? {
          provider: input.enrichment.provider,
          quality_flag: input.enrichment.quality_flag,
          observed_at: input.enrichment.observed_at,
          temp_outdoor_c: input.enrichment.temp_outdoor_c,
          humidity_pct: input.enrichment.humidity_pct,
        }
      : null,
  };
}

export function mapSurveyResponseToOutput(input: ResponseMapperInput): MapperOutput {
  const compiledMapping = getCompiledMappingContract(input.survey);
  const mappingHashUsed =
    input.mappingHashAtSubmission ?? input.survey.mapping_hash ?? null;
  const measurementHashUsed =
    input.measurementHashAtSubmission ?? input.survey.measurement_hash ?? null;

  return {
    profile: buildProfile(input, compiledMapping),
    context_metadata: buildContextMetadata(input),
    mapping_metadata: {
      mapping_hash: mappingHashUsed,
      measurement_hash: measurementHashUsed,
      mapping_hash_at_submission: input.mappingHashAtSubmission,
      measurement_hash_at_submission: input.measurementHashAtSubmission,
      mapper_version: RESPONSE_MAPPER_VERSION,
      threshold_profile_version: THRESHOLD_PROFILE_VERSION,
    },
  };
}
