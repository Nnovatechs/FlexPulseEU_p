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
import type { MeasurementPlannerLLMOutput } from "./survey-generation-contracts";

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

export type MeasurementPlanBaseBlueprintEntry = {
  concept_key: string;
  evidence_source: MeasurementEvidenceSource;
  allowed_measurement_types: MeasurementType[];
  output_type: FlexpulseOutputType;
  slot_capacity_max: number;
  source_paths?: string[];
};

export type MeasurementPlanBaseBlueprint = {
  schema_version: 1;
  schema_namespace: "flexpulse_behavioural_schema";
  concepts: MeasurementPlanBaseBlueprintEntry[];
};

export type MeasurementPlanBlueprintEntry = MeasurementPlanBaseBlueprintEntry & {
  measurement_type: MeasurementType;
  aggregation_rule: MeasurementAggregationRule;
  threshold_profile: MeasurementThresholdProfile;
  minimum_answer_count: number;
  question_slots: MeasurementPlanQuestionSlot[];
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

function assertMeasurementTypeCompatibleWithCounts(
  conceptKey: string,
  measurementType: MeasurementType,
  slotCount: number,
  requiredSlotCount: number,
) {
  switch (measurementType) {
    case "context_passthrough":
    case "quality_flag_passthrough":
      if (slotCount !== 0 || requiredSlotCount !== 0) {
        throw new Error(
          `Planner must not require survey question slots for passthrough concept "${conceptKey}".`,
        );
      }
      return;
    case "multi_item_likert_median":
      if (slotCount < 2 || requiredSlotCount < 2) {
        throw new Error(
          `Planner must provide at least 2 usable items for multi-item concept "${conceptKey}".`,
        );
      }
      return;
    case "single_item_direct":
    case "single_choice_enum":
    case "multi_choice_tag_set":
    case "numeric_direct":
      if (slotCount !== 1 || requiredSlotCount !== 1) {
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
  if (concept.concept_role === "quality_signal") {
    return "pipeline_flags";
  }

  if (concept.concept_role === "context_signal") {
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

function deriveThresholdProfileForMeasurementType(
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
  slotCount: number,
  requiredSlotCount: number,
): MeasurementPlanQuestionSlot[] {
  if (slotCount === 0) {
    return [];
  }

  const prefix = toSlotPrefix(conceptKey);
  return Array.from({ length: slotCount }, (_, index) => ({
    slot_key: `SLOT_${prefix}_${String(index + 1).padStart(2, "0")}`,
    required: index < requiredSlotCount,
  }));
}

export function createMeasurementPlanBlueprint(
  conceptKeys: string[],
): MeasurementPlanBaseBlueprint {
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

      return {
        concept_key: concept.concept_key,
        evidence_source: evidenceSource,
        allowed_measurement_types: config.allowed_measurement_types,
        output_type: concept.output_type,
        slot_capacity_max:
          evidenceSource === "survey_questions" ? config.slot_capacity_max : 0,
        source_paths: deriveSourcePaths(concept),
      };
    }),
  };
}

export function applyMeasurementPlannerOutput(
  blueprint: MeasurementPlanBaseBlueprint,
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
      if (entry.evidence_source !== "survey_questions" && planned.slot_count > 0) {
        throw new Error(
          `Planner must not create survey question coverage for non-question concept "${entry.concept_key}".`,
        );
      }
      if (
        entry.evidence_source === "survey_questions" &&
        planned.slot_count === 0
      ) {
        throw new Error(
          `Planner must create at least one survey question slot for "${entry.concept_key}".`,
        );
      }
      if (planned.required_slot_count > planned.slot_count) {
        throw new Error(
          `Planner returned impossible required_slot_count for "${entry.concept_key}".`,
        );
      }
      if (planned.slot_count > entry.slot_capacity_max) {
        throw new Error(
          `Planner exceeded slot capacity for concept "${entry.concept_key}".`,
        );
      }
      assertMeasurementTypeAllowed(
        entry.concept_key,
        planned.measurement_type,
        entry.allowed_measurement_types,
      );
      assertMeasurementTypeCompatibleWithCounts(
        entry.concept_key,
        planned.measurement_type,
        planned.slot_count,
        planned.required_slot_count,
      );

      return {
        ...entry,
        measurement_type: planned.measurement_type,
        aggregation_rule: planned.aggregation_rule,
        threshold_profile: planned.threshold_profile,
        minimum_answer_count: planned.required_slot_count,
        question_slots: buildQuestionSlots(
          entry.concept_key,
          planned.slot_count,
          planned.required_slot_count,
        ),
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
  const baseBlueprint = createMeasurementPlanBlueprint(conceptKeys);

  return {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: baseBlueprint.concepts.map((entry) => {
      const concept = getFlexpulseBehaviouralConcept(entry.concept_key);
      if (!concept) {
        throw new Error(`Unknown FlexPulse behavioural concept "${entry.concept_key}".`);
      }

      if (entry.evidence_source !== "survey_questions") {
        return {
          concept_key: entry.concept_key,
          evidence_source: entry.evidence_source,
          measurement_type: entry.allowed_measurement_types[0] ?? "context_passthrough",
          output_type: entry.output_type,
          aggregation_rule: "context_passthrough",
          threshold_profile: "none",
          minimum_answer_count: 0,
          question_keys: [],
          required_question_keys: [],
          source_paths: entry.source_paths,
        };
      }

      const question_keys = mappings
        .filter((mapping) => mapping.ontology_target === concept.schema_target)
        .map((mapping) => mapping.question_key);

      const preferredMeasurementTypes: MeasurementType[] = [
        "multi_item_likert_median",
        "multi_choice_tag_set",
        "single_choice_enum",
        "numeric_direct",
        "single_item_direct",
      ];
      const measurementType =
        preferredMeasurementTypes.find(
          (type) =>
            entry.allowed_measurement_types.includes(type) &&
            ((type === "multi_item_likert_median" && question_keys.length >= 2) ||
              (type === "multi_choice_tag_set" && concept.output_type === "string[]") ||
              (type === "single_choice_enum" && concept.output_type === "enum") ||
              (type === "numeric_direct" && concept.output_type === "number") ||
              type === "single_item_direct"),
        ) ??
        entry.allowed_measurement_types[0] ??
        "single_item_direct";
      const minimum_answer_count = Math.min(
        question_keys.length,
        deriveStructuralMinimumAnswerCount(measurementType),
      );
      const required_question_keys = question_keys.slice(0, minimum_answer_count);
      return {
        concept_key: entry.concept_key,
        evidence_source: entry.evidence_source,
        measurement_type: measurementType,
        output_type: entry.output_type,
        aggregation_rule:
          measurementType === "multi_item_likert_median"
            ? "median"
            : measurementType === "multi_choice_tag_set"
              ? "set_union"
              : "identity",
        threshold_profile: deriveThresholdProfileForMeasurementType(
          measurementType,
          entry.output_type,
        ),
        minimum_answer_count,
        question_keys,
        required_question_keys,
        source_paths: entry.source_paths,
      };
    }),
  };
}
