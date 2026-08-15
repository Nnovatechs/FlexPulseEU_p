import {
  flexpulsePrimaryProfileAxes,
  resolveFlexpulseAnalysisModel,
  resolveFlexpulseBehaviouralConcept,
} from "@/features/ontology/flexpulse-behavioural-schema";
import { computeLinearQuantile } from "@/features/surveys/analytics/descriptive-stats";
import { getScoreDirectionNote } from "@/features/surveys/analytics/instrument-health-semantics";
import {
  OVERVIEW_GEOGRAPHY_MIN_N,
  OVERVIEW_PROFILE_COMPARISON_MIN_N,
  OVERVIEW_VISUALISATION_MIN_N,
} from "@/features/surveys/analytics/overview-v2-policy";
import { getPrimaryProfileFields } from "@/features/surveys/analytics/profile-explorer-utils";
import {
  getOverviewBandFromScore,
  getOverviewBandLabel,
  getOverviewConstructSemantics,
  type OverviewBandKey,
} from "@/features/surveys/analytics/overview-semantics";
import { buildOverviewV2Insights, type OverviewV2Insight } from "@/features/surveys/analytics/overview-v2-insights";
import {
  getQuadrantKey,
  resolveQuadrantProfileView,
  type QuadrantProfileViewDefinition,
  type QuadrantSlot,
} from "@/features/surveys/analytics/overview-view-registry";
import { getDeclaredFlexibilityCapabilityAnalysisCatalog } from "@/features/surveys/declared-flexibility-capability-module";
import type { PersistedSurvey } from "@/features/surveys/generator-types";
import type {
  SurveyAnalyticsFieldDefinition,
  SurveyAnalyticsRecord,
  SurveyAnalyticsSchema,
} from "@/features/surveys/survey-analytics";

const PLOT_COORDINATE_DECIMALS = 2;

type ConstructSummary = {
  conceptKey: string;
  label: string;
  description: string | null;
  applicableN: number;
  median: number;
  q1: number;
  q3: number;
  bands: Array<{
    key: OverviewBandKey;
    label: string;
    count: number;
    share: number;
  }>;
};

type ConstructSummaryMetric = ConstructSummary & {
  suppressed: boolean;
};

export type OverviewGroupAxis = {
  conceptKey: string;
  label: string;
  shortLabel: string;
  directionNote: string | null;
  median: number;
  q1: number;
  q3: number;
  n: number;
};

export type OverviewGroupProfile = {
  n: number;
  detailAvailable: boolean;
  axes: OverviewGroupAxis[];
};

export type OverviewOpportunityView = {
  key: string;
  label: string;
  xLabel: string;
  yLabel: string;
  xCutoff: number;
  yCutoff: number;
  helperText?: string;
  applicableN: number;
  notApplicableN: number;
  missingYAxisN: number;
  detailAvailable: boolean;
  distributionCells: Array<{
    x: number;
    y: number;
    count: number;
    share: number;
    quadrantKey: string;
  }>;
  quadrants: Array<{
    key: string;
    slot: QuadrantSlot;
    label: string;
    count: number;
    share: number;
  }>;
  groupProfiles: Record<string, OverviewGroupProfile>;
};

export type SurveyOverviewData = {
  context: {
    analysedResponseCount: number;
    collectedResponseCount: number;
    countries: Array<{ code: string; count: number }>;
    dateRange: {
      startAt: string | null;
      endAt: string | null;
      scope: "collected" | "analysed";
    } | null;
    mappingCoverage:
      | {
          analysed: number;
          collected: number;
        }
      | null;
    surveyStatus: string;
    sampleLabel: string;
  };
  state: {
    hasCollectedResponses: boolean;
    hasAnalysedResponses: boolean;
    hasMappingGap: boolean;
  };
  opportunity: {
    title: string;
    defaultOptionKey: string;
    options: Array<{
      key: string;
      label: string;
      applicableN: number;
      detailAvailable: boolean;
      helperText?: string;
    }>;
    viewsByOptionKey: Record<string, OverviewOpportunityView>;
  } | null;
  constructs: ConstructSummary[];
  insights: OverviewV2Insight[];
  countryPulse:
    | {
        countries: Array<{ code: string; count: number; detailAvailable: boolean }>;
        constructs: Array<{
          conceptKey: string;
          label: string;
          overall: ConstructSummary;
          countries: Array<{
            code: string;
            metric: ConstructSummaryMetric | null;
          }>;
        }>;
      }
    | null;
};

