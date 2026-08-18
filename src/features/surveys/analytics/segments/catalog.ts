import type { PersistedSurvey } from "@/features/surveys/generator-types";
import {
  getSurveyAnalyticsFieldValue,
  type SurveyAnalyticsFieldDefinition,
  type SurveyAnalyticsRecord,
  type SurveyAnalyticsSchema,
} from "@/features/surveys/survey-analytics";
import {
  getAssetValueLabel,
  getBandLabels,
  getChoiceValueLabel,
  getConceptLabel,
  getDimensionLabel,
  getEvidenceLabel,
  getFacetLabel,
  getFieldLabel,
  getScoreDirectionNote,
  type SegmentLabelContext,
} from "./labels";
import type {
  SegmentCatalog,
  SegmentCatalogChoiceField,
  SegmentCatalogConditionalModule,
  SegmentCatalogContextField,
  SegmentCatalogDimension,
  SegmentCatalogFacetField,
  SegmentCatalogScoreField,
} from "./types";

const EXCLUDED_FIELD_KEYS = new Set([
  "response.audience_token",
  "context.climate.quality_flag",
  "context.location.best_granularity",
  "geo.postal_area.code",
]);

function labelContext(schema: SurveyAnalyticsSchema): SegmentLabelContext {
  return {
    schemaNamespace: schema.schema_namespace,
    schemaVersion: schema.schema_version ?? 1,
    fields: schema.fields,
  };
}

function isNumericValueField(field: SurveyAnalyticsFieldDefinition) {
  return field.source === "profile" && field.value_type === "number" && field.key.endsWith(".value");
}

