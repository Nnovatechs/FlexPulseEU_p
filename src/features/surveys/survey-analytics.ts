import { getFlexpulseBehaviouralConcept } from "@/features/ontology/flexpulse-behavioural-schema";
import type {
  MapperOutput,
  MeasurementPlanEntry,
  PersistedSurvey,
} from "./generator-types";
import type { NormalizedLocationLevel } from "./response-enrichment";

const SUPPORTED_GEO_LEVELS = [
  "country",
  "region",
  "city",
  "district",
  "neighbourhood",
  "place",
  "postal_area",
] as const;

type SupportedGeoLevel = (typeof SUPPORTED_GEO_LEVELS)[number];

type AnalyticsFieldScalar = string | number | boolean | null;
type AnalyticsFieldValue =
  | AnalyticsFieldScalar
  | string[]
  | number[]
  | undefined;

export type SurveyAnalyticsFieldType =
  | "number"
  | "boolean"
  | "string"
  | "enum"
  | "tag"
  | "string[]"
  | "number[]"
  | "date";

export type SurveyAnalyticsFilterOperator =
  | "eq"
  | "in"
  | "gte"
  | "lte"
  | "between"
  | "contains";

export type SurveyAnalyticsMetricKind =
  | "count"
  | "average"
  | "share_equals"
  | "share_contains";

export type SurveyAnalyticsFieldDefinition = {
  key: string;
  label: string;
  description: string;
  source: "profile" | "context" | "geo" | "response";
  value_type: SurveyAnalyticsFieldType;
  groupable: boolean;
  filter_operators: SurveyAnalyticsFilterOperator[];
  metric_kinds: SurveyAnalyticsMetricKind[];
  concept_key?: string;
  concept_role?: string;
  dimension?: string;
  facet?: string;
  evidence_level?: "interpretive_signal" | "facet_subscore";
};

export type SurveyAnalyticsSchema = {
  survey_id: string;
  schema_namespace: string;
  measurement_hash: string | null;
  ready_response_count: number;
  fields: SurveyAnalyticsFieldDefinition[];
  supported_geo_levels: SupportedGeoLevel[];
};

export type SurveyAnalyticsFilter = {
  field: string;
  op: SurveyAnalyticsFilterOperator;
  value: unknown;
};

export type SurveyAnalyticsMetric =
  | {
      key: string;
      kind: "count";
    }
  | {
      key: string;
      kind: "average";
      field: string;
    }
  | {
      key: string;
      kind: "share_equals";
      field: string;
      value: string | number | boolean;
    }
  | {
      key: string;
      kind: "share_contains";
      field: string;
      value: string | number;
    };

export type SurveyAnalyticsQueryInput = {
  filters?: SurveyAnalyticsFilter[];
  group_by?: string[];
  metrics: SurveyAnalyticsMetric[];
};

export type SurveyAnalyticsMetricResult = {
  kind: SurveyAnalyticsMetricKind;
  value: number | null;
  sample_size: number;
  matched_count?: number;
};

export type SurveyAnalyticsQueryRow = {
  group: Record<string, AnalyticsFieldScalar>;
  metrics: Record<string, SurveyAnalyticsMetricResult>;
  response_count: number;
};

export type SurveyAnalyticsQueryResult = {
  matched_response_count: number;
  groups: SurveyAnalyticsQueryRow[];
};

export type SurveyAnalyticsRecord = {
  response_id: string;
  responded_at: string;
  audience_token: string | null;
  audience_label: string | null;
  mapper_output: MapperOutput;
  location_levels: NormalizedLocationLevel[];
};

function supportsTagField(entry: MeasurementPlanEntry) {
  return (
    entry.output_type === "number" &&
    (entry.threshold_profile === "likert_1_5_low_mid_high" ||
      entry.threshold_profile === "likert_1_5_low_mid_high_strict")
  );
}

function getFieldOperators(valueType: SurveyAnalyticsFieldType): SurveyAnalyticsFilterOperator[] {
  switch (valueType) {
    case "number":
    case "date":
      return ["eq", "in", "gte", "lte", "between"];
    case "string[]":
    case "number[]":
      return ["contains"];
    default:
      return ["eq", "in"];
  }
}

function getFieldMetricKinds(valueType: SurveyAnalyticsFieldType): SurveyAnalyticsMetricKind[] {
  switch (valueType) {
    case "number":
      return ["average", "share_equals"];
    case "string[]":
    case "number[]":
      return ["share_contains"];
    case "boolean":
    case "string":
    case "enum":
    case "tag":
      return ["share_equals"];
    default:
      return [];
  }
}

