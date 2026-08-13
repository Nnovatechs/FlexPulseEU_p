import { computeContentHash } from "./content-validator";
import { computeMappingHash, computeMeasurementHash } from "./generator-mapping";
import type {
  MeasurementPlan,
  MeasurementPlanEntry,
  PersistedSurvey,
  SurveyDefinition,
} from "./generator-types";
import { computeMultilingualTranslationHash } from "./translation-validation";

export const THERMAL_COMFORT_REPAIRED_FACET_KEY =
  "temporary_deviation_intolerance" as const;
export const THERMAL_COMFORT_LEGACY_FACET_KEY =
  "temporary_deviation_tolerance" as const;
export const FLEXIBILITY_THERMAL_INTENT_LEGACY_TEXT =
  "Collect willingness to accept a temporary indoor temperature change of 1°C for 1 hour during a high-demand period, assuming the adjustment is technically possible." as const;
export const FLEXIBILITY_THERMAL_INTENT_REPAIRED_TEXT =
  "Collect willingness to accept a temporary indoor temperature change of 2°C for 2 hours during a high-demand period, assuming the adjustment is technically possible." as const;

function repairThermalComfortEntry(entry: MeasurementPlanEntry) {
  if (entry.concept_key !== "thermal_comfort_norms") {
    return {
      entry,
      changed: false,
    };
  }

  if (!entry.question_intents || entry.question_intents.length === 0) {
    throw new Error(
      "Thermal comfort repair requires question intents on the measurement plan entry.",
    );
  }

  const legacyCount = entry.question_intents.filter(
    (intent) => intent.facet === THERMAL_COMFORT_LEGACY_FACET_KEY,
  ).length;
  const repairedCount = entry.question_intents.filter(
    (intent) => intent.facet === THERMAL_COMFORT_REPAIRED_FACET_KEY,
  ).length;

  if (legacyCount > 0 && repairedCount > 0) {
    throw new Error(
      "Thermal comfort repair found mixed legacy and repaired temporary-deviation facets.",
    );
  }

  if (legacyCount === 0 && repairedCount === 0) {
    throw new Error(
      "Thermal comfort repair could not find the temporary-deviation facet to validate.",
    );
  }

  if (legacyCount === 0) {
    return {
      entry,
      changed: false,
    };
  }

  return {
    entry: {
      ...entry,
      question_intents: entry.question_intents.map((intent) =>
        intent.facet === THERMAL_COMFORT_LEGACY_FACET_KEY
          ? { ...intent, facet: THERMAL_COMFORT_REPAIRED_FACET_KEY }
          : intent,
      ),
    },
    changed: true,
  };
}

export function repairThermalComfortMeasurementPlan(
  measurementPlan: MeasurementPlan,
): {
  measurementPlan: MeasurementPlan;
  changed: boolean;
} {
  let changed = false;
  let thermalConceptSeen = false;

  const concepts = measurementPlan.concepts.map((entry) => {
    if (entry.concept_key === "thermal_comfort_norms") {
      thermalConceptSeen = true;
    }

    const repaired = repairThermalComfortEntry(entry);
    changed ||= repaired.changed;
    return repaired.entry;
  });

  if (!thermalConceptSeen) {
    throw new Error("Thermal comfort repair could not find a thermal_comfort_norms entry.");
  }

  return {
    measurementPlan: {
      ...measurementPlan,
      concepts,
    },
    changed,
  };
}

export function prepareThermalComfortFacetRepair(survey: PersistedSurvey): {
  changed: boolean;
  nextDefinition: SurveyDefinition;
  previousMeasurementHash: string | null;
  nextMeasurementHash: string | null;
} {
  const measurementPlan = survey.definition_json.survey_meta.measurement_plan_json;
  if (!measurementPlan) {
    throw new Error("Survey is missing measurement_plan_json.");
  }

  const previousContentHash = computeContentHash(
    survey.definition_json.questions,
    survey.definition_json.translations[survey.default_language],
  );
  const previousTranslationHash =
    survey.definition_json.survey_meta.multilingual_validation_result == null
      ? null
      : computeMultilingualTranslationHash(
          survey.definition_json,
          survey.definition_json.survey_meta.multilingual_validation_result.validated_languages,
        );
  const previousMappingHash = computeMappingHash(survey.mapping_contract_json);
  const previousMeasurementHash = computeMeasurementHash(measurementPlan);
  const repaired = repairThermalComfortMeasurementPlan(measurementPlan);

  if (!repaired.changed) {
    return {
      changed: false,
      nextDefinition: survey.definition_json,
      previousMeasurementHash,
      nextMeasurementHash: previousMeasurementHash,
    };
  }

  const nextDefinition = structuredClone(survey.definition_json);
  nextDefinition.survey_meta.measurement_plan_json = repaired.measurementPlan;

  const nextContentHash = computeContentHash(
    nextDefinition.questions,
    nextDefinition.translations[survey.default_language],
  );
  const nextTranslationHash =
    nextDefinition.survey_meta.multilingual_validation_result == null
      ? null
      : computeMultilingualTranslationHash(
          nextDefinition,
          nextDefinition.survey_meta.multilingual_validation_result.validated_languages,
        );
  const nextMeasurementHash = computeMeasurementHash(repaired.measurementPlan);

  if (nextContentHash !== previousContentHash) {
    throw new Error("Thermal facet repair unexpectedly changed the survey content hash.");
  }
  if (nextTranslationHash !== previousTranslationHash) {
    throw new Error("Thermal facet repair unexpectedly changed the translation hash.");
  }
  if (computeMappingHash(survey.mapping_contract_json) !== previousMappingHash) {
    throw new Error("Thermal facet repair unexpectedly changed the mapping hash.");
  }
  if (nextMeasurementHash === previousMeasurementHash) {
    throw new Error("Thermal facet repair must change the measurement hash.");
  }

  return {
    changed: true,
    nextDefinition,
    previousMeasurementHash,
    nextMeasurementHash,
  };
}

