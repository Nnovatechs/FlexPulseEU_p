import { FLEXPULSE_DER_ASSET_VALUES } from "@/features/ontology/flexpulse-behavioural-schema";
import type {
  MappingContract,
  MeasurementPlan,
  MeasurementPlanEntry,
  SurveyMappingDefinition,
  SurveyQuestionDefinition,
} from "./generator-types";
import type {
  MeasurementPlanBlueprint,
  MeasurementPlanBlueprintEntry,
} from "./measurement-plan";

export const DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION = "v1" as const;
export const DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY =
  "declared_flexibility_capability" as const;
export const DECLARED_FLEXIBILITY_CAPABILITY_TARGET =
  "flexpulse_behavioural_schema.declared_flexibility_capability" as const;
export const DFC_INVENTORY_CONCEPT_KEY = "owned_der_assets" as const;
export const DFC_INVENTORY_QUESTION_KEY = "Q_OWNED_DER_ASSETS_01" as const;
export const DFC_INVENTORY_SLOT_KEY = "SLOT_OWNED_DER_ASSETS_01" as const;

const DFC_INVENTORY_TARGET =
  "flexpulse_behavioural_schema.owned_der_assets" as const;
const DFC_EXCLUSIVE_OPTION_KEYS = ["none_of_these", "not_sure"] as const;
const DFC_COMPONENTS = [
  "operational_control",
  "temporal_slack",
  "service_preservation",
  "household_coordination",
] as const;
export const DFC_COMPONENT_COUNT = DFC_COMPONENTS.length;

export type DeclaredFlexibilityCapabilityComponent =
  (typeof DFC_COMPONENTS)[number];

export type DeclaredFlexibilityCapabilitySetKey =
  | "washing_machine_scheduling"
  | "ev_charging"
  | "space_conditioning"
  | "water_heating"
  | "battery_operation";

type CapabilitySetSource = {
  set_key: DeclaredFlexibilityCapabilitySetKey;
  subject: string;
  triggering_assets: string[];
};

export type DeclaredFlexibilityCapabilityQuestionBlueprint = {
  slot_key: string;
  question_key: string;
  component: DeclaredFlexibilityCapabilityComponent;
  facet: DeclaredFlexibilityCapabilitySetKey;
  intent: string;
  polarity: "positive";
  ontology_target: typeof DECLARED_FLEXIBILITY_CAPABILITY_TARGET;
  type: "rating_scale";
  required: true;
  visibility_rule: {
    source_question_key: typeof DFC_INVENTORY_QUESTION_KEY;
    operator: "contains_any";
    values: string[];
  };
};

export type DeclaredFlexibilityCapabilitySetBlueprint = {
  set_key: DeclaredFlexibilityCapabilitySetKey;
  triggering_assets: string[];
  questions: DeclaredFlexibilityCapabilityQuestionBlueprint[];
};

export type DeclaredFlexibilityCapabilityBlueprintArtifact = {
  module_version: typeof DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION;
  concept_key: typeof DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY;
  ontology_target: typeof DECLARED_FLEXIBILITY_CAPABILITY_TARGET;
  inventory_question_key: typeof DFC_INVENTORY_QUESTION_KEY;
  sets: DeclaredFlexibilityCapabilitySetBlueprint[];
};

export type DeclaredFlexibilityCapabilityDefinitionArtifacts = {
  module_version: typeof DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION;
  surveyMeta: {
    capability_module_version: typeof DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION;
  };
  questions: SurveyQuestionDefinition[];
  mappingContract: MappingContract;
  measurementPlan: MeasurementPlan;
};

const CAPABILITY_SET_SOURCES: CapabilitySetSource[] = [
  {
    set_key: "washing_machine_scheduling",
    subject: "the household washing machine",
    triggering_assets: ["washing_machine"],
  },
  {
    set_key: "ev_charging",
    subject: "electric-vehicle charging",
    triggering_assets: ["ev"],
  },
  {
    set_key: "space_conditioning",
    subject: "household heating or cooling",
    triggering_assets: ["heat_pump", "air_conditioning"],
  },
  {
    set_key: "water_heating",
    subject: "the household hot-water tank",
    triggering_assets: ["hot_water_tank"],
  },
  {
    set_key: "battery_operation",
    subject: "the home battery",
    triggering_assets: ["battery_storage"],
  },
];