function buildFieldDefinition(input: {
  key: string;
  label: string;
  description: string;
  source: SurveyAnalyticsFieldDefinition["source"];
  valueType: SurveyAnalyticsFieldType;
  groupable?: boolean;
  concept_key?: string;
  concept_role?: string;
  dimension?: string;
  facet?: string;
  evidence_level?: "interpretive_signal" | "facet_subscore";
}): SurveyAnalyticsFieldDefinition {
  return {
    key: input.key,
    label: input.label,
    description: input.description,
    source: input.source,
    value_type: input.valueType,
    groupable:
      input.groupable ??
      (input.valueType !== "string[]" &&
        input.valueType !== "number[]" &&
        input.valueType !== "date"),
    filter_operators: getFieldOperators(input.valueType),
    metric_kinds: getFieldMetricKinds(input.valueType),
    concept_key: input.concept_key,
    concept_role: input.concept_role,
    dimension: input.dimension,
    facet: input.facet,
    evidence_level: input.evidence_level,
  };
}

function getFacetEvidenceLevel(
  entry: MeasurementPlanEntry,
  facet: string,
): "interpretive_signal" | "facet_subscore" {
  const evidenceCount =
    entry.question_intents?.filter((intent) => intent.facet === facet).length ?? 0;

  return evidenceCount >= 2 ? "facet_subscore" : "interpretive_signal";
}

function buildProfileFieldDefinitions(survey: PersistedSurvey) {
  const measurementPlan = survey.definition_json.survey_meta.measurement_plan_json;

  if (!measurementPlan) {
    return [] as SurveyAnalyticsFieldDefinition[];
  }

  return measurementPlan.concepts.flatMap((entry) => {
    const concept = getFlexpulseBehaviouralConcept(entry.concept_key);

    if (
      !concept ||
      concept.concept_role === "context_signal" ||
      concept.concept_role === "quality_signal"
    ) {
      return [];
    }

    const valueField = buildFieldDefinition({
      key: `profile.${entry.concept_key}.value`,
      label: concept.label,
      description: concept.description,
      source: "profile",
      valueType: entry.output_type as SurveyAnalyticsFieldType,
      concept_key: entry.concept_key,
      concept_role: concept.concept_role,
      dimension: concept.dimension,
    });

    const facetFields = Array.from(
      new Set((entry.question_intents ?? []).map((intent) => intent.facet)),
    ).flatMap((facet) => {
      const evidenceLevel = getFacetEvidenceLevel(entry, facet);
      const descriptionPrefix =
        evidenceLevel === "facet_subscore"
          ? "Facet subscore"
          : "Interpretive facet signal";

      return [
        buildFieldDefinition({
          key: `profile.${entry.concept_key}.facets.${facet}.value`,
          label: `${concept.label}: ${facet}`,
          description: `${descriptionPrefix} for ${concept.label}. Concept scores remain canonical.`,
          source: "profile",
          valueType: entry.output_type as SurveyAnalyticsFieldType,
          groupable: false,
          concept_key: entry.concept_key,
          concept_role: concept.concept_role,
          dimension: concept.dimension,
          facet,
          evidence_level: evidenceLevel,
        }),
        buildFieldDefinition({
          key: `profile.${entry.concept_key}.facets.${facet}.evidence_level`,
          label: `${concept.label}: ${facet} evidence level`,
          description:
            "Whether this facet is a single interpretive signal or has enough planned evidence for a subscore.",
          source: "profile",
          valueType: "string",
          concept_key: entry.concept_key,
          concept_role: concept.concept_role,
          dimension: concept.dimension,
          facet,
          evidence_level: evidenceLevel,
        }),
      ];
    });

    if (!supportsTagField(entry)) {
      return [valueField, ...facetFields];
    }

    return [
      valueField,
      buildFieldDefinition({
        key: `profile.${entry.concept_key}.tag`,
        label: `${concept.label} tag`,
        description: `Derived qualitative band for ${concept.label}.`,
        source: "profile",
        valueType: "tag",
        concept_key: entry.concept_key,
        concept_role: concept.concept_role,
        dimension: concept.dimension,
      }),
      ...facetFields,
    ];
  });
}