function uniqueFiniteNumbers(rows: SurveyAnalyticsRecord[], field: string) {
  return rows
    .map((row) => getSurveyAnalyticsFieldValue(row, field))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function uniqueStrings(rows: SurveyAnalyticsRecord[], field: string) {
  const values = new Set<string>();
  for (const row of rows) {
    const value = getSurveyAnalyticsFieldValue(row, field);
    if (typeof value === "string" && value.trim()) {
      values.add(value);
    }
  }
  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function uniqueArrayStrings(rows: SurveyAnalyticsRecord[], field: string) {
  const values = new Set<string>();
  for (const row of rows) {
    const value = getSurveyAnalyticsFieldValue(row, field);
    if (!Array.isArray(value)) {
      continue;
    }
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) {
        values.add(entry);
      }
    }
  }
  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function toScoreField(
  field: SurveyAnalyticsFieldDefinition,
  context: SegmentLabelContext,
): SegmentCatalogScoreField | null {
  if (!field.concept_key || !isNumericValueField(field) || field.facet) {
    return null;
  }

  return {
    field: field.key,
    conceptKey: field.concept_key,
    label: getConceptLabel(field.concept_key, context),
    directionNote: getScoreDirectionNote(field.concept_key, context),
    scaleMin: 1,
    scaleMax: 5,
    bandLabels: getBandLabels(field.concept_key, context),
  };
}

function toFacetField(
  field: SurveyAnalyticsFieldDefinition,
  context: SegmentLabelContext,
): SegmentCatalogFacetField | null {
  if (!field.concept_key || !field.facet || !isNumericValueField(field) || !field.evidence_level) {
    return null;
  }

  return {
    field: field.key,
    conceptKey: field.concept_key,
    facet: field.facet,
    label: getFacetLabel(field.concept_key, field.facet, context),
    directionNote: getScoreDirectionNote(field.concept_key, context),
    evidenceLevel: field.evidence_level,
    evidenceLabel: getEvidenceLabel(field.evidence_level),
    scaleMin: 1,
    scaleMax: 5,
    bandLabels: getBandLabels(field.concept_key, context),
  };
}

function buildChoiceField(
  field: SurveyAnalyticsFieldDefinition,
  rows: SurveyAnalyticsRecord[],
  context: SegmentLabelContext,
): SegmentCatalogChoiceField | null {
  if (EXCLUDED_FIELD_KEYS.has(field.key)) {
    return null;
  }

  const values = uniqueStrings(rows, field.key);
  if (values.length === 0) {
    return null;
  }

  return {
    field: field.key,
    label: getFieldLabel(field.key, context),
    values: values.map((value) => ({ value, label: getChoiceValueLabel(value) })),
  };
}

function buildPostalAreaChoiceField(
  field: SurveyAnalyticsFieldDefinition,
  rows: SurveyAnalyticsRecord[],
): SegmentCatalogChoiceField | null {
  if (field.key !== "geo.postal_area.area_key") {
    return null;
  }

  const values = uniqueStrings(rows, field.key);
  if (values.length === 0) {
    return null;
  }

  return {
    field: field.key,
    label: "Postal area",
    values: values.map((value) => ({
      value,
      label: value,
    })),
  };
}

function hasUsableNumericCoverage(rows: SurveyAnalyticsRecord[], field: string) {
  return uniqueFiniteNumbers(rows, field).length > 0;
}

export function buildSegmentCatalog({
  schema,
  rows,
}: {
  survey: PersistedSurvey;
  schema: SurveyAnalyticsSchema;
  rows: SurveyAnalyticsRecord[];
}): SegmentCatalog {
  const context = labelContext(schema);
  const profileFields = schema.fields.filter((field) => field.source === "profile");
  const dimensions = new Map<string, SegmentCatalogDimension>();

  function ensureDimension(dimension: string): SegmentCatalogDimension {
    const current = dimensions.get(dimension);
    if (current) {
      return current;
    }

    const created: SegmentCatalogDimension = {
      dimension,
      label: getDimensionLabel(dimension, context),
      overall: null,
      facets: [],
      supportingFactors: [],
      conditionalModules: [],
    };
    dimensions.set(dimension, created);
    return created;
  }

  const overallFields = profileFields.filter(
    (field) =>
      isNumericValueField(field) &&
      !field.facet &&
      (field.concept_role === "primary_profile_axis" || field.concept_role === "behavioural_modulator"),
  );

  for (const field of overallFields) {
    if (!field.dimension || !field.concept_key) {
      continue;
    }

    const group = ensureDimension(field.dimension);
    const score = toScoreField(field, context);
    if (!score) {
      continue;
    }

    if (field.concept_role === "primary_profile_axis") {
      group.overall = score;
      if (field.measurement_role !== "conditional_module") {
        group.facets = profileFields
          .filter((candidate) => candidate.concept_key === field.concept_key && candidate.facet)
          .map((candidate) => toFacetField(candidate, context))
          .filter((facet): facet is SegmentCatalogFacetField => facet != null);
      }
      continue;
    }

    group.supportingFactors.push({
      conceptKey: field.concept_key,
      label: score.label,
      overall: score,
    });
  }

  const conditionalConcepts = new Set(
    profileFields
      .filter((field) => field.measurement_role === "conditional_module" && field.concept_key)
      .map((field) => field.concept_key as string),
  );

  for (const conceptKey of conditionalConcepts) {
    const conceptFields = profileFields.filter((field) => field.concept_key === conceptKey);
    const overallField = conceptFields.find((field) => !field.facet && field.key.endsWith(".value"));
    const dimension = overallField?.dimension ?? conceptFields[0]?.dimension;
    if (!dimension) {
      continue;
    }

    const group = ensureDimension(dimension);
    if (overallField) {
      group.overall = toScoreField(overallField, context);
    }

    const modules: SegmentCatalogConditionalModule[] = conceptFields
      .filter((field) => field.facet && field.value_type === "number" && field.key.endsWith(".value"))
      .map((field) => ({
        field: field.key,
        setKey: field.facet as string,
        label: getFacetLabel(conceptKey, field.facet as string, context),
        conceptKey,
        scaleMin: 1,
        scaleMax: 5,
        bandLabels: getBandLabels(conceptKey, context),
      }));
    group.conditionalModules = modules;
    group.facets = [];
  }

  const assetField = profileFields.find(
    (field) => field.concept_role === "applicability_factor" && field.value_type === "string[]",
  );
  const assetValues = assetField ? uniqueArrayStrings(rows, assetField.key) : [];

  const geography = [
    schema.fields.find((field) => field.key === "context.country_code"),
    ...schema.supported_geo_levels.map((level) =>
      level === "postal_area"
        ? schema.fields.find((field) => field.key === "geo.postal_area.area_key")
        : schema.fields.find((field) => field.key === `geo.${level}.code`),
    ),
    schema.fields.find((field) => field.key === "context.location.best_code"),
  ]
    .filter((field): field is SurveyAnalyticsFieldDefinition => field != null)
    .map((field) => buildPostalAreaChoiceField(field, rows) ?? buildChoiceField(field, rows, context))
    .filter((field): field is SegmentCatalogChoiceField => field != null);

  const contextFields: SegmentCatalogContextField[] = [];
  const language = schema.fields.find((field) => field.key === "context.survey_language");
  const audience = schema.fields.find((field) => field.key === "response.audience_label");
  const respondedAt = schema.fields.find((field) => field.key === "response.responded_at");
  const temperature = schema.fields.find((field) => field.key === "context.climate.temp_outdoor_c");
  const humidity = schema.fields.find((field) => field.key === "context.climate.humidity_pct");

  for (const field of [language, audience]) {
    if (!field) {
      continue;
    }
    const choice = buildChoiceField(field, rows, context);
    if (choice) {
      contextFields.push({ ...choice, kind: "choice" });
    }
  }

  if (respondedAt && uniqueStrings(rows, respondedAt.key).length > 0) {
    contextFields.push({
      kind: "date_range",
      field: respondedAt.key,
      label: getFieldLabel(respondedAt.key, context),
    });
  }

  if (temperature && hasUsableNumericCoverage(rows, temperature.key)) {
    contextFields.push({
      kind: "numeric_range",
      field: temperature.key,
      label: getFieldLabel(temperature.key, context),
      scaleMin: -30,
      scaleMax: 50,
    });
  }

  if (humidity && hasUsableNumericCoverage(rows, humidity.key)) {
    contextFields.push({
      kind: "numeric_range",
      field: humidity.key,
      label: getFieldLabel(humidity.key, context),
      scaleMin: 0,
      scaleMax: 100,
    });
  }

  return {
    surveyId: schema.survey_id,
    schemaNamespace: context.schemaNamespace,
    schemaVersion: context.schemaVersion,
    measurementHash: schema.measurement_hash,
    analysedN: rows.length,
    dimensions: Array.from(dimensions.values()).sort((left, right) => left.label.localeCompare(right.label)),
    assets:
      assetField && assetValues.length > 0
        ? {
            field: assetField.key,
            label: getConceptLabel(assetField.concept_key ?? assetField.key, context),
            values: assetValues.map((value) => ({ value, label: getAssetValueLabel(value) })),
          }
        : null,
    geography,
    context: contextFields,
  };
}
