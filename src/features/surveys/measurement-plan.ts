import {
  getFlexpulseBehaviouralConcept,
  type FlexpulseBehaviouralConcept,
  type FlexpulseOutputType,
} from "@/features/ontology/flexpulse-behavioural-schema";
import {
  getGeneratorTargetConfigByConceptKey,
  type GeneratorTargetConfig,
} from "./generator-config";
import type {
  MeasurementAggregationRule,
  MeasurementThresholdProfile,
} from "./generator-types";
import type { MeasurementPlannerLLMOutput } from "./generator-llm-types";

export type MeasurementEvidenceSource =
  | "survey_questions"
  | "response_context"
  | "enrichment"
  | "pipeline_flags";

export type MeasurementType =
  | "single_item_direct"
  | "multi_item_likert_median"
  | "single_choice_enum"
  | "multi_choice_tag_set"
  | "numeric_direct"
  | "context_passthrough"
  | "quality_flag_passthrough";

export type MeasurementPlanQuestionSlot = {
  slot_key: string;
  required: boolean;
};

export type MeasurementPlanBlueprintEntry = {
  concept_key: string;
  evidence_source: MeasurementEvidenceSource;
  allowed_measurement_types: MeasurementType[];
  measurement_type: MeasurementType;
  output_type: FlexpulseOutputType;
  aggregation_rule: MeasurementAggregationRule;
  threshold_profile: MeasurementThresholdProfile;
  minimum_answer_count: number;
  question_slots: MeasurementPlanQuestionSlot[];
  source_paths?: string[];
};

export type MeasurementPlanBlueprint = {
  schema_version: 1;
  schema_namespace: "flexpulse_behavioural_schema";
  concepts: MeasurementPlanBlueprintEntry[];
};

export type MeasurementPlanEntry = {
  concept_key: string;
  evidence_source: MeasurementEvidenceSource;
  measurement_type: MeasurementType;
  output_type: FlexpulseOutputType;
  aggregation_rule: MeasurementAggregationRule;
  threshold_profile: MeasurementThresholdProfile;
  minimum_answer_count: number;
  question_keys: string[];
  required_question_keys: string[];
  source_paths?: string[];
};

export type MeasurementPlan = {
  schema_version: 1;
  schema_namespace: "flexpulse_behavioural_schema";
  concepts: MeasurementPlanEntry[];
};

function assertMeasurementTypeCompatibleWithSlots(
  conceptKey: string,
  measurementType: MeasurementType,
  questionSlots: MeasurementPlanQuestionSlot[],
  minimumAnswerCount: number,
) {
  switch (measurementType) {
    case "context_passthrough":
    case "quality_flag_passthrough":
      if (questionSlots.length !== 0) {
        throw new Error(
          `Planner must not create survey question slots for passthrough concept "${conceptKey}".`,
        );
      }
      return;
    case "multi_item_likert_median":
      if (questionSlots.length < 2 || minimumAnswerCount < 2) {
        throw new Error(
          `Planner must provide at least 2 usable items for multi-item concept "${conceptKey}".`,
        );
      }
      return;
    case "single_item_direct":
    case "single_choice_enum":
    case "multi_choice_tag_set":
    case "numeric_direct":
      if (questionSlots.length !== 1 || minimumAnswerCount !== 1) {
        throw new Error(
          `Planner must use exactly 1 required question slot for single-step concept "${conceptKey}".`,
        );
      }
      return;
    default:
      return;
  }
}

function assertMeasurementTypeAllowed(
  conceptKey: string,
  measurementType: MeasurementType,
  allowedMeasurementTypes: MeasurementType[],
) {
  if (allowedMeasurementTypes.includes(measurementType)) {
    return;
  }

  throw new Error(
    `Planner selected unsupported measurement type "${measurementType}" for concept "${conceptKey}".`,
  );
}

function toSlotPrefix(conceptKey: string) {
  return conceptKey.replace(/[^a-z0-9]+/gi, "_").toUpperCase();
}

function deriveEvidenceSource(
  concept: FlexpulseBehaviouralConcept,
): MeasurementEvidenceSource {
  if (concept.layer === "quality_signals") {
    return "pipeline_flags";
  }

  if (concept.layer === "response_context") {
    if (
      concept.concept_key === "climate_context" ||
      concept.concept_key === "normalized_location_context"
    ) {
      return "enrichment";
    }

    return "response_context";
  }

  return "survey_questions";
}

