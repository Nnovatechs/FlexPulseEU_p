import { FLEXPULSE_DER_ASSET_VALUES } from "@/features/ontology/flexpulse-behavioural-schema";
import type {
  SurveyAnalyticsFieldDefinition,
  SurveyAnalyticsFilter,
  SurveyAnalyticsMetric,
  SurveyAnalyticsMetricResult,
  SurveyAnalyticsQueryRow,
} from "@/features/surveys/survey-analytics";

export type ProfileCondition = {
  fieldKey: string;
  tag: string;
};

export const TAG_VALUES = ["low", "medium", "high"] as const;
export const MAX_PROFILE_CONCEPTS = 7;
export const MAX_BREAKDOWN_ROWS = 6;
export const MAX_INTELLIGENCE_AXES = 4;
export const MAX_RADAR_AXES = 7;
export const MIN_PRIVATE_METRIC_SAMPLE = 5;

export function formatMetricValue(metric: SurveyAnalyticsMetricResult) {
  if (metric.value == null) {
    return "No data";
  }

  if (metric.kind === "share_contains" || metric.kind === "share_equals") {
    return `${(metric.value * 100).toFixed(1)}%`;
  }

  if (Number.isInteger(metric.value)) {
    return String(metric.value);
  }

  return metric.value.toFixed(2);
}