function buildStaticFieldDefinitions(survey: PersistedSurvey) {
  const responseContext = survey.definition_json.survey_meta.response_context;
  const supportsLocation =
    responseContext?.collect_country_code === true ||
    responseContext?.collect_postal_code === true;
  const supportsWeather = responseContext?.enrich_weather_context === true;

  const fields: SurveyAnalyticsFieldDefinition[] = [
    buildFieldDefinition({
      key: "response.responded_at",
      label: "Response timestamp",
      description: "Submission timestamp for the survey response.",
      source: "response",
      valueType: "date",
    }),
    buildFieldDefinition({
      key: "response.audience_token",
      label: "Audience token",
      description: "Audience token of the published survey link used to submit the response.",
      source: "response",
      valueType: "string",
    }),
    buildFieldDefinition({
      key: "response.audience_label",
      label: "Audience label",
      description: "Audience label of the published survey link used to submit the response.",
      source: "response",
      valueType: "string",
    }),
    buildFieldDefinition({
      key: "context.survey_language",
      label: "Survey language",
      description: "Language used by the respondent during survey completion.",
      source: "context",
      valueType: "string",
    }),
  ];

  if (supportsLocation) {
    fields.push(
      buildFieldDefinition({
        key: "context.country_code",
        label: "Country code",
        description: "Normalized country code for the response.",
        source: "context",
        valueType: "string",
      }),
      buildFieldDefinition({
        key: "context.location.best_code",
        label: "Best location code",
        description: "Best available normalized location code attached to the response.",
        source: "context",
        valueType: "string",
      }),
      buildFieldDefinition({
        key: "context.location.best_label",
        label: "Best location label",
        description: "Best available normalized location label attached to the response.",
        source: "context",
        valueType: "string",
      }),
      buildFieldDefinition({
        key: "context.location.best_granularity",
        label: "Best location granularity",
        description: "Granularity of the best available location attached to the response.",
        source: "context",
        valueType: "enum",
      }),
    );

    for (const level of SUPPORTED_GEO_LEVELS) {
      fields.push(
        buildFieldDefinition({
          key: `geo.${level}.code`,
          label: `${level} code`,
          description: `Normalized ${level} code when this level is available in enrichment.`,
          source: "geo",
          valueType: "string",
        }),
        buildFieldDefinition({
          key: `geo.${level}.label`,
          label: `${level} label`,
          description: `Human-readable ${level} label when this level is available in enrichment.`,
          source: "geo",
          valueType: "string",
        }),
      );
    }
  }

  if (supportsWeather) {
    fields.push(
      buildFieldDefinition({
        key: "context.climate.temp_outdoor_c",
        label: "Outdoor temperature (C)",
        description: "Outdoor temperature observed near the time of response.",
        source: "context",
        valueType: "number",
      }),
      buildFieldDefinition({
        key: "context.climate.humidity_pct",
        label: "Humidity (%)",
        description: "Relative humidity observed near the time of response.",
        source: "context",
        valueType: "number",
      }),
      buildFieldDefinition({
        key: "context.climate.quality_flag",
        label: "Climate quality flag",
        description: "Quality flag emitted by the enrichment pipeline for weather context.",
        source: "context",
        valueType: "string",
      }),
    );
  }

  return fields;
}

export function buildSurveyAnalyticsSchema(input: {
  survey: PersistedSurvey;
  readyResponseCount: number;
}): SurveyAnalyticsSchema {
  const profileFields = buildProfileFieldDefinitions(input.survey);
  const staticFields = buildStaticFieldDefinitions(input.survey);

  return {
    survey_id: input.survey.id,
    schema_namespace:
      input.survey.definition_json.survey_meta.measurement_plan_json?.schema_namespace ??
      "flexpulse_behavioural_schema",
    measurement_hash: input.survey.measurement_hash ?? null,
    ready_response_count: input.readyResponseCount,
    fields: [...profileFields, ...staticFields],
    supported_geo_levels: [...SUPPORTED_GEO_LEVELS],
  };
}

function getGeoLevel(
  levels: NormalizedLocationLevel[],
  kind: SupportedGeoLevel,
): NormalizedLocationLevel | null {
  return levels.find((level) => level.kind === kind) ?? null;
}

function parseProfileFieldKey(field: string) {
  const conceptMatch = /^profile\.([a-z0-9_]+)\.(value|tag)$/i.exec(field);
  if (conceptMatch) {
    return {
      conceptKey: conceptMatch[1],
      property: conceptMatch[2] as "value" | "tag",
      facet: null,
    };
  }

  const facetMatch = /^profile\.([a-z0-9_]+)\.facets\.([a-z0-9_]+)\.(value|evidence_level)$/i.exec(
    field,
  );
  if (!facetMatch) {
    return null;
  }

  return {
    conceptKey: facetMatch[1],
    facet: facetMatch[2],
    property: facetMatch[3] as "value" | "evidence_level",
  };
}