function deriveDefaultMeasurementType(
  concept: Pick<FlexpulseBehaviouralConcept, "descriptor_role" | "output_type">,
  config: Pick<GeneratorTargetConfig, "allowed_measurement_types">,
): MeasurementType {
  if (config.allowed_measurement_types.length === 1) {
    return config.allowed_measurement_types[0];
  }

  if (concept.output_type === "string[]") {
    return "multi_choice_tag_set";
  }

  if (concept.output_type === "enum") {
    return "single_choice_enum";
  }

  if (
    concept.output_type === "number" &&
    concept.descriptor_role === "applicability_factor"
  ) {
    return "numeric_direct";
  }

  if (concept.descriptor_role === "primary_profile_axis") {
    return "multi_item_likert_median";
  }

  return "single_item_direct";
}

function deriveDefaultAggregationRule(
  measurementType: MeasurementType,
): MeasurementAggregationRule {
  switch (measurementType) {
    case "multi_item_likert_median":
      return "median";
    case "multi_choice_tag_set":
      return "set_union";
    case "context_passthrough":
    case "quality_flag_passthrough":
      return "context_passthrough";
    case "single_item_direct":
    case "single_choice_enum":
    case "numeric_direct":
    default:
      return "identity";
  }
}

function deriveStructuralMinimumAnswerCount(
  measurementType: MeasurementType,
): number {
  switch (measurementType) {
    case "multi_item_likert_median":
      return 2;
    case "single_item_direct":
    case "single_choice_enum":
    case "multi_choice_tag_set":
    case "numeric_direct":
      return 1;
    case "context_passthrough":
    case "quality_flag_passthrough":
    default:
      return 0;
  }
}

function deriveDefaultThresholdProfile(
  measurementType: MeasurementType,
  outputType: FlexpulseOutputType,
): MeasurementThresholdProfile {
  switch (measurementType) {
    case "multi_item_likert_median":
      return "likert_1_5_low_mid_high";
    case "single_choice_enum":
      return "enum_identity";
    case "multi_choice_tag_set":
      return "asset_inventory";
    case "numeric_direct":
      return "numeric_temperature_window";
    case "context_passthrough":
    case "quality_flag_passthrough":
      return "none";
    case "single_item_direct":
    default:
      return outputType === "number" ? "likert_1_5_low_mid_high" : "none";
  }
}

function deriveSourcePaths(
  concept: FlexpulseBehaviouralConcept,
): string[] | undefined {
  switch (concept.concept_key) {
    case "country_code":
      return ["response_context.country_code"];
    case "survey_language":
      return ["response_context.language_code"];
    case "normalized_location_context":
      return ["response_enrichment.normalized_location_json"];
    case "climate_context":
      return [
        "response_enrichment.outdoor_temperature_c",
        "response_enrichment.apparent_temperature_c",
        "response_enrichment.weather_context_quality",
      ];
    case "mapping_low_confidence":
      return ["mapping_quality.low_confidence"];
    case "mapping_requires_review":
      return ["mapping_quality.requires_review"];
    default:
      return undefined;
  }
}

function buildQuestionSlots(
  conceptKey: string,
  evidenceSource: MeasurementEvidenceSource,
  config: Pick<GeneratorTargetConfig, "slot_capacity_max">,
): MeasurementPlanQuestionSlot[] {
  if (evidenceSource !== "survey_questions") {
    return [];
  }

  const prefix = toSlotPrefix(conceptKey);
  return Array.from({ length: config.slot_capacity_max }, (_, index) => ({
    slot_key: `SLOT_${prefix}_${String(index + 1).padStart(2, "0")}`,
    required: false,
  }));
}

export function createMeasurementPlanBlueprint(
  conceptKeys: string[],
): MeasurementPlanBlueprint {
  return {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: conceptKeys.map((conceptKey) => {
      const concept = getFlexpulseBehaviouralConcept(conceptKey);

      if (!concept) {
        throw new Error(`Unknown FlexPulse behavioural concept "${conceptKey}".`);
      }

      const config = getGeneratorTargetConfigByConceptKey(conceptKey);
      const evidenceSource = deriveEvidenceSource(concept);
      const defaultMeasurementType = deriveDefaultMeasurementType(concept, config);

      return {
        concept_key: concept.concept_key,
        evidence_source: evidenceSource,
        allowed_measurement_types: config.allowed_measurement_types,
        measurement_type: defaultMeasurementType,
        output_type: concept.output_type,
        aggregation_rule: deriveDefaultAggregationRule(defaultMeasurementType),
        threshold_profile: deriveDefaultThresholdProfile(
          defaultMeasurementType,
          concept.output_type,
        ),
        minimum_answer_count: deriveStructuralMinimumAnswerCount(
          defaultMeasurementType,
        ),
        question_slots: buildQuestionSlots(concept.concept_key, evidenceSource, config),
        source_paths: deriveSourcePaths(concept),
      };
    }),
  };
}