type BuildSurveyOverviewInput = {
  survey: PersistedSurvey;
  schema: SurveyAnalyticsSchema;
  rows: SurveyAnalyticsRecord[];
  collectedResponseCount: number;
  collectedResponseWindow: {
    firstRespondedAt: string | null;
    lastRespondedAt: string | null;
  };
};

type AxisOptionDefinition = {
  key: string;
  label: string;
  facetKey: string | null;
  helperText?: string;
};

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function asNumericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getCountryCode(record: SurveyAnalyticsRecord) {
  const countryCode = record.mapper_output.context_metadata.country_code;
  return typeof countryCode === "string" && countryCode.trim() ? countryCode.trim().toUpperCase() : null;
}

function getConceptValue(record: SurveyAnalyticsRecord, conceptKey: string) {
  return asNumericValue(record.mapper_output.profile[conceptKey]?.value);
}

function getConceptFacetValue(record: SurveyAnalyticsRecord, conceptKey: string, facetKey: string) {
  return asNumericValue(record.mapper_output.profile[conceptKey]?.facets?.[facetKey]?.value);
}

function getSchemaRef(survey: PersistedSurvey, schema: SurveyAnalyticsSchema) {
  return {
    schemaNamespace: schema.schema_namespace,
    schemaVersion: survey.definition_json?.survey_meta?.measurement_plan_json?.schema_version ?? 1,
  };
}

function groupCounts<T>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function describeValues(values: number[]) {
  const sorted = values.slice().sort((left, right) => left - right);
  return {
    n: sorted.length,
    median: computeLinearQuantile(sorted, 0.5) ?? 0,
    q1: computeLinearQuantile(sorted, 0.25) ?? 0,
    q3: computeLinearQuantile(sorted, 0.75) ?? 0,
  };
}

function shortAxisLabel(conceptKey: string, label: string) {
  if (conceptKey === "thermal_comfort_norms") {
    return "Thermal strictness";
  }

  if (label.length <= 16) {
    return label;
  }

  return label.split(/\s+/).slice(0, 2).join(" ");
}

function facetLabel(
  conceptKey: string,
  facetKey: string,
  schemaRef: { schemaNamespace: string; schemaVersion: number },
) {
  const catalogId = resolveFlexpulseAnalysisModel({
    ...schemaRef,
    conceptKey,
  })?.conditional_module_config?.catalog_id;
  if (catalogId === "declared_flexibility_capability_v1") {
    return getDeclaredFlexibilityCapabilityAnalysisCatalog().groupLabels[facetKey] ?? facetKey;
  }

  return facetKey.replace(/_/g, " ");
}

function buildConstructSummary(
  field: SurveyAnalyticsFieldDefinition,
  rows: SurveyAnalyticsRecord[],
): ConstructSummary | null {
  const entries = rows
    .map((record) => {
      const value = getConceptValue(record, field.concept_key ?? "");
      if (value == null) {
        return null;
      }

      return {
        value,
        band: getOverviewBandFromScore(value),
      };
    })
    .filter((entry): entry is { value: number; band: OverviewBandKey } => entry != null);

  if (entries.length === 0 || !field.concept_key) {
    return null;
  }

  const values = entries
    .map((entry) => entry.value)
    .slice()
    .sort((left, right) => left - right);
  const bandCounts = groupCounts(entries.map((entry) => entry.band));
  const semantics = getOverviewConstructSemantics(field.concept_key);

  return {
    conceptKey: field.concept_key,
    label: field.label,
    description: semantics.description ?? null,
    applicableN: values.length,
    median: computeLinearQuantile(values, 0.5) ?? 0,
    q1: computeLinearQuantile(values, 0.25) ?? 0,
    q3: computeLinearQuantile(values, 0.75) ?? 0,
    bands: (["high", "medium", "low"] as const).map((band) => ({
      key: band,
      label: getOverviewBandLabel(field.concept_key!, band),
      count: bandCounts.get(band) ?? 0,
      share: (bandCounts.get(band) ?? 0) / values.length,
    })),
  };
}

function normalizePlotCoordinate(value: number) {
  return Math.max(1, Math.min(5, Number(value.toFixed(PLOT_COORDINATE_DECIMALS))));
}

function getConstructFields(schema: SurveyAnalyticsSchema) {
  const valueFields = schema.fields.filter(
    (field) =>
      field.source === "profile" &&
      field.value_type === "number" &&
      !field.facet &&
      field.key.endsWith(".value"),
  );

  return getPrimaryProfileFields(valueFields).filter((field) => !field.facet);
}

function presentConceptKeys(schema: SurveyAnalyticsSchema) {
  return new Set(
    schema.fields
      .filter((field) => field.concept_key && field.source === "profile" && !field.facet && field.key.endsWith(".value"))
      .map((field) => field.concept_key!),
  );
}