function getFieldValue(
  record: SurveyAnalyticsRecord,
  field: string,
): AnalyticsFieldValue {
  const profileField = parseProfileFieldKey(field);
  if (profileField) {
    const entry = record.mapper_output.profile[profileField.conceptKey];
    if (profileField.facet) {
      return entry?.facets?.[profileField.facet]?.[profileField.property];
    }
    return entry?.[profileField.property as "value" | "tag"];
  }

  switch (field) {
    case "response.responded_at":
      return record.responded_at;
    case "response.audience_token":
      return record.audience_token;
    case "response.audience_label":
      return record.audience_label;
    case "context.country_code":
      return record.mapper_output.context_metadata.country_code;
    case "context.survey_language":
      return record.mapper_output.context_metadata.survey_language;
    case "context.location.best_code":
      return record.mapper_output.context_metadata.location?.agg_code ?? null;
    case "context.location.best_label":
      return record.mapper_output.context_metadata.location?.label ?? null;
    case "context.location.best_granularity":
      return record.mapper_output.context_metadata.location?.granularity ?? null;
    case "context.climate.temp_outdoor_c":
      return record.mapper_output.context_metadata.climate?.temp_outdoor_c ?? null;
    case "context.climate.humidity_pct":
      return record.mapper_output.context_metadata.climate?.humidity_pct ?? null;
    case "context.climate.quality_flag":
      return record.mapper_output.context_metadata.climate?.quality_flag ?? null;
    default: {
      const geoMatch = /^geo\.(country|region|city|district|neighbourhood|place|postal_area)\.(code|label)$/.exec(
        field,
      );
      if (!geoMatch) {
        return undefined;
      }

      const geoLevel = getGeoLevel(record.location_levels, geoMatch[1] as SupportedGeoLevel);
      if (!geoLevel) {
        return null;
      }

      return geoMatch[2] === "code" ? geoLevel.code : geoLevel.label;
    }
  }
}

function valueEquals(left: AnalyticsFieldScalar, right: unknown) {
  return left === right;
}