export const DFC_SET_KEYS = CAPABILITY_SET_SOURCES.map((set) => set.set_key);
export const DFC_ANALYSIS_CATALOG_ID = "declared_flexibility_capability_v1" as const;

export const DFC_MODULE_LABELS: Record<DeclaredFlexibilityCapabilitySetKey, string> = {
  washing_machine_scheduling: "Washing machine",
  ev_charging: "EV charging",
  space_conditioning: "Space conditioning",
  water_heating: "Water heating",
  battery_operation: "Battery operation",
};

export const DFC_COMPONENT_LABELS: Record<DeclaredFlexibilityCapabilityComponent, string> = {
  operational_control: "Operational control",
  temporal_slack: "Temporal slack",
  service_preservation: "Service preservation",
  household_coordination: "Household coordination",
};

export type ConditionalModuleAnalysisCatalog = {
  id: typeof DFC_ANALYSIS_CATALOG_ID;
  groupingSource: "question_intent.facet";
  expectedGroups: DeclaredFlexibilityCapabilitySetKey[];
  expectedComponents: DeclaredFlexibilityCapabilityComponent[];
  groupLabels: Record<string, string>;
  componentLabels: Record<string, string>;
};

export function getDeclaredFlexibilityCapabilityAnalysisCatalog(): ConditionalModuleAnalysisCatalog {
  return {
    id: DFC_ANALYSIS_CATALOG_ID,
    groupingSource: "question_intent.facet",
    expectedGroups: [...DFC_SET_KEYS],
    expectedComponents: [...DFC_COMPONENTS],
    groupLabels: { ...DFC_MODULE_LABELS },
    componentLabels: { ...DFC_COMPONENT_LABELS },
  };
}

const COMPONENT_INTENT_TEMPLATES: Record<
  DeclaredFlexibilityCapabilityComponent,
  (subject: string) => string
> = {
  operational_control: (subject) =>
    `Measure practical access to manual or scheduled control of ${subject}.`,
  temporal_slack: (subject) =>
    `Measure recurring ability to move the operation of ${subject} to another time.`,
  service_preservation: (subject) =>
    `Measure ability to shift ${subject} without losing the service the household needs.`,
  household_coordination: (subject) =>
    `Measure whether shifting ${subject} is compatible with household routines and needs.`,
};