function buildAxisOptions(
  view: QuadrantProfileViewDefinition,
  schema: SurveyAnalyticsSchema,
  schemaRef: { schemaNamespace: string; schemaVersion: number },
): AxisOptionDefinition[] {
  const options: AxisOptionDefinition[] = [
    {
      key: view.overallOption.key,
      label: view.overallOption.label,
      facetKey: null,
      helperText: view.overallOption.helperText,
    },
  ];

  if (!view.xAxis.includeConditionalFacets) {
    return options;
  }

  const facetFields = schema.fields.filter(
    (field) =>
      field.concept_key === view.xAxis.conceptKey &&
      field.value_type === "number" &&
      field.evidence_level === "facet_subscore" &&
      Boolean(field.facet),
  );

  return [
    ...options,
    ...facetFields.map((field) => ({
      key: field.facet!,
      label: facetLabel(view.xAxis.conceptKey, field.facet!, schemaRef),
      facetKey: field.facet!,
    })),
  ];
}

function comparisonAxisOrder(schemaRef: { schemaNamespace: string; schemaVersion: number }) {
  return flexpulsePrimaryProfileAxes
    .filter(
      (concept) =>
        concept.namespace === schemaRef.schemaNamespace && concept.schema_version === schemaRef.schemaVersion,
    )
    .map((concept) => concept.concept_key);
}

function isEligibleInsightConcept(
  conceptKey: string,
  schemaRef: { schemaNamespace: string; schemaVersion: number },
  field: SurveyAnalyticsFieldDefinition | undefined,
) {
  const concept = resolveFlexpulseBehaviouralConcept({ ...schemaRef, conceptKey });
  if (concept) {
    if (concept.output_type !== "number" || concept.analysis_model.score_direction === "not_directional") {
      return false;
    }

    return concept.concept_role === "primary_profile_axis" || concept.concept_role === "behavioural_modulator";
  }

  return (
    field?.value_type === "number" &&
    (field.concept_role === "primary_profile_axis" || field.concept_role === "behavioural_modulator")
  );
}

function buildGroupProfile(
  groupRows: SurveyAnalyticsRecord[],
  view: QuadrantProfileViewDefinition,
  schema: SurveyAnalyticsSchema,
  schemaRef: { schemaNamespace: string; schemaVersion: number },
): OverviewGroupProfile {
  const n = groupRows.length;
  if (n < OVERVIEW_PROFILE_COMPARISON_MIN_N) {
    return { n, detailAvailable: false, axes: [] };
  }

  const excluded = view.comparison.excludeDefiningAxes
    ? new Set([view.xAxis.conceptKey, view.yAxis.conceptKey])
    : new Set<string>();
  const present = presentConceptKeys(schema);
  const orderedKeys = comparisonAxisOrder(schemaRef).filter(
    (conceptKey) => present.has(conceptKey) && !excluded.has(conceptKey),
  );
  const fallbackKeys = [...present].filter((conceptKey) => {
    const field = schema.fields.find(
      (entry) => entry.concept_key === conceptKey && !entry.facet && entry.key.endsWith(".value"),
    );
    return (
      !excluded.has(conceptKey) &&
      view.comparison.axisConceptRoles.includes(field?.concept_role ?? "") &&
      !orderedKeys.includes(conceptKey)
    );
  });
  const axisKeys = [...orderedKeys, ...fallbackKeys].slice(0, view.comparison.maxAxes);
  const axes: OverviewGroupAxis[] = [];

  for (const conceptKey of axisKeys) {
    const field = schema.fields.find(
      (entry) => entry.concept_key === conceptKey && !entry.facet && entry.key.endsWith(".value"),
    );
    if (!field || field.value_type !== "number") {
      continue;
    }

    const values = groupRows
      .map((row) => getConceptValue(row, conceptKey))
      .filter((value): value is number => value != null);
    if (values.length < OVERVIEW_PROFILE_COMPARISON_MIN_N) {
      continue;
    }

    const direction = resolveFlexpulseAnalysisModel({ ...schemaRef, conceptKey })?.score_direction;
    const concept = resolveFlexpulseBehaviouralConcept({ ...schemaRef, conceptKey });
    axes.push({
      conceptKey,
      label: field.label,
      shortLabel: shortAxisLabel(conceptKey, concept?.label ?? field.label),
      directionNote: getScoreDirectionNote(direction),
      ...describeValues(values),
    });
  }

  return {
    n,
    detailAvailable: true,
    axes: axes.length >= 3 ? axes : [],
  };
}