export function applyMeasurementPlannerOutput(
  blueprint: MeasurementPlanBlueprint,
  plannerOutput: MeasurementPlannerLLMOutput,
): MeasurementPlanBlueprint {
  const plannerByConcept = Object.fromEntries(
    plannerOutput.concepts.map((concept) => [concept.concept_key, concept]),
  );

  return {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: blueprint.concepts.map((entry) => {
      const planned = plannerByConcept[entry.concept_key];
      if (!planned) {
        throw new Error(
          `Measurement planner did not return a concept plan for "${entry.concept_key}".`,
        );
      }
      if (entry.evidence_source !== "survey_questions" && planned.question_slots.length > 0) {
        throw new Error(
          `Planner must not create survey question slots for non-question concept "${entry.concept_key}".`,
        );
      }
      if (
        entry.evidence_source === "survey_questions" &&
        planned.question_slots.length === 0
      ) {
        throw new Error(
          `Planner must create at least one survey question slot for "${entry.concept_key}".`,
        );
      }
      if (planned.minimum_answer_count > planned.question_slots.length) {
        throw new Error(
          `Planner returned impossible minimum_answer_count for "${entry.concept_key}".`,
        );
      }
      assertMeasurementTypeAllowed(
        entry.concept_key,
        planned.measurement_type,
        entry.allowed_measurement_types,
      );
      assertMeasurementTypeCompatibleWithSlots(
        entry.concept_key,
        planned.measurement_type,
        planned.question_slots,
        planned.minimum_answer_count,
      );

      return {
        ...entry,
        measurement_type: planned.measurement_type,
        aggregation_rule: planned.aggregation_rule,
        threshold_profile: planned.threshold_profile,
        minimum_answer_count: planned.minimum_answer_count,
        question_slots: planned.question_slots,
      };
    }),
  };
}

export function materializeMeasurementPlan(
  blueprint: MeasurementPlanBlueprint,
  questionKeyBindings: Record<string, string>,
): MeasurementPlan {
  return {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: blueprint.concepts.map((entry) => {
      const question_keys = entry.question_slots.map((slot) => {
        const boundQuestionKey = questionKeyBindings[slot.slot_key];
        if (!boundQuestionKey) {
          throw new Error(`Missing question key binding for slot "${slot.slot_key}".`);
        }
        return boundQuestionKey;
      });

      const required_question_keys = entry.question_slots
        .filter((slot) => slot.required)
        .map((slot) => {
          const boundQuestionKey = questionKeyBindings[slot.slot_key];
          if (!boundQuestionKey) {
            throw new Error(`Missing question key binding for slot "${slot.slot_key}".`);
          }
          return boundQuestionKey;
        });

      return {
        concept_key: entry.concept_key,
        evidence_source: entry.evidence_source,
        measurement_type: entry.measurement_type,
        output_type: entry.output_type,
        aggregation_rule: entry.aggregation_rule,
        threshold_profile: entry.threshold_profile,
        minimum_answer_count: entry.minimum_answer_count,
        question_keys,
        required_question_keys,
        source_paths: entry.source_paths,
      };
    }),
  };
}

export function createMeasurementPlanFromMappings(
  conceptKeys: string[],
  mappings: Array<{ question_key: string; ontology_target: string }>,
): MeasurementPlan {
  const blueprint = createMeasurementPlanBlueprint(conceptKeys);

  return {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: blueprint.concepts.map((entry) => {
      const concept = getFlexpulseBehaviouralConcept(entry.concept_key);
      if (!concept) {
        throw new Error(`Unknown FlexPulse behavioural concept "${entry.concept_key}".`);
      }

      if (entry.evidence_source !== "survey_questions") {
        return {
          concept_key: entry.concept_key,
          evidence_source: entry.evidence_source,
          measurement_type: entry.measurement_type,
          output_type: entry.output_type,
          aggregation_rule: entry.aggregation_rule,
          threshold_profile: entry.threshold_profile,
          minimum_answer_count: entry.minimum_answer_count,
          question_keys: [],
          required_question_keys: [],
          source_paths: entry.source_paths,
        };
      }

      const question_keys = mappings
        .filter((mapping) => mapping.ontology_target === concept.schema_target)
        .map((mapping) => mapping.question_key);

      const minimum_answer_count = deriveStructuralMinimumAnswerCount(
        entry.measurement_type,
      );
      const required_question_keys = question_keys.slice(0, minimum_answer_count);
      return {
        concept_key: entry.concept_key,
        evidence_source: entry.evidence_source,
        measurement_type: entry.measurement_type,
        output_type: entry.output_type,
        aggregation_rule: entry.aggregation_rule,
        threshold_profile: entry.threshold_profile,
        minimum_answer_count,
        question_keys,
        required_question_keys,
        source_paths: entry.source_paths,
      };
    }),
  };
}
