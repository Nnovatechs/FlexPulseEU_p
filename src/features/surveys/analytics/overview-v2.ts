import type { MapperProfileTag, PersistedSurvey } from "@/features/surveys/generator-types";
import { getPrimaryProfileFields } from "@/features/surveys/analytics/profile-explorer-utils";
import {
  getOverviewBandFromScore,
  getOverviewBandLabel,
  getOverviewConstructSemantics,
  type OverviewBandKey,
} from "@/features/surveys/analytics/overview-semantics";
import type {
  SurveyAnalyticsFieldDefinition,
  SurveyAnalyticsRecord,
  SurveyAnalyticsSchema,
} from "@/features/surveys/survey-analytics";

export const OVERVIEW_PRIVACY_MIN_N = 5;
export const OVERVIEW_COUNTRY_INSIGHT_MIN_N = 20;
const OPPORTUNITY_DOMINANCE_MIN_GAP = 0.1;
const CONSTRUCT_CONTRAST_MIN_GAP = 0.1;
const COUNTRY_MEDIAN_DIFF_MIN = 0.4;
const PLOT_BIN_SIZE = 0.25;

type ConstructSummary = {
  conceptKey: string;
  label: string;
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

type OpportunityQuadrantKey =
  | "high_willingness_high_capability"
  | "high_willingness_limited_capability"
  | "lower_willingness_high_capability"
  | "lower_immediate_fit";

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
    defaultDfcKey: string;
    dfcOptions: Array<{
      key: string;
      label: string;
      applicableN: number;
      detailAvailable: boolean;
      helperText?: string;
    }>;
    viewsByDfcKey: Record<
      string,
      {
        key: string;
        label: string;
        xLabel: string;
        yLabel: string;
        helperText?: string;
        applicableN: number;
        notApplicableN: number;
        missingWillingnessN: number;
        detailAvailable: boolean;
        distributionCells: Array<{
          x: number;
          y: number;
          count: number;
          share: number;
        }>;
        quadrants: Array<{
          key: OpportunityQuadrantKey;
          label: string;
          count: number;
          share: number;
        }>;
      }
    >;
  };
  constructs: ConstructSummary[];
  insights: Array<{
    title: string;
    body: string;
    evidence: string;
  }>;
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

type DfcOptionDefinition = {
  key: string;
  label: string;
  facetKey: string | null;
  helperText?: string;
};

const DFC_LABELS: Record<string, string> = {
  washing_machine_scheduling: "Washing machine",
  ev_charging: "EV charging",
  space_conditioning: "Space conditioning",
  water_heating: "Water heating",
  battery_operation: "Battery operation",
};

