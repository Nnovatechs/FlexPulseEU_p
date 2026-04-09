import {
  getFlexpulseBehaviouralConcept,
  type FlexpulseAggregationRule,
  type FlexpulseBehaviouralConcept,
  type FlexpulseOutputType,
  type FlexpulseThresholdProfile,
} from "@/features/ontology/flexpulse-behavioural-schema";

export type MeasurementEvidenceSource =
  | "survey_questions"
  | "response_context"
  | "enrichment"
  | "pipeline_flags";

export type MeasurementQuestionRole =
  | "anchor"
  | "core"
  | "supporting"
  | "informative_only";

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
  role: MeasurementQuestionRole;
  required: boolean;
};

export type MeasurementPlanBlueprintEntry = {
  concept_key: string;
  evidence_source: MeasurementEvidenceSource;
  measurement_type: MeasurementType;
  output_type: FlexpulseOutputType;
  aggregation_rule: FlexpulseAggregationRule;
  threshold_profile: FlexpulseThresholdProfile;
  minimum_answer_count: number;
  question_slots: MeasurementPlanQuestionSlot[];
  source_v1_targets: string[];
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
  aggregation_rule: FlexpulseAggregationRule;
  threshold_profile: FlexpulseThresholdProfile;
  minimum_answer_count: number;
  question_keys: string[];
  required_question_keys: string[];
  question_roles: Record<string, MeasurementQuestionRole>;
  source_v1_targets: string[];
  source_paths?: string[];
};

export type MeasurementPlan = {
  schema_version: 1;
  schema_namespace: "flexpulse_behavioural_schema";
  concepts: MeasurementPlanEntry[];
};

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

function deriveMeasurementType(
  concept: FlexpulseBehaviouralConcept,
): MeasurementType {
  switch (concept.measurement_family) {
    case "likert_construct":
      return concept.recommended_item_count > 1
        ? "multi_item_likert_median"
        : "single_item_direct";
    case "single_choice_enum":
      return "single_choice_enum";
    case "multi_select_inventory":
      return "multi_choice_tag_set";
    case "numeric_preference":
      return "numeric_direct";
    case "contextual_signal":
      return "context_passthrough";
    case "quality_flag":
      return "quality_flag_passthrough";
    case "binary_applicability":
    default:
      return "single_item_direct";
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
  concept: FlexpulseBehaviouralConcept,
): MeasurementPlanQuestionSlot[] {
  const evidenceSource = deriveEvidenceSource(concept);
  if (evidenceSource !== "survey_questions") {
    return [];
  }

  const prefix = toSlotPrefix(concept.concept_key);
  return Array.from({ length: concept.recommended_item_count }, (_, index) => ({
    slot_key: `SLOT_${prefix}_${String(index + 1).padStart(2, "0")}`,
    role:
      concept.recommended_item_count === 1
        ? concept.descriptor_role === "applicability_factor"
          ? "informative_only"
          : "core"
        : index === 0
          ? "anchor"
          : "core",
    required: index < concept.minimum_item_count,
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

      return {
        concept_key: concept.concept_key,
        evidence_source: deriveEvidenceSource(concept),
        measurement_type: deriveMeasurementType(concept),
        output_type: concept.output_type,
        aggregation_rule: concept.default_aggregation_rule,
        threshold_profile: concept.threshold_profile,
        minimum_answer_count: concept.minimum_item_count,
        question_slots: buildQuestionSlots(concept),
        source_v1_targets: concept.source_v1_targets,
        source_paths: deriveSourcePaths(concept),
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

      const question_roles = Object.fromEntries(
        entry.question_slots.map((slot) => {
          const boundQuestionKey = questionKeyBindings[slot.slot_key];
          if (!boundQuestionKey) {
            throw new Error(`Missing question key binding for slot "${slot.slot_key}".`);
          }
          return [boundQuestionKey, slot.role];
        }),
      ) satisfies Record<string, MeasurementQuestionRole>;

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
        question_roles,
        source_v1_targets: entry.source_v1_targets,
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
          question_roles: {},
          source_v1_targets: entry.source_v1_targets,
          source_paths: entry.source_paths,
        };
      }

      const question_keys = mappings
        .filter((mapping) => mapping.ontology_target === concept.schema_target)
        .map((mapping) => mapping.question_key);

      const required_question_keys = question_keys.slice(0, entry.minimum_answer_count);
      const question_roles = Object.fromEntries(
        question_keys.map((questionKey, index) => [
          questionKey,
          index === 0 && question_keys.length > 1 ? "anchor" : "core",
        ]),
      ) as Record<string, MeasurementQuestionRole>;

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
        question_roles,
        source_v1_targets: entry.source_v1_targets,
        source_paths: entry.source_paths,
      };
    }),
  };
}