function buildOpportunityView(
  option: AxisOptionDefinition,
  rows: SurveyAnalyticsRecord[],
  view: QuadrantProfileViewDefinition,
  yLabel: string,
  schema: SurveyAnalyticsSchema,
  schemaRef: { schemaNamespace: string; schemaVersion: number },
): OverviewOpportunityView {
  const applicableRows: Array<{ record: SurveyAnalyticsRecord; x: number; y: number }> = [];
  let notApplicableN = 0;
  let missingYAxisN = 0;

  for (const record of rows) {
    const y = getConceptValue(record, view.yAxis.conceptKey);
    const x =
      option.facetKey == null
        ? getConceptValue(record, view.xAxis.conceptKey)
        : getConceptFacetValue(record, view.xAxis.conceptKey, option.facetKey);

    if (x == null) {
      notApplicableN += 1;
      continue;
    }

    if (y == null) {
      missingYAxisN += 1;
      continue;
    }

    applicableRows.push({ record, x, y });
  }

  const applicableN = applicableRows.length;
  const xLabel = option.facetKey ? `${option.label} capability` : option.label;
  const emptyProfiles = Object.fromEntries(
    Object.values(view.quadrantKeys).map((key) => [key, { n: 0, detailAvailable: false, axes: [] }]),
  ) as Record<string, OverviewGroupProfile>;

  if (applicableN < OVERVIEW_VISUALISATION_MIN_N) {
    return {
      key: option.key,
      label: option.label,
      xLabel,
      yLabel,
      xCutoff: view.xAxis.favourableCutoff,
      yCutoff: view.yAxis.favourableCutoff,
      helperText: option.helperText,
      applicableN,
      notApplicableN,
      missingYAxisN,
      detailAvailable: false,
      distributionCells: [],
      quadrants: [],
      groupProfiles: emptyProfiles,
    };
  }

  const cellCounts = new Map<string, { x: number; y: number; count: number; quadrantKey: string }>();
  const quadrantRows = new Map<string, SurveyAnalyticsRecord[]>();

  for (const row of applicableRows) {
    const x = normalizePlotCoordinate(row.x);
    const y = normalizePlotCoordinate(row.y);
    const quadrantKey = getQuadrantKey(row.x, row.y, view);
    const cellKey = `${x}|${y}`;
    const existingCell = cellCounts.get(cellKey);
    if (existingCell) {
      existingCell.count += 1;
    } else {
      cellCounts.set(cellKey, { x, y, count: 1, quadrantKey });
    }

    const bucket = quadrantRows.get(quadrantKey) ?? [];
    bucket.push(row.record);
    quadrantRows.set(quadrantKey, bucket);
  }

  const quadrants = (Object.keys(view.quadrantKeys) as QuadrantSlot[]).map((slot) => {
    const key = view.quadrantKeys[slot];
    const count = quadrantRows.get(key)?.length ?? 0;
    return {
      key,
      slot,
      label: view.quadrantLabels[slot],
      count,
      share: count / applicableN,
    };
  });

  const groupProfiles = Object.fromEntries(
    quadrants.map((quadrant) => [
      quadrant.key,
      buildGroupProfile(quadrantRows.get(quadrant.key) ?? [], view, schema, schemaRef),
    ]),
  );

  return {
    key: option.key,
    label: option.label,
    xLabel,
    yLabel,
    xCutoff: view.xAxis.favourableCutoff,
    yCutoff: view.yAxis.favourableCutoff,
    helperText: option.helperText,
    applicableN,
    notApplicableN,
    missingYAxisN,
    detailAvailable: true,
    distributionCells: Array.from(cellCounts.values())
      .sort((left, right) => right.count - left.count || left.y - right.y || left.x - right.x)
      .map((cell) => ({
        ...cell,
        share: cell.count / applicableN,
      })),
    quadrants,
    groupProfiles,
  };
}