const QUADRANT_LABELS: Record<OpportunityQuadrantKey, string> = {
  high_willingness_high_capability: "Favourable willingness and capability",
  high_willingness_limited_capability: "Favourable willingness, limited capability",
  lower_willingness_high_capability: "Favourable capability, lower willingness",
  lower_immediate_fit: "Lower immediate fit",
};

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanizeSnakeCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => {
      if (part.toLowerCase() === "ev") {
        return "EV";
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function formatDfcFacetLabel(facetKey: string) {
  return DFC_LABELS[facetKey] ?? humanizeSnakeCase(facetKey);
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

function getConceptTag(record: SurveyAnalyticsRecord, conceptKey: string): MapperProfileTag | null {
  const tag = record.mapper_output.profile[conceptKey]?.tag;
  return tag === "low" || tag === "medium" || tag === "high" ? tag : null;
}

function getScoreBand(record: SurveyAnalyticsRecord, conceptKey: string, score: number): OverviewBandKey {
  return getConceptTag(record, conceptKey) ?? getOverviewBandFromScore(score);
}

function groupCounts<T>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function computeLinearQuantile(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) {
    return null;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const position = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lowerValue = sortedValues[lowerIndex];
  const upperValue = sortedValues[upperIndex];

  if (lowerIndex === upperIndex) {
    return lowerValue;
  }

  return lowerValue + (upperValue - lowerValue) * (position - lowerIndex);
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
        band: getScoreBand(record, field.concept_key ?? "", value),
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

  return {
    conceptKey: field.concept_key,
    label: field.label,
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

function getQuadrantKey(willingness: number, capability: number): OpportunityQuadrantKey {
  if (willingness >= 4 && capability >= 4) {
    return "high_willingness_high_capability";
  }

  if (willingness >= 4 && capability < 4) {
    return "high_willingness_limited_capability";
  }

  if (willingness < 4 && capability >= 4) {
    return "lower_willingness_high_capability";
  }

  return "lower_immediate_fit";
}

function binScore(value: number) {
  const rounded = Math.round(value / PLOT_BIN_SIZE) * PLOT_BIN_SIZE;
  return Math.max(1, Math.min(5, Number(rounded.toFixed(2))));
}

function buildDfcOptionDefinitions(schema: SurveyAnalyticsSchema): DfcOptionDefinition[] {
  const facetFields = schema.fields.filter(
    (field) =>
      field.concept_key === "declared_flexibility_capability" &&
      field.value_type === "number" &&
      field.evidence_level === "facet_subscore" &&
      Boolean(field.facet),
  );

  return [
    {
      key: "overall",
      label: "Overall DFC",
      facetKey: null,
      helperText: "Overall DFC combines the capability modules applicable to each household.",
    },
    ...facetFields.map((field) => ({
      key: field.facet!,
      label: formatDfcFacetLabel(field.facet!),
      facetKey: field.facet!,
    })),
  ];
}

function buildOpportunityView(option: DfcOptionDefinition, rows: SurveyAnalyticsRecord[]) {
  const applicableRows: Array<{ willingness: number; capability: number }> = [];
  let notApplicableN = 0;
  let missingWillingnessN = 0;

  for (const record of rows) {
    const willingness = getConceptValue(record, "flexibility_willingness");
    const capability =
      option.facetKey == null
        ? getConceptValue(record, "declared_flexibility_capability")
        : getConceptFacetValue(record, "declared_flexibility_capability", option.facetKey);

    if (capability == null) {
      notApplicableN += 1;
      continue;
    }

    if (willingness == null) {
      missingWillingnessN += 1;
      continue;
    }

    applicableRows.push({ willingness, capability });
  }

  const applicableN = applicableRows.length;
  const detailAvailable = applicableN >= OVERVIEW_PRIVACY_MIN_N;
  if (!detailAvailable) {
    return {
      key: option.key,
      label: option.label,
      xLabel: option.label === "Overall DFC" ? "Overall DFC" : `${option.label} capability`,
      yLabel: "Flexibility willingness",
      helperText: option.helperText,
      applicableN,
      notApplicableN,
      missingWillingnessN,
      detailAvailable,
      distributionCells: [],
      quadrants: [],
    };
  }

  const cellCounts = new Map<string, { x: number; y: number; count: number }>();
  const quadrantCounts = new Map<OpportunityQuadrantKey, number>();

  for (const row of applicableRows) {
    const x = binScore(row.capability);
    const y = binScore(row.willingness);
    const cellKey = `${x}|${y}`;
    const existingCell = cellCounts.get(cellKey);

    if (existingCell) {
      existingCell.count += 1;
    } else {
      cellCounts.set(cellKey, { x, y, count: 1 });
    }

    const quadrantKey = getQuadrantKey(row.willingness, row.capability);
    quadrantCounts.set(quadrantKey, (quadrantCounts.get(quadrantKey) ?? 0) + 1);
  }

  return {
    key: option.key,
    label: option.label,
    xLabel: option.label === "Overall DFC" ? "Overall DFC" : `${option.label} capability`,
    yLabel: "Flexibility willingness",
    helperText: option.helperText,
    applicableN,
    notApplicableN,
    missingWillingnessN,
    detailAvailable,
    distributionCells: Array.from(cellCounts.values())
      .sort((left, right) => right.count - left.count || left.y - right.y || left.x - right.x)
      .map((cell) => ({
        ...cell,
        share: cell.count / applicableN,
      })),
    quadrants: (
      [
        "high_willingness_high_capability",
        "high_willingness_limited_capability",
        "lower_willingness_high_capability",
        "lower_immediate_fit",
      ] as const
    ).map((key) => ({
      key,
      label: QUADRANT_LABELS[key],
      count: quadrantCounts.get(key) ?? 0,
      share: (quadrantCounts.get(key) ?? 0) / applicableN,
    })),
  };
}

function getComparableConstructs(constructs: ConstructSummary[]) {
  return constructs.filter((construct) =>
    getOverviewConstructSemantics(construct.conceptKey).comparableHighShare,
  );
}

function buildOpportunityInsight(opportunityView: SurveyOverviewData["opportunity"]["viewsByDfcKey"][string]) {
  if (!opportunityView.detailAvailable || opportunityView.quadrants.length === 0) {
    return null;
  }

  const [top, second] = opportunityView.quadrants
    .slice()
    .sort((left, right) => right.share - left.share || right.count - left.count);

  if (!top) {
    return null;
  }

  if (second && top.share - second.share >= OPPORTUNITY_DOMINANCE_MIN_GAP) {
    return {
      title: "Largest opportunity group",
      body: `The largest group combines ${top.label.toLowerCase()} in this sample.`,
      evidence: `${(top.share * 100).toFixed(0)}% · n=${top.count} of ${opportunityView.applicableN} applicable responses`,
    };
  }

  return {
    title: "Opportunity distribution is spread",
    body: "No single willingness-by-capability group clearly dominates the full analysable sample.",
    evidence: `${(top.share * 100).toFixed(0)}% · n=${top.count} in the largest group`,
  };
}

function buildConstructContrastInsight(constructs: ConstructSummary[]) {
  const comparableConstructs = getComparableConstructs(constructs).filter(
    (construct) => construct.applicableN >= OVERVIEW_PRIVACY_MIN_N,
  );
  let bestPair: {
    left: ConstructSummary;
    right: ConstructSummary;
    gap: number;
  } | null = null;

  for (let index = 0; index < comparableConstructs.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < comparableConstructs.length; nextIndex += 1) {
      const left = comparableConstructs[index];
      const right = comparableConstructs[nextIndex];
      const leftHighShare = left.bands.find((band) => band.key === "high")?.share ?? 0;
      const rightHighShare = right.bands.find((band) => band.key === "high")?.share ?? 0;
      const gap = Math.abs(leftHighShare - rightHighShare);

      if (!bestPair || gap > bestPair.gap) {
        bestPair =
          leftHighShare >= rightHighShare
            ? { left, right, gap }
            : { left: right, right: left, gap };
      }
    }
  }

  if (!bestPair || bestPair.gap < CONSTRUCT_CONTRAST_MIN_GAP) {
    return null;
  }

  const leftLabel = bestPair.left.bands.find((band) => band.key === "high")?.label ?? "high";
  return {
    title: "Construct contrast",
    body: `${bestPair.left.label} is more ${leftLabel} than ${bestPair.right.label.toLowerCase()} in this sample.`,
    evidence: `${(bestPair.gap * 100).toFixed(0)} percentage-point gap · n=${bestPair.left.applicableN} vs n=${bestPair.right.applicableN}`,
  };
}

function buildMostMixedConstructInsight(constructs: ConstructSummary[]) {
  const eligible = constructs.filter((construct) => construct.applicableN >= OVERVIEW_PRIVACY_MIN_N);
  const mixed = eligible
    .map((construct) => ({
      construct,
      dominantShare: Math.max(...construct.bands.map((band) => band.share)),
    }))
    .sort((left, right) => left.dominantShare - right.dominantShare)[0];

  if (!mixed) {
    return null;
  }

  return {
    title: "Most mixed construct",
    body: `${mixed.construct.label} shows the most mixed response pattern across the measured constructs in this sample.`,
    evidence: `${(mixed.dominantShare * 100).toFixed(0)}% in the largest band · n=${mixed.construct.applicableN}`,
  };
}

function buildCountryContrastInsight(
  countryMetrics: SurveyOverviewData["countryPulse"],
) {
  if (!countryMetrics || countryMetrics.countries.length < 2) {
    return null;
  }

  let bestHighShareContrast:
    | {
        conceptLabel: string;
        topCountry: string;
        bottomCountry: string;
        gap: number;
        topN: number;
        bottomN: number;
        topLabel: string;
      }
    | null = null;
  let bestMedianContrast:
    | {
        conceptLabel: string;
        topCountry: string;
        bottomCountry: string;
        gap: number;
        topN: number;
        bottomN: number;
      }
    | null = null;

  for (const construct of countryMetrics.constructs) {
    const semantics = getOverviewConstructSemantics(construct.conceptKey);
    const visibleMetrics = construct.countries
      .map((country) => ({
        code: country.code,
        metric: country.metric,
      }))
      .filter(
        (country): country is { code: string; metric: ConstructSummaryMetric } =>
          country.metric != null &&
          !country.metric.suppressed &&
          country.metric.applicableN >= OVERVIEW_COUNTRY_INSIGHT_MIN_N,
      );

    for (let index = 0; index < visibleMetrics.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < visibleMetrics.length; nextIndex += 1) {
        const left = visibleMetrics[index];
        const right = visibleMetrics[nextIndex];
        const highShareLeft = left.metric.bands.find((band) => band.key === "high")?.share ?? 0;
        const highShareRight = right.metric.bands.find((band) => band.key === "high")?.share ?? 0;
        const medianGap = Math.abs(left.metric.median - right.metric.median);

        if (semantics.comparableHighShare) {
          const gap = Math.abs(highShareLeft - highShareRight);
          const top = highShareLeft >= highShareRight ? left : right;
          const bottom = top === left ? right : left;

          if (!bestHighShareContrast || gap > bestHighShareContrast.gap) {
            bestHighShareContrast = {
              conceptLabel: construct.label,
              topCountry: top.code,
              bottomCountry: bottom.code,
              gap,
              topN: top.metric.applicableN,
              bottomN: bottom.metric.applicableN,
              topLabel: top.metric.bands.find((band) => band.key === "high")?.label ?? "high",
            };
          }
        }

        const topByMedian = left.metric.median >= right.metric.median ? left : right;
        const bottomByMedian = topByMedian === left ? right : left;
        if (!bestMedianContrast || medianGap > bestMedianContrast.gap) {
          bestMedianContrast = {
            conceptLabel: construct.label,
            topCountry: topByMedian.code,
            bottomCountry: bottomByMedian.code,
            gap: medianGap,
            topN: topByMedian.metric.applicableN,
            bottomN: bottomByMedian.metric.applicableN,
          };
        }
      }
    }
  }

  if (bestHighShareContrast && bestHighShareContrast.gap >= CONSTRUCT_CONTRAST_MIN_GAP) {
    return {
      title: "Country contrast",
      body: `${bestHighShareContrast.topCountry} shows a higher share of ${bestHighShareContrast.topLabel} responses in ${bestHighShareContrast.conceptLabel.toLowerCase()} than ${bestHighShareContrast.bottomCountry} in this sample.`,
      evidence: `${(bestHighShareContrast.gap * 100).toFixed(0)} percentage-point gap · n=${bestHighShareContrast.topN} vs n=${bestHighShareContrast.bottomN}`,
    };
  }

  if (bestMedianContrast && bestMedianContrast.gap >= COUNTRY_MEDIAN_DIFF_MIN) {
    return {
      title: "Country contrast",
      body: `${bestMedianContrast.topCountry} reports a higher median in ${bestMedianContrast.conceptLabel.toLowerCase()} than ${bestMedianContrast.bottomCountry} in this sample.`,
      evidence: `${bestMedianContrast.gap.toFixed(2)} median-point gap · n=${bestMedianContrast.topN} vs n=${bestMedianContrast.bottomN}`,
    };
  }

  return null;
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
      detailAvailable: count >= OVERVIEW_PRIVACY_MIN_N,
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

            if (!countrySummary || countrySummary.applicableN < OVERVIEW_PRIVACY_MIN_N) {
              return {
                code: country.code,
                metric: null,
              };
            }

            return {
              code: country.code,
              metric: {
                ...countrySummary,
                suppressed: false,
              },
            };
          }),
        };
      })
      .filter(
        (
          construct,
        ): construct is NonNullable<SurveyOverviewData["countryPulse"]>["constructs"][number] =>
          construct != null,
      ),
  };
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

export function buildSurveyOverviewData(input: BuildSurveyOverviewInput): SurveyOverviewData {
  const constructFields = getConstructFields(input.schema);
  const constructs = constructFields
    .map((field) => buildConstructSummary(field, input.rows))
    .filter((construct): construct is ConstructSummary => construct != null);
  const opportunityViews = Object.fromEntries(
    buildDfcOptionDefinitions(input.schema).map((option) => [
      option.key,
      buildOpportunityView(option, input.rows),
    ]),
  );
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
  const insights = [
    buildOpportunityInsight(opportunityViews.overall),
    buildCountryContrastInsight(countryPulse),
    buildConstructContrastInsight(constructs),
    buildMostMixedConstructInsight(constructs),
  ]
    .filter((insight): insight is NonNullable<typeof insight> => insight != null)
    .slice(0, 3);

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
    opportunity: {
      defaultDfcKey: "overall",
      dfcOptions: Object.values(opportunityViews).map((view) => ({
        key: view.key,
        label: view.label,
        applicableN: view.applicableN,
        detailAvailable: view.detailAvailable,
        helperText: view.helperText,
      })),
      viewsByDfcKey: opportunityViews,
    },
    constructs,
    insights,
    countryPulse,
  };
}