function repairFlexibilityThermalIntentEntry(entry: MeasurementPlanEntry) {
  if (entry.concept_key !== "flexibility_willingness") {
    return {
      entry,
      changed: false,
    };
  }

  if (!entry.question_intents || entry.question_intents.length === 0) {
    throw new Error(
      "Flexibility thermal intent repair requires question intents on the measurement plan entry.",
    );
  }

  const candidateIntents = entry.question_intents.filter(
    (intent) =>
      intent.facet === "temporary_thermal_adjustment_acceptance" &&
      intent.polarity === "positive",
  );

  if (candidateIntents.length !== 1) {
    throw new Error(
      "Flexibility thermal intent repair requires exactly one positive temporary_thermal_adjustment_acceptance intent.",
    );
  }

  const [candidateIntent] = candidateIntents;
  if (!candidateIntent) {
    throw new Error("Flexibility thermal intent repair could not resolve the target intent.");
  }

  if (candidateIntent.intent === FLEXIBILITY_THERMAL_INTENT_REPAIRED_TEXT) {
    return {
      entry,
      changed: false,
    };
  }

  if (candidateIntent.intent !== FLEXIBILITY_THERMAL_INTENT_LEGACY_TEXT) {
    throw new Error(
      "Flexibility thermal intent repair found an unexpected intent string for temporary_thermal_adjustment_acceptance.",
    );
  }

  return {
    entry: {
      ...entry,
      question_intents: entry.question_intents.map((intent) =>
        intent === candidateIntent
          ? { ...intent, intent: FLEXIBILITY_THERMAL_INTENT_REPAIRED_TEXT }
          : intent,
      ),
    },
    changed: true,
  };
}

export function repairFlexibilityThermalIntentMeasurementPlan(
  measurementPlan: MeasurementPlan,
): {
  measurementPlan: MeasurementPlan;
  changed: boolean;
} {
  let changed = false;
  let flexibilityConceptSeen = false;

  const concepts = measurementPlan.concepts.map((entry) => {
    if (entry.concept_key === "flexibility_willingness") {
      flexibilityConceptSeen = true;
    }

    const repaired = repairFlexibilityThermalIntentEntry(entry);
    changed ||= repaired.changed;
    return repaired.entry;
  });

  if (!flexibilityConceptSeen) {
    throw new Error(
      "Flexibility thermal intent repair could not find a flexibility_willingness entry.",
    );
  }

  return {
    measurementPlan: {
      ...measurementPlan,
      concepts,
    },
    changed,
  };
}

export function prepareFlexibilityThermalIntentRepair(survey: PersistedSurvey): {
  changed: boolean;
  nextDefinition: SurveyDefinition;
  previousMeasurementHash: string | null;
  nextMeasurementHash: string | null;
} {
  if (survey.status !== "draft") {
    throw new Error("Flexibility thermal intent repair only supports draft surveys.");
  }

  const measurementPlan = survey.definition_json.survey_meta.measurement_plan_json;
  if (!measurementPlan) {
    throw new Error("Survey is missing measurement_plan_json.");
  }

  const previousContentHash = computeContentHash(
    survey.definition_json.questions,
    survey.definition_json.translations[survey.default_language],
  );
  const previousTranslationHash =
    survey.definition_json.survey_meta.multilingual_validation_result == null
      ? null
      : computeMultilingualTranslationHash(
          survey.definition_json,
          survey.definition_json.survey_meta.multilingual_validation_result.validated_languages,
        );
  const previousMappingHash = computeMappingHash(survey.mapping_contract_json);
  const previousMeasurementHash = computeMeasurementHash(measurementPlan);
  const repaired = repairFlexibilityThermalIntentMeasurementPlan(measurementPlan);

  if (!repaired.changed) {
    return {
      changed: false,
      nextDefinition: survey.definition_json,
      previousMeasurementHash,
      nextMeasurementHash: previousMeasurementHash,
    };
  }

  const nextDefinition = structuredClone(survey.definition_json);
  nextDefinition.survey_meta.measurement_plan_json = repaired.measurementPlan;

  const nextContentHash = computeContentHash(
    nextDefinition.questions,
    nextDefinition.translations[survey.default_language],
  );
  const nextTranslationHash =
    nextDefinition.survey_meta.multilingual_validation_result == null
      ? null
      : computeMultilingualTranslationHash(
          nextDefinition,
          nextDefinition.survey_meta.multilingual_validation_result.validated_languages,
        );
  const nextMeasurementHash = computeMeasurementHash(repaired.measurementPlan);

  if (nextContentHash !== previousContentHash) {
    throw new Error(
      "Flexibility thermal intent repair unexpectedly changed the survey content hash.",
    );
  }
  if (nextTranslationHash !== previousTranslationHash) {
    throw new Error(
      "Flexibility thermal intent repair unexpectedly changed the translation hash.",
    );
  }
  if (computeMappingHash(survey.mapping_contract_json) !== previousMappingHash) {
    throw new Error(
      "Flexibility thermal intent repair unexpectedly changed the mapping hash.",
    );
  }
  if (nextMeasurementHash === previousMeasurementHash) {
    throw new Error("Flexibility thermal intent repair must change the measurement hash.");
  }

  return {
    changed: true,
    nextDefinition,
    previousMeasurementHash,
    nextMeasurementHash,
  };
}