function buildCountryPulse(
  constructs: ConstructSummary[],
  constructFields: SurveyAnalyticsFieldDefinition[],
  rows: SurveyAnalyticsRecord[],
): SurveyOverviewData["countryPulse"] {
  const countryCounts = groupCounts(rows.map(getCountryCode).filter((value): value is string => value != null));
  const countries = Array.from(countryCounts.entries())
    .map(([code, count]) => ({
      code,
      count,
      detailAvailable: count >= OVERVIEW_GEOGRAPHY_MIN_N,
    }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));

  if (countries.length < 2) {
    return null;
  }

  return {
    countries,
    constructs: constructFields
      .map((field) => {
        const overall = constructs.find((construct) => construct.conceptKey === field.concept_key);
        if (!overall || !field.concept_key) {
          return null;
        }

        return {
          conceptKey: field.concept_key,
          label: field.label,
          overall,
          countries: countries.map((country) => {
            const countrySummary = buildConstructSummary(
              field,
              rows.filter((row) => getCountryCode(row) === country.code),
            );

            if (!countrySummary || countrySummary.applicableN < OVERVIEW_GEOGRAPHY_MIN_N) {
              return { code: country.code, metric: null };
            }

            return {
              code: country.code,
              metric: { ...countrySummary, suppressed: false },
            };
          }),
        };
      })
      .filter(
        (construct): construct is NonNullable<SurveyOverviewData["countryPulse"]>["constructs"][number] =>
          construct != null,
      ),
  };
}

export function buildSurveyOverviewData(input: BuildSurveyOverviewInput): SurveyOverviewData {
  const schemaRef = getSchemaRef(input.survey, input.schema);
  const constructFields = getConstructFields(input.schema);
  const constructs = constructFields
    .map((field) => buildConstructSummary(field, input.rows))
    .filter((construct): construct is ConstructSummary => construct != null);
  const view = resolveQuadrantProfileView({
    ...schemaRef,
    presentConceptKeys: presentConceptKeys(input.schema),
  });
  const yField = constructFields.find((field) => field.concept_key === view?.yAxis.conceptKey);
  const opportunityViews = view
    ? Object.fromEntries(
        buildAxisOptions(view, input.schema, schemaRef).map((option) => [
          option.key,
          buildOpportunityView(
            option,
            input.rows,
            view,
            yField?.label ?? view.yAxis.conceptKey,
            input.schema,
            schemaRef,
          ),
        ]),
      )
    : null;

  const countryCounts = groupCounts(
    input.rows.map(getCountryCode).filter((country): country is string => country != null),
  );
  const countries = Array.from(countryCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));

  const dateRange =
    input.collectedResponseWindow.firstRespondedAt || input.collectedResponseWindow.lastRespondedAt
      ? {
          startAt: input.collectedResponseWindow.firstRespondedAt,
          endAt: input.collectedResponseWindow.lastRespondedAt,
          scope: "collected" as const,
        }
      : input.rows.length > 0
        ? {
            startAt: input.rows[input.rows.length - 1]?.responded_at ?? null,
            endAt: input.rows[0]?.responded_at ?? null,
            scope: "analysed" as const,
          }
        : null;

  const countryPulse = buildCountryPulse(constructs, constructFields, input.rows);
  const overallOpportunity = opportunityViews?.[view?.overallOption.key ?? "overall"] ?? null;
  const insights = buildOverviewV2Insights({
    schemaNamespace: schemaRef.schemaNamespace,
    schemaVersion: schemaRef.schemaVersion,
    rows: input.rows,
    constructs,
    eligibleConceptKeys: constructFields
      .map((field) => field.concept_key)
      .filter((conceptKey): conceptKey is string => Boolean(conceptKey))
      .filter((conceptKey) =>
        isEligibleInsightConcept(
          conceptKey,
          schemaRef,
          constructFields.find((field) => field.concept_key === conceptKey),
        ),
      ),
    opportunity:
      view && overallOpportunity && overallOpportunity.applicableN >= OVERVIEW_VISUALISATION_MIN_N
        ? {
            view,
            applicableN: overallOpportunity.applicableN,
            quadrants: overallOpportunity.quadrants,
          }
        : null,
  });

  return {
    context: {
      analysedResponseCount: input.rows.length,
      collectedResponseCount: input.collectedResponseCount,
      countries,
      dateRange,
      mappingCoverage:
        input.collectedResponseCount > 0
          ? {
              analysed: input.rows.length,
              collected: input.collectedResponseCount,
            }
          : null,
      surveyStatus: toTitleCase(input.survey.status),
      sampleLabel: "Full survey sample · unweighted",
    },
    state: {
      hasCollectedResponses: input.collectedResponseCount > 0,
      hasAnalysedResponses: input.rows.length > 0,
      hasMappingGap: input.collectedResponseCount > input.rows.length,
    },
    opportunity:
      view && opportunityViews
        ? {
            title: view.title,
            defaultOptionKey: view.overallOption.key,
            options: Object.values(opportunityViews).map((entry) => ({
              key: entry.key,
              label: entry.label,
              applicableN: entry.applicableN,
              detailAvailable: entry.detailAvailable,
              helperText: entry.helperText,
            })),
            viewsByOptionKey: opportunityViews,
          }
        : null,
    constructs,
    insights,
    countryPulse,
  };
}