export function formatPlainValue(
  value: number | null | undefined,
  kind: "number" | "share" = "number",
) {
  if (value == null) {
    return "No data";
  }

  if (kind === "share") {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
}

export function formatCompactCount(value: number | null | undefined) {
  if (value == null) {
    return "0";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(0);
}

export function getGroupLabel(row: SurveyAnalyticsQueryRow, fieldKey: string) {
  const value = row.group[fieldKey];
  if (value == null || value === "") {
    return "Unknown";
  }

  const raw = String(value);
  if (raw === "neutral" || raw === "neutral_mainstream") {
    return "Neutral Position";
  }

  const label = raw.replace(/[_-]+/g, " ").trim();
  if (/^[a-z]{2}$/i.test(label)) {
    return label.toUpperCase();
  }

  return label.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function groupFieldsBySource(fields: SurveyAnalyticsFieldDefinition[]) {
  return {
    profile: fields.filter((field) => field.source === "profile"),
    context: fields.filter((field) => field.source === "context"),
    geo: fields.filter((field) => field.source === "geo"),
    response: fields.filter((field) => field.source === "response"),
  };
}

export function getConceptShortLabel(field: SurveyAnalyticsFieldDefinition) {
  return field.label
    .replace(/\s+value$/i, "")
    .replace(/\s+tag$/i, "")
    .replace(/: .+$/, "");
}

export function getConceptTitle(field: SurveyAnalyticsFieldDefinition) {
  return getConceptShortLabel(field)
    .replace(/\bDER\b/g, "DER")
    .replace(/\bDr\b/g, "DR");
}

export function getRadarAxisLabel(field: SurveyAnalyticsFieldDefinition) {
  const title = getConceptTitle(field);
  if (title.length <= 12) {
    return title;
  }

  return title
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .replace(/\bWillingness\b/i, "Will.")
    .replace(/\bPreference\b/i, "Pref.");
}

export function getPrimaryProfileFields(fields: SurveyAnalyticsFieldDefinition[]) {
  const primary = fields.filter((field) => field.concept_role === "primary_profile_axis");
  return primary.length > 0 ? primary : fields;
}

/**
 * Returns dynamically declared DFC set subscores for aggregate presentation.
 */
export function getCapabilityFacetFields(fields: SurveyAnalyticsFieldDefinition[]) {
  return fields.filter(
    (field) =>
      field.concept_key === "declared_flexibility_capability" &&
      field.value_type === "number" &&
      field.evidence_level === "facet_subscore" &&
      Boolean(field.facet),
  );
}

/**
 * Builds average metrics whose sample sizes represent applicable DFC sets.
 */
export function buildCapabilityFacetMetrics(
  fields: SurveyAnalyticsFieldDefinition[],
): SurveyAnalyticsMetric[] {
  return getCapabilityFacetFields(fields).map((field) => ({
    key: metricKeyFor("avg", field),
    kind: "average",
    field: field.key,
  }));
}

export function shouldSuppressCapabilityFacet(
  metric: SurveyAnalyticsMetricResult | null | undefined,
) {
  return !metric || metric.sample_size < MIN_PRIVATE_METRIC_SAMPLE;
}

export function findConceptField(
  fields: SurveyAnalyticsFieldDefinition[],
  candidates: string[],
) {
  return (
    fields.find((field) =>
      candidates.some((candidate) =>
        `${field.key} ${field.label} ${field.concept_key ?? ""}`
          .toLowerCase()
          .includes(candidate),
      ),
    ) ?? null
  );
}

export function metricKeyFor(prefix: string, field: SurveyAnalyticsFieldDefinition) {
  return `${prefix}_${field.key.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "")}`;
}

export function getMetric(
  row: SurveyAnalyticsQueryRow | null | undefined,
  key: string,
): SurveyAnalyticsMetricResult | null {
  return row?.metrics[key] ?? null;
}

export function getSingleGroup(result: { result: { groups: SurveyAnalyticsQueryRow[] } } | null) {
  return result?.result.groups[0] ?? null;
}

export function getMetricValue(row: SurveyAnalyticsQueryRow | null | undefined, key: string) {
  return row?.metrics[key]?.value ?? null;
}

export function getSegmentEntries(
  rows: SurveyAnalyticsQueryRow[],
  segmentField: SurveyAnalyticsFieldDefinition | null,
  conceptField: SurveyAnalyticsFieldDefinition | null,
) {
  if (!segmentField || !conceptField) {
    return [];
  }

  const key = metricKeyFor("avg", conceptField);
  return rows
    .filter((row) => !row.evidence.suppress_detail)
    .map((row) => ({
      label: getGroupLabel(row, segmentField.key),
      value: getMetricValue(row, key),
      sampleSize: row.metrics[key]?.sample_size ?? row.response_count,
    }))
    .filter(
      (entry): entry is { label: string; value: number; sampleSize: number } =>
        entry.value != null,
    )
    .sort((left, right) => right.value - left.value);
}

export function getScoreRange(
  rows: SurveyAnalyticsQueryRow[],
  segmentField: SurveyAnalyticsFieldDefinition | null,
  field: SurveyAnalyticsFieldDefinition,
) {
  const entries = getSegmentEntries(rows, segmentField, field);
  if (entries.length === 0) {
    return { low: null, high: null };
  }

  return {
    low: entries[entries.length - 1].value,
    high: entries[0].value,
  };
}

export function getSegmentFieldLabel(field: SurveyAnalyticsFieldDefinition | null) {
  if (!field) {
    return "segment";
  }

  return field.label.toLowerCase();
}

export function getScoreBarWidth(value: number | null | undefined) {
  if (value == null) {
    return "0%";
  }

  return `${Math.max(0, Math.min(100, (value / 5) * 100))}%`;
}

export function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function buildRadarPolygon(
  values: number[],
  cx: number,
  cy: number,
  radius: number,
) {
  const axisCount = values.length;
  return values
    .map((value, index) => {
      const ratio = Math.max(0, Math.min(1, value / 5));
      const angle = -Math.PI / 2 + (index / axisCount) * Math.PI * 2;
      const point = polarPoint(cx, cy, radius * ratio, angle);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

export function buildRadarGridPolygon(axisCount: number, cx: number, cy: number, radius: number) {
  return Array.from({ length: axisCount }, (_, index) => {
    const angle = -Math.PI / 2 + (index / axisCount) * Math.PI * 2;
    const point = polarPoint(cx, cy, radius, angle);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");
}

export function formatDateShort(value: string | null) {
  if (!value) {
    return "Not published";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getSearchParamList(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  if (!value) {
    return [] as string[];
  }

  return Array.isArray(value) ? value : [value];
}

export function getActiveProfileConditions(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const fields = getSearchParamList(searchParams, "profileField");
  const tags = getSearchParamList(searchParams, "profileTag");
  const maxLength = Math.max(fields.length, tags.length);
  const conditions: ProfileCondition[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    conditions.push({
      fieldKey: fields[index] ?? "",
      tag: tags[index] ?? "",
    });
  }

  return conditions.filter((condition) => condition.fieldKey && condition.tag);
}

export function getVisibleProfileConditions(
  searchParams: Record<string, string | string[] | undefined>,
  tagFields: SurveyAnalyticsFieldDefinition[],
) {
  const active = getActiveProfileConditions(searchParams);
  if (active.length > 0) {
    return active;
  }

  return tagFields[0] ? [{ fieldKey: tagFields[0].key, tag: "high" }] : [];
}

export function buildHrefWithProfileConditions(
  searchParams: Record<string, string | string[] | undefined>,
  conditions: ProfileCondition[],
) {
  const next = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "profileField" || key === "profileTag") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry) {
          next.append(key, entry);
        }
      });
      return;
    }

    if (value) {
      next.set(key, value);
    }
  });

  conditions.forEach((condition) => {
    if (!condition.fieldKey || !condition.tag) {
      return;
    }

    next.append("profileField", condition.fieldKey);
    next.append("profileTag", condition.tag);
  });

  const query = next.toString();
  return query ? `?${query}` : "?";
}

export function getSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export function getHumanTag(value: string | null | undefined) {
  switch (value) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return null;
  }
}

export function describeAverage(value: number | null | undefined) {
  if (value == null) {
    return "insufficient data";
  }

  if (value >= 3.75) {
    return "high";
  }

  if (value <= 2.25) {
    return "low";
  }

  return "medium";
}

export function getEvidenceLabel(label: SurveyAnalyticsQueryRow["evidence"]["label"]) {
  switch (label) {
    case "hidden":
      return "Hidden";
    case "very_low":
      return "Very low evidence";
    case "low":
      return "Low evidence";
    case "directional":
      return "Directional";
    case "usable":
      return "Usable";
  }
}

export function getEvidenceTone(label: SurveyAnalyticsQueryRow["evidence"]["label"]) {
  if (label === "hidden" || label === "very_low") {
    return "critical";
  }
  if (label === "low") {
    return "warning";
  }
  if (label === "directional") {
    return "info";
  }
  return "ok";
}

export function getDominantTag(
  row: SurveyAnalyticsQueryRow | null,
  tagField: SurveyAnalyticsFieldDefinition,
) {
  const values = TAG_VALUES.map((tag) => {
    const key = `${metricKeyFor("share", tagField)}_${tag}`;
    return {
      tag,
      value: getMetricValue(row, key),
    };
  }).filter(
    (entry): entry is { tag: (typeof TAG_VALUES)[number]; value: number } => entry.value != null,
  );

  return values.sort((left, right) => right.value - left.value)[0] ?? null;
}

export function getDifferenceLabel(value: number | null) {
  if (value == null) {
    return "No comparable data";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

/**
 * Semantic tone for a 1-5 behavioural score. Colour is reserved for the
 * extremes so it actually *highlights* something: a genuinely high score
 * reads green, a genuinely low one reads red, and the broad mid-range stays
 * neutral (informational blue) rather than painting everything amber.
 */
export function getScoreTone(value: number | null | undefined): "high" | "mid" | "low" | "none" {
  if (value == null) {
    return "none";
  }
  if (value >= 4) {
    return "high";
  }
  if (value <= 2) {
    return "low";
  }
  return "mid";
}

/** Semantic tone for a delta vs baseline: positive=green, negative=red. */
export function getDeltaTone(value: number | null | undefined): "pos" | "neg" | "flat" {
  if (value == null || Math.abs(value) < 0.05) {
    return "flat";
  }
  return value > 0 ? "pos" : "neg";
}

/** Semantic tone for a low/medium/high profile band, matching the score scale. */
export function getTagTone(tag: string | null | undefined): "high" | "mid" | "low" | "none" {
  switch (tag) {
    case "high":
      return "high";
    case "medium":
      return "mid";
    case "low":
      return "low";
    default:
      return "none";
  }
}

export function buildBaselineMetrics(
  profileValueFields: SurveyAnalyticsFieldDefinition[],
  tagFields: SurveyAnalyticsFieldDefinition[],
  assetField: SurveyAnalyticsFieldDefinition | null,
): SurveyAnalyticsMetric[] {
  return [
    { key: "responses", kind: "count" },
    ...profileValueFields.map((field) => ({
      key: metricKeyFor("avg", field),
      kind: "average" as const,
      field: field.key,
    })),
    ...tagFields.flatMap((field) =>
      TAG_VALUES.map((tag) => ({
        key: `${metricKeyFor("share", field)}_${tag}`,
        kind: "share_equals" as const,
        field: field.key,
        value: tag,
      })),
    ),
    ...(assetField
      ? FLEXPULSE_DER_ASSET_VALUES.map((asset) => ({
          key: `asset_${asset}`,
          kind: "share_contains" as const,
          field: assetField.key,
          value: asset,
        }))
      : []),
  ];
}

export function buildSegmentMetrics(profileValueFields: SurveyAnalyticsFieldDefinition[]) {
  return [
    { key: "responses", kind: "count" as const },
    ...profileValueFields.map((field) => ({
      key: metricKeyFor("avg", field),
      kind: "average" as const,
      field: field.key,
    })),
  ];
}

export function buildSelectedFilters(input: {
  countryField: SurveyAnalyticsFieldDefinition | null;
  audienceField: SurveyAnalyticsFieldDefinition | null;
  languageField: SurveyAnalyticsFieldDefinition | null;
  tagField: SurveyAnalyticsFieldDefinition | null;
  tagFields: SurveyAnalyticsFieldDefinition[];
  assetField: SurveyAnalyticsFieldDefinition | null;
  selectedCountry: string | null;
  selectedAudience: string | null;
  selectedLanguage: string | null;
  selectedTag: string | null;
  selectedAsset: string | null;
  capabilityFacetFields?: SurveyAnalyticsFieldDefinition[];
  selectedCapabilityApplicability?: string | null;
  profileConditions: ProfileCondition[];
}): SurveyAnalyticsFilter[] {
  const filters: SurveyAnalyticsFilter[] = [];

  if (input.countryField && input.selectedCountry) {
    filters.push({ field: input.countryField.key, op: "eq", value: input.selectedCountry });
  }
  if (input.audienceField && input.selectedAudience) {
    filters.push({ field: input.audienceField.key, op: "eq", value: input.selectedAudience });
  }
  if (input.languageField && input.selectedLanguage) {
    filters.push({ field: input.languageField.key, op: "eq", value: input.selectedLanguage });
  }
  if (input.tagField && input.selectedTag) {
    filters.push({ field: input.tagField.key, op: "eq", value: input.selectedTag });
  }
  if (input.assetField && input.selectedAsset) {
    filters.push({ field: input.assetField.key, op: "contains", value: input.selectedAsset });
  }
  if (input.selectedCapabilityApplicability) {
    const separatorIndex = input.selectedCapabilityApplicability.lastIndexOf(":");
    const fieldKey = input.selectedCapabilityApplicability.slice(0, separatorIndex);
    const operator = input.selectedCapabilityApplicability.slice(separatorIndex + 1);
    const field = input.capabilityFacetFields?.find(
      (candidate) => candidate.key === fieldKey,
    );
    if (field && (operator === "is_null" || operator === "not_null")) {
      filters.push({ field: field.key, op: operator, value: null });
    }
  }

  input.profileConditions.forEach((condition) => {
    const field = input.tagFields.find((candidate) => candidate.key === condition.fieldKey);
    if (!field) {
      return;
    }

    filters.push({ field: field.key, op: "eq", value: condition.tag });
  });

  return filters;
}

export function optionsFromRows(rows: SurveyAnalyticsQueryRow[], fieldKey: string) {
  return rows
    .map((row) => {
      const value = row.group[fieldKey];
      return typeof value === "string" && value.trim()
        ? { value, label: `${value} (${formatMetricValue(row.metrics.responses)})` }
        : null;
    })
    .filter((option): option is { value: string; label: string } => Boolean(option));
}