function toUpperSnakeCase(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function buildQuestionKey(
  setKey: DeclaredFlexibilityCapabilitySetKey,
  component: DeclaredFlexibilityCapabilityComponent,
) {
  return `Q_DFC_${toUpperSnakeCase(setKey)}_${toUpperSnakeCase(component)}`;
}

function buildSlotKey(
  setKey: DeclaredFlexibilityCapabilitySetKey,
  component: DeclaredFlexibilityCapabilityComponent,
) {
  return `SLOT_DFC_${toUpperSnakeCase(setKey)}_${toUpperSnakeCase(component)}`;
}

const DFC_BLUEPRINT: DeclaredFlexibilityCapabilityBlueprintArtifact = {
  module_version: DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION,
  concept_key: DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
  ontology_target: DECLARED_FLEXIBILITY_CAPABILITY_TARGET,
  inventory_question_key: DFC_INVENTORY_QUESTION_KEY,
  sets: CAPABILITY_SET_SOURCES.map((set) => ({
    set_key: set.set_key,
    triggering_assets: [...set.triggering_assets],
    questions: DFC_COMPONENTS.map((component) => ({
      slot_key: buildSlotKey(set.set_key, component),
      question_key: buildQuestionKey(set.set_key, component),
      component,
      facet: set.set_key,
      intent: COMPONENT_INTENT_TEMPLATES[component](set.subject),
      polarity: "positive",
      ontology_target: DECLARED_FLEXIBILITY_CAPABILITY_TARGET,
      type: "rating_scale",
      required: true,
      visibility_rule: {
        source_question_key: DFC_INVENTORY_QUESTION_KEY,
        operator: "contains_any",
        values: [...set.triggering_assets],
      },
    })),
  })),
};

/**
 * Returns whether the selected ontology concepts request the DFC module.
 */
export function hasDeclaredFlexibilityCapability(
  conceptKeys: Iterable<string>,
): boolean {
  return Array.from(conceptKeys).includes(
    DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
  );
}

/**
 * Adds the inventory dependency when DFC is selected, preserving stable order.
 */
export function ensureDeclaredFlexibilityCapabilityDependencies(
  conceptKeys: Iterable<string>,
): string[] {
  const normalized = Array.from(new Set(conceptKeys));

  if (
    hasDeclaredFlexibilityCapability(normalized) &&
    !normalized.includes(DFC_INVENTORY_CONCEPT_KEY)
  ) {
    normalized.push(DFC_INVENTORY_CONCEPT_KEY);
  }

  return normalized;
}

/**
 * Produces a fresh deterministic blueprint for writer slots and DFC triggers.
 */
export function createDeclaredFlexibilityCapabilityBlueprintArtifact():
  DeclaredFlexibilityCapabilityBlueprintArtifact {
  return structuredClone(DFC_BLUEPRINT);
}

function createLockedWriterBlueprintEntries(): MeasurementPlanBlueprintEntry[] {
  const blueprint = createDeclaredFlexibilityCapabilityBlueprintArtifact();
  const capabilitySlots = blueprint.sets.flatMap((set) =>
    set.questions.map((question) => ({
      slot_key: question.slot_key,
      facet: question.facet,
      intent: question.intent,
      polarity: question.polarity,
    })),
  );

  return [
    {
      concept_key: DFC_INVENTORY_CONCEPT_KEY,
      evidence_source: "survey_questions",
      allowed_measurement_types: ["multi_choice_tag_set"],
      output_type: "string[]",
      slot_capacity_max: 1,
      measurement_type: "multi_choice_tag_set",
      aggregation_rule: "set_union",
      threshold_profile: "asset_inventory",
      minimum_answer_count: 1,
      question_slots: [
        {
          slot_key: DFC_INVENTORY_SLOT_KEY,
          facet: "asset_inventory",
          intent:
            "Ask which household energy assets and flexible appliances are present or regularly available, including shared, rented, or household-owned equipment.",
          polarity: "neutral",
        },
      ],
    },
    {
      concept_key: DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
      evidence_source: "survey_questions",
      allowed_measurement_types: ["multi_item_likert_mean"],
      output_type: "number",
      slot_capacity_max: capabilitySlots.length,
      measurement_type: "multi_item_likert_mean",
      aggregation_rule: "mean",
      threshold_profile: "likert_1_5_low_mid_high",
      minimum_answer_count: DFC_COMPONENT_COUNT,
      question_slots: capabilitySlots,
    },
  ];
}

/**
 * Appends the locked inventory and twenty DFC slots to a planner-owned blueprint.
 */
export function mergeDeclaredFlexibilityCapabilityWriterBlueprint(
  plannerBlueprint: MeasurementPlanBlueprint,
): MeasurementPlanBlueprint {
  return {
    ...structuredClone(plannerBlueprint),
    concepts: [
      ...structuredClone(plannerBlueprint.concepts),
      ...createLockedWriterBlueprintEntries(),
    ],
  };
}

function createInventoryQuestion(order: number): SurveyQuestionDefinition {
  return {
    question_key: DFC_INVENTORY_QUESTION_KEY,
    type: "multiple_choice",
    required: true,
    order,
    exclusive_option_keys: [...DFC_EXCLUSIVE_OPTION_KEYS],
    options: [
      ...FLEXPULSE_DER_ASSET_VALUES.map((asset) => ({
        option_key: asset,
        value: asset,
      })),
      { option_key: "none_of_these", value: "none_of_these" },
      { option_key: "not_sure", value: "not_sure" },
    ],
  };
}

function createInventoryMapping(): SurveyMappingDefinition {
  return {
    question_key: DFC_INVENTORY_QUESTION_KEY,
    ontology_target: DFC_INVENTORY_TARGET,
    expected_type: "string[]",
    required_for_mapping: true,
    transform_strategy: {
      kind: "enum_lookup",
      option_to_value: Object.fromEntries(
        FLEXPULSE_DER_ASSET_VALUES.map((asset) => [asset, asset]),
      ),
    },
    validation_constraints: {
      allowed_values: [...FLEXPULSE_DER_ASSET_VALUES],
    },
  };
}

function createMeasurementEntries(
  questionBlueprints: DeclaredFlexibilityCapabilityQuestionBlueprint[],
): MeasurementPlanEntry[] {
  const inventoryEntry: MeasurementPlanEntry = {
    concept_key: DFC_INVENTORY_CONCEPT_KEY,
    evidence_source: "survey_questions",
    measurement_type: "multi_choice_tag_set",
    output_type: "string[]",
    aggregation_rule: "set_union",
    threshold_profile: "asset_inventory",
    minimum_answer_count: 1,
    question_keys: [DFC_INVENTORY_QUESTION_KEY],
    required_question_keys: [DFC_INVENTORY_QUESTION_KEY],
    question_intents: [
      {
        slot_key: DFC_INVENTORY_SLOT_KEY,
        question_key: DFC_INVENTORY_QUESTION_KEY,
        facet: "asset_inventory",
        intent:
          "Identify household energy assets and flexible appliances currently available for use.",
        polarity: "neutral",
      },
    ],
  };
  const questionKeys = questionBlueprints.map((question) => question.question_key);
  const capabilityEntry: MeasurementPlanEntry = {
    concept_key: DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
    evidence_source: "survey_questions",
    measurement_type: "multi_item_likert_mean",
    output_type: "number",
    aggregation_rule: "mean",
    threshold_profile: "likert_1_5_low_mid_high",
    minimum_answer_count: DFC_COMPONENT_COUNT,
    question_keys: questionKeys,
    required_question_keys: questionKeys,
    question_intents: questionBlueprints.map((question) => ({
      slot_key: question.slot_key,
      question_key: question.question_key,
      facet: question.facet,
      intent: question.intent,
      polarity: question.polarity,
    })),
  };

  return [inventoryEntry, capabilityEntry];
}

/**
 * Compiles inventory, conditional questions, mappings, and measurement metadata.
 */
export function createDeclaredFlexibilityCapabilityDefinitionArtifacts(
  startingOrder = 1,
): DeclaredFlexibilityCapabilityDefinitionArtifacts {
  const blueprint = createDeclaredFlexibilityCapabilityBlueprintArtifact();
  const questionBlueprints = blueprint.sets.flatMap((set) => set.questions);
  const questions: SurveyQuestionDefinition[] = [
    createInventoryQuestion(startingOrder),
    ...questionBlueprints.map((question, index) => ({
      question_key: question.question_key,
      type: question.type,
      required: question.required,
      order: startingOrder + index + 1,
      visibility_rule: structuredClone(question.visibility_rule),
      scale: {
        min: 1,
        max: 5,
        step: 1,
      },
    })),
  ];
  const mappings: SurveyMappingDefinition[] = [
    createInventoryMapping(),
    ...questionBlueprints.map((question) => ({
      question_key: question.question_key,
      ontology_target: DECLARED_FLEXIBILITY_CAPABILITY_TARGET,
      expected_type: "number" as const,
      required_for_mapping: true,
      transform_strategy: {
        kind: "numeric_range" as const,
        min: 1,
        max: 5,
      },
      validation_constraints: {
        min: 1,
        max: 5,
      },
    })),
  ];

  return {
    module_version: DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION,
    surveyMeta: {
      capability_module_version:
        DECLARED_FLEXIBILITY_CAPABILITY_MODULE_VERSION,
    },
    questions,
    mappingContract: {
      schema_version: 1,
      mappings,
    },
    measurementPlan: {
      schema_version: 1,
      schema_namespace: "flexpulse_behavioural_schema",
      concepts: createMeasurementEntries(questionBlueprints),
    },
  };
}