function coerceComparableValue(
  value: unknown,
  fieldType: SurveyAnalyticsFieldType,
): number | string | null {
  if (value == null) {
    return null;
  }

  if (fieldType === "date") {
    if (typeof value !== "string") {
      return null;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (fieldType === "number") {
    return typeof value === "number" ? value : null;
  }

  return typeof value === "string" ? value : null;
}

function matchesFilter(
  record: SurveyAnalyticsRecord,
  filter: SurveyAnalyticsFilter,
  fieldsByKey: Map<string, SurveyAnalyticsFieldDefinition>,
) {
  const field = fieldsByKey.get(filter.field);
  if (!field) {
    throw new Error(`Unknown analytics field "${filter.field}".`);
  }

  const value = getFieldValue(record, filter.field);

  switch (filter.op) {
    case "eq":
      return !Array.isArray(value) && valueEquals(value ?? null, filter.value);
    case "in":
      return (
        !Array.isArray(value) &&
        Array.isArray(filter.value) &&
        filter.value.some((candidate) => valueEquals(value ?? null, candidate))
      );
    case "contains":
      return Array.isArray(value) && value.includes(filter.value as never);
    case "gte": {
      const left = coerceComparableValue(value, field.value_type);
      const right = coerceComparableValue(filter.value, field.value_type);
      return left != null && right != null && left >= right;
    }
    case "lte": {
      const left = coerceComparableValue(value, field.value_type);
      const right = coerceComparableValue(filter.value, field.value_type);
      return left != null && right != null && left <= right;
    }
    case "between": {
      if (!Array.isArray(filter.value) || filter.value.length !== 2) {
        return false;
      }
      const left = coerceComparableValue(value, field.value_type);
      const min = coerceComparableValue(filter.value[0], field.value_type);
      const max = coerceComparableValue(filter.value[1], field.value_type);
      return left != null && min != null && max != null && left >= min && left <= max;
    }
    default:
      return false;
  }
}

function validateQuery(
  schema: SurveyAnalyticsSchema,
  query: SurveyAnalyticsQueryInput,
) {
  if (!Array.isArray(query.metrics) || query.metrics.length === 0) {
    throw new Error("Analytics query requires at least one metric.");
  }

  const fieldsByKey = new Map(schema.fields.map((field) => [field.key, field]));

  for (const groupField of query.group_by ?? []) {
    const field = fieldsByKey.get(groupField);
    if (!field) {
      throw new Error(`Unknown group_by field "${groupField}".`);
    }
    if (!field.groupable) {
      throw new Error(`Field "${groupField}" cannot be used in group_by.`);
    }
  }

  for (const filter of query.filters ?? []) {
    const field = fieldsByKey.get(filter.field);
    if (!field) {
      throw new Error(`Unknown filter field "${filter.field}".`);
    }
    if (!field.filter_operators.includes(filter.op)) {
      throw new Error(`Operator "${filter.op}" is not allowed for field "${filter.field}".`);
    }
  }

  const seenMetricKeys = new Set<string>();
  for (const metric of query.metrics) {
    if (!metric.key.trim()) {
      throw new Error("Analytics metric key cannot be empty.");
    }
    if (seenMetricKeys.has(metric.key)) {
      throw new Error(`Duplicate analytics metric key "${metric.key}".`);
    }
    seenMetricKeys.add(metric.key);

    if (metric.kind === "count") {
      continue;
    }

    const field = fieldsByKey.get(metric.field);
    if (!field) {
      throw new Error(`Unknown metric field "${metric.field}".`);
    }
    if (!field.metric_kinds.includes(metric.kind)) {
      throw new Error(`Metric "${metric.kind}" is not allowed for field "${metric.field}".`);
    }
  }

  return fieldsByKey;
}

function serializeGroupValue(value: AnalyticsFieldScalar) {
  if (value == null) {
    return "__null__";
  }
  return String(value);
}

function computeMetric(
  rows: SurveyAnalyticsRecord[],
  metric: SurveyAnalyticsMetric,
): SurveyAnalyticsMetricResult {
  if (metric.kind === "count") {
    return {
      kind: "count",
      value: rows.length,
      sample_size: rows.length,
    };
  }

  if (metric.kind === "average") {
    const values = rows
      .map((row) => getFieldValue(row, metric.field))
      .filter((value): value is number => typeof value === "number");

    if (values.length === 0) {
      return {
        kind: "average",
        value: null,
        sample_size: 0,
      };
    }

    const sum = values.reduce((accumulator, value) => accumulator + value, 0);
    return {
      kind: "average",
      value: sum / values.length,
      sample_size: values.length,
    };
  }

  if (metric.kind === "share_equals") {
    const values = rows
      .map((row) => getFieldValue(row, metric.field))
      .filter((value): value is AnalyticsFieldScalar => !Array.isArray(value) && value != null);
    const matched = values.filter((value) => value === metric.value).length;

    return {
      kind: "share_equals",
      value: values.length === 0 ? null : matched / values.length,
      sample_size: values.length,
      matched_count: matched,
    };
  }

  const values = rows
    .map((row) => getFieldValue(row, metric.field))
    .filter((value): value is string[] | number[] => Array.isArray(value));
  const matched = values.filter((value) => value.includes(metric.value as never)).length;

  return {
    kind: "share_contains",
    value: values.length === 0 ? null : matched / values.length,
    sample_size: values.length,
    matched_count: matched,
  };
}

export function runSurveyAnalyticsQuery(input: {
  schema: SurveyAnalyticsSchema;
  rows: SurveyAnalyticsRecord[];
  query: SurveyAnalyticsQueryInput;
}): SurveyAnalyticsQueryResult {
  const fieldsByKey = validateQuery(input.schema, input.query);
  const filteredRows = input.rows.filter((row) =>
    (input.query.filters ?? []).every((filter) => matchesFilter(row, filter, fieldsByKey)),
  );

  const groupedRows = new Map<string, SurveyAnalyticsRecord[]>();
  const groupedValues = new Map<string, Record<string, AnalyticsFieldScalar>>();
  const groupBy = input.query.group_by ?? [];

  for (const row of filteredRows) {
    const group =
      groupBy.length === 0
        ? {}
        : Object.fromEntries(
            groupBy.map((field) => {
              const value = getFieldValue(row, field);
              return [field, Array.isArray(value) ? null : (value ?? null)];
            }),
          );

    const key =
      groupBy.length === 0
        ? "__all__"
        : groupBy.map((field) => serializeGroupValue(group[field] ?? null)).join("|");

    groupedValues.set(key, group);
    groupedRows.set(key, [...(groupedRows.get(key) ?? []), row]);
  }

  const groups = Array.from(groupedRows.entries())
    .map(([key, rows]) => ({
      sortKey: key,
      group: groupedValues.get(key) ?? {},
      metrics: Object.fromEntries(
        input.query.metrics.map((metric) => [metric.key, computeMetric(rows, metric)]),
      ),
      response_count: rows.length,
    }))
    .sort(
      (left, right) =>
        right.response_count - left.response_count ||
        left.sortKey.localeCompare(right.sortKey),
    )
    .map((entry) => ({
      group: entry.group,
      metrics: entry.metrics,
      response_count: entry.response_count,
    }));

  return {
    matched_response_count: filteredRows.length,
    groups,
  };
}
