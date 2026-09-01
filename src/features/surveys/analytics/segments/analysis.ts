import { computeLinearQuantile } from "@/features/surveys/analytics/descriptive-stats";
import { pairwiseNumericPairs, spearmanCorrelation } from "@/features/surveys/analytics/instrument-health-stats";
import { getOverviewBandFromScore } from "@/features/surveys/analytics/overview-semantics";
import {
  applySurveyAnalyticsFilters,
  getSurveyAnalyticsFieldValue,
  type SurveyAnalyticsFieldDefinition,
  type SurveyAnalyticsRecord,
  type SurveyAnalyticsSchema,
} from "@/features/surveys/survey-analytics";
import { computeCliffsDelta } from "./cliffs-delta";
import { compileSegmentDefinition } from "./compiler";
import {
  getAssetValueLabel,
  getBandLabel,
  getChoiceValueLabel,
  getConceptLabel,
  getDimensionLabel,
  getEvidenceLabel,
  getFacetLabel,
  getFieldLabel,
  getScoreDirectionNote,
  type SegmentLabelContext,
} from "./labels";
import { applyExclusiveCellDisclosure, discloseExclusiveCounts, isSmallIdentifiableCount, SEGMENT_CELL_MIN_N } from "./disclosure";
import { isWholeSampleDefinition } from "./normalize";
import { isUsableWeatherQuality } from "./presentation";
import { describeReadableConditions, segmentLabelContext } from "./readable-conditions";
import {
  hasSemanticComparisonN,
  hasSemanticInternalN,
  SEMANTIC_INSUFFICIENT_EVIDENCE,
} from "./semantic";
import type {
  SegmentAnalysisProfileAxis,
  SegmentAnalysisResult,
  SegmentAssociation,
  SegmentAssetPenetration,
  SegmentBandKey,
  SegmentCategoryDifferentiator,
  SegmentConditionalModule,
  SegmentConditionalSummary,
  SegmentDefinition,
  SegmentFacetSignal,
  SegmentGeographyRow,
  SegmentInternalVariation,
  SegmentScoreDifferentiator,
  SegmentScoreSnapshot,
  SegmentSemanticInsight,
  SegmentSupportingFactorAxis,
  SegmentWeatherSeries,
} from "./types";
import { SEGMENT_ASSOCIATION_MAX_PAIRS, SEGMENT_ASSOCIATION_MIN_N, SEGMENT_FACET_CONTRAST_GAP } from "./types";

const EXCLUDED_CATEGORY_FIELDS = new Set([
  "response.audience_token",
  "context.climate.quality_flag",
  "context.location.best_granularity",
]);

function numericValues(rows: SurveyAnalyticsRecord[], conceptKey: string) {
  return rows
    .map((row) => {
      const value = row.mapper_output.profile[conceptKey]?.value;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    })
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right);
}

function scoreSnapshot(
  values: number[],
  conceptKey: string,
  context: SegmentLabelContext,
): SegmentScoreSnapshot | null {
  if (values.length === 0) {
    return null;
  }

  const bandCounts = { high: 0, medium: 0, low: 0 } satisfies Record<SegmentBandKey, number>;
  for (const value of values) {
    bandCounts[getOverviewBandFromScore(value)] += 1;
  }

  return {
    median: computeLinearQuantile(values, 0.5) ?? 0,
    q1: computeLinearQuantile(values, 0.25) ?? 0,
    q3: computeLinearQuantile(values, 0.75) ?? 0,
    applicableN: values.length,
    bands: (["high", "medium", "low"] as const).map((band) => ({
      key: band,
      label: getBandLabel(conceptKey, band, context),
      count: bandCounts[band],
      share: bandCounts[band] / values.length,
    })),
  };
}

function definingFieldKeys(definition: SegmentDefinition) {
  return new Set(definition.conditions.map((condition) => condition.field));
}

function isDefiningConcept(definition: SegmentDefinition, conceptKey: string, fieldKey: string) {
  return definition.conditions.some(
    (condition) =>
      condition.field === fieldKey || condition.field.startsWith(`profile.${conceptKey}.`),
  );
}

function primaryAxisFields(schema: SurveyAnalyticsSchema) {
  return schema.fields.filter(
    (field) =>
      field.concept_role === "primary_profile_axis" &&
      field.value_type === "number" &&
      !field.facet &&
      field.key.endsWith(".value") &&
      field.concept_key,
  );
}

function buildProfileAxis(
  field: SurveyAnalyticsFieldDefinition,
  selected: SurveyAnalyticsRecord[],
  analysed: SurveyAnalyticsRecord[],
  definition: SegmentDefinition,
  context: SegmentLabelContext,
): SegmentAnalysisProfileAxis | null {
  const conceptKey = field.concept_key as string;
  const selectedValues = numericValues(selected, conceptKey);
  const snapshot = scoreSnapshot(selectedValues, conceptKey, context);
  if (!snapshot) {
    return null;
  }

  const wholeSurvey = numericValues(analysed, conceptKey);

  return {
    conceptKey,
    field: field.key,
    label: getConceptLabel(conceptKey, context),
    directionNote: getScoreDirectionNote(conceptKey, context),
    defining: isDefiningConcept(definition, conceptKey, field.key),
    applicableN: snapshot.applicableN,
    median: snapshot.median,
    q1: snapshot.q1,
    q3: snapshot.q3,
    bands: snapshot.bands,
    wholeSurveyMedian: computeLinearQuantile(wholeSurvey, 0.5),
  };
}

function compareScoreDifferentiators(
  left: SegmentScoreDifferentiator,
  right: SegmentScoreDifferentiator,
) {
  const leftMagnitude = Math.abs(left.cliffsDelta ?? left.medianDelta);
  const rightMagnitude = Math.abs(right.cliffsDelta ?? right.medianDelta);
  if (rightMagnitude !== leftMagnitude) {
    return rightMagnitude - leftMagnitude;
  }
  if (Math.abs(right.medianDelta) !== Math.abs(left.medianDelta)) {
    return Math.abs(right.medianDelta) - Math.abs(left.medianDelta);
  }
  return left.conceptKey.localeCompare(right.conceptKey);
}

function buildScoreDifferentiators(
  fields: SurveyAnalyticsFieldDefinition[],
  selected: SurveyAnalyticsRecord[],
  outside: SurveyAnalyticsRecord[],
  definition: SegmentDefinition,
  context: SegmentLabelContext,
): SegmentScoreDifferentiator[] {
  return fields
    .filter((field) => field.concept_key && !isDefiningConcept(definition, field.concept_key, field.key))
    .flatMap((field) => {
      const conceptKey = field.concept_key as string;
      const segment = scoreSnapshot(numericValues(selected, conceptKey), conceptKey, context);
      const other = scoreSnapshot(numericValues(outside, conceptKey), conceptKey, context);
      if (!segment || !other) {
        return [];
      }

      return [
        {
          kind: "score" as const,
          conceptKey,
          field: field.key,
          label: getConceptLabel(conceptKey, context),
          directionNote: getScoreDirectionNote(conceptKey, context),
          segment,
          outside: other,
          medianDelta: segment.median - other.median,
          cliffsDelta: computeCliffsDelta(
            numericValues(selected, conceptKey),
            numericValues(outside, conceptKey),
          ),
        },
      ];
    })
    .sort(compareScoreDifferentiators);
}

function categoryValueLabel(field: SurveyAnalyticsFieldDefinition, value: string) {
  if (field.concept_key === "owned_der_assets" || field.key.includes("owned_der_assets")) {
    return getAssetValueLabel(value);
  }
  return getChoiceValueLabel(value);
}

function collectCategoryValues(
  rows: SurveyAnalyticsRecord[],
  field: SurveyAnalyticsFieldDefinition,
) {
  const counts = new Map<string, number>();
  let applicableN = 0;

  for (const row of rows) {
    const raw = getSurveyAnalyticsFieldValue(row, field.key);
    if (raw == null) {
      continue;
    }
    applicableN += 1;
    const values = Array.isArray(raw) ? raw.map((value) => String(value)) : [String(raw)];
    for (const value of values) {
      if (!value) {
        continue;
      }
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return { counts, applicableN };
}

function isLocationField(field: SurveyAnalyticsFieldDefinition) {
  if (field.source === "geo" || field.key.startsWith("geo.")) {
    return true;
  }
  if (field.key.startsWith("context.location.") || field.key.includes("postal")) {
    return true;
  }
  return field.key === "context.country_code";
}

function buildCategoryDifferentiators(
  schema: SurveyAnalyticsSchema,
  selected: SurveyAnalyticsRecord[],
  outside: SurveyAnalyticsRecord[],
  definition: SegmentDefinition,
  context: SegmentLabelContext,
): SegmentCategoryDifferentiator[] {
  const defining = definingFieldKeys(definition);
  const fields = schema.fields.filter((field) => {
    if (EXCLUDED_CATEGORY_FIELDS.has(field.key) || defining.has(field.key) || field.facet || isLocationField(field)) {
      return false;
    }
    if (field.source === "profile") {
      return false;
    }
    return field.value_type === "string" || field.value_type === "string[]";
  });

  return fields
    .flatMap((field) => {
      const segment = collectCategoryValues(selected, field);
      const other = collectCategoryValues(outside, field);
      if (segment.applicableN === 0 && other.applicableN === 0) {
        return [];
      }

      const values = new Set([...segment.counts.keys(), ...other.counts.keys()]);
      const raw = Array.from(values).map((value) => ({
        value,
        segmentCount: segment.counts.get(value) ?? 0,
        outsideCount: other.counts.get(value) ?? 0,
      }));
      const suppressedSegment = discloseExclusiveCounts(
        raw.map((item) => ({ key: item.value, count: item.segmentCount })),
        selected.length,
      );
      const suppressedOutside = discloseExclusiveCounts(
        raw.map((item) => ({ key: item.value, count: item.outsideCount })),
        outside.length,
      );
      return raw.map((item) => {
        const hideSegment = suppressedSegment.has(item.value);
        const hideOutside = suppressedOutside.has(item.value);
        const segmentShare = segment.applicableN === 0 ? 0 : item.segmentCount / segment.applicableN;
        const outsideShare = other.applicableN === 0 ? 0 : item.outsideCount / other.applicableN;
        const suppressed = hideSegment || hideOutside;
        return {
          kind: "categorical" as const,
          field: field.key,
          label: getFieldLabel(field.key, context),
          value: item.value,
          valueLabel: categoryValueLabel(field, item.value),
          segmentShare: hideSegment ? null : segmentShare,
          outsideShare: hideOutside ? null : outsideShare,
          segmentCount: hideSegment ? null : item.segmentCount,
          outsideCount: hideOutside ? null : item.outsideCount,
          segmentN: segment.applicableN,
          outsideN: other.applicableN,
          deltaPercentagePoints: suppressed ? null : (segmentShare - outsideShare) * 100,
          disclosure: suppressed ? ("suppressed" as const) : ("visible" as const),
          comparisonAvailable: true,
        };
      });
    })
    .sort((left, right) => {
      const leftDelta = left.deltaPercentagePoints == null ? -1 : Math.abs(left.deltaPercentagePoints);
      const rightDelta = right.deltaPercentagePoints == null ? -1 : Math.abs(right.deltaPercentagePoints);
      if (rightDelta !== leftDelta) {
        return rightDelta - leftDelta;
      }
      return `${left.field}:${left.value}`.localeCompare(`${right.field}:${right.value}`);
    })
    .slice(0, 8);
}

function numericFieldValues(rows: SurveyAnalyticsRecord[], fieldKey: string) {
  return rows
    .map((row) => getSurveyAnalyticsFieldValue(row, fieldKey))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
}

function comparisonSnapshot(
  selected: number[],
  outside: number[],
  conceptKey: string,
  context: SegmentLabelContext,
  compare: boolean,
) {
  const segment = scoreSnapshot(selected, conceptKey, context);
  const other = compare ? scoreSnapshot(outside, conceptKey, context) : null;
  return {
    segment,
    outside: other,
    medianDelta: segment && other ? segment.median - other.median : null,
    cliffsDelta: compare ? computeCliffsDelta(selected, outside) : null,
  };
}

function facetFields(schema: SurveyAnalyticsSchema) {
  return schema.fields.filter(
    (field) =>
      field.concept_role === "primary_profile_axis" &&
      field.value_type === "number" &&
      Boolean(field.facet) &&
      field.key.endsWith(".value") &&
      field.measurement_role !== "conditional_module" &&
      field.concept_key,
  );
}

function buildFacetSignal(
  field: SurveyAnalyticsFieldDefinition,
  selected: SurveyAnalyticsRecord[],
  analysed: SurveyAnalyticsRecord[],
  outside: SurveyAnalyticsRecord[],
  definition: SegmentDefinition,
  context: SegmentLabelContext,
  compare: boolean,
): SegmentFacetSignal | null {
  const conceptKey = field.concept_key as string;
  const facet = field.facet as string;
  const selectedValues = numericFieldValues(selected, field.key);
  const snapshot = scoreSnapshot(selectedValues, conceptKey, context);
  if (!snapshot) {
    return null;
  }

  const compared = comparisonSnapshot(
    selectedValues,
    numericFieldValues(outside, field.key),
    conceptKey,
    context,
    compare,
  );
  const evidenceLevel = field.evidence_level === "facet_subscore" ? "facet_subscore" : "interpretive_signal";

  return {
    conceptKey,
    conceptLabel: getConceptLabel(conceptKey, context),
    facet,
    field: field.key,
    label: getFacetLabel(conceptKey, facet, context),
    evidenceLevel,
    evidenceLabel: getEvidenceLabel(evidenceLevel),
    definingParent: isDefiningConcept(definition, conceptKey, field.key),
    applicableN: snapshot.applicableN,
    median: snapshot.median,
    q1: snapshot.q1,
    q3: snapshot.q3,
    bands: snapshot.bands,
    wholeSurveyMedian: computeLinearQuantile(numericFieldValues(analysed, field.key), 0.5),
    outside: compared.outside,
    medianDelta: compared.medianDelta,
    cliffsDelta: compared.cliffsDelta,
  };
}

function modulatorFields(schema: SurveyAnalyticsSchema) {
  return schema.fields.filter(
    (field) =>
      field.concept_role === "behavioural_modulator" &&
      field.value_type === "number" &&
      !field.facet &&
      field.key.endsWith(".value") &&
      field.concept_key,
  );
}

function buildSupportingFactors(
  schema: SurveyAnalyticsSchema,
  selected: SurveyAnalyticsRecord[],
  analysed: SurveyAnalyticsRecord[],
  outside: SurveyAnalyticsRecord[],
  definition: SegmentDefinition,
  context: SegmentLabelContext,
  compare: boolean,
): SegmentSupportingFactorAxis[] {
  return modulatorFields(schema)
    .flatMap((field) => {
      const conceptKey = field.concept_key as string;
      const selectedValues = numericValues(selected, conceptKey);
      const snapshot = scoreSnapshot(selectedValues, conceptKey, context);
      if (!snapshot) {
        return [];
      }

      const compared = comparisonSnapshot(
        selectedValues,
        numericValues(outside, conceptKey),
        conceptKey,
        context,
        compare,
      );

      return [
        {
          conceptKey,
          dimension: field.dimension ?? conceptKey,
          dimensionLabel: getDimensionLabel(field.dimension ?? conceptKey, context),
          field: field.key,
          label: getConceptLabel(conceptKey, context),
          directionNote: getScoreDirectionNote(conceptKey, context),
          defining: isDefiningConcept(definition, conceptKey, field.key),
          applicableN: snapshot.applicableN,
          median: snapshot.median,
          q1: snapshot.q1,
          q3: snapshot.q3,
          bands: snapshot.bands,
          wholeSurveyMedian: computeLinearQuantile(numericValues(analysed, conceptKey), 0.5),
          outside: compared.outside,
          medianDelta: compared.medianDelta,
          cliffsDelta: compared.cliffsDelta,
        },
      ];
    })
    .sort((left, right) => {
      const magnitude = Math.abs(right.cliffsDelta ?? right.medianDelta ?? 0) - Math.abs(left.cliffsDelta ?? left.medianDelta ?? 0);
      if (magnitude !== 0) {
        return magnitude;
      }
      return left.conceptKey.localeCompare(right.conceptKey);
    });
}

function conditionalModuleFields(schema: SurveyAnalyticsSchema) {
  return schema.fields.filter(
    (field) =>
      field.measurement_role === "conditional_module" &&
      field.value_type === "number" &&
      Boolean(field.facet) &&
      field.key.endsWith(".value") &&
      field.concept_key,
  );
}

function buildConditionalModule(
  field: SurveyAnalyticsFieldDefinition,
  selected: SurveyAnalyticsRecord[],
  outside: SurveyAnalyticsRecord[],
  context: SegmentLabelContext,
  compare: boolean,
): SegmentConditionalModule {
  const conceptKey = field.concept_key as string;
  const setKey = field.facet as string;
  const selectedValues = numericFieldValues(selected, field.key);
  const snapshot = scoreSnapshot(selectedValues, conceptKey, context);
  const outsideValues = numericFieldValues(outside, field.key);
  const outsideSnapshot = compare ? scoreSnapshot(outsideValues, conceptKey, context) : null;

  return {
    conceptKey,
    setKey,
    field: field.key,
    label: getFacetLabel(conceptKey, setKey, context),
    applicableN: selectedValues.length,
    notApplicableN: Math.max(selected.length - selectedValues.length, 0),
    applicabilityRate: selected.length === 0 ? null : selectedValues.length / selected.length,
    missingWithinApplicable: 0,
    median: snapshot?.median ?? null,
    q1: snapshot?.q1 ?? null,
    q3: snapshot?.q3 ?? null,
    bands: snapshot?.bands ?? [],
    outside: compare
      ? {
          applicableN: outsideValues.length,
          median: outsideSnapshot?.median ?? null,
          q1: outsideSnapshot?.q1 ?? null,
          q3: outsideSnapshot?.q3 ?? null,
        }
      : null,
  };
}

function buildConditionalSummary(
  schema: SurveyAnalyticsSchema,
  selected: SurveyAnalyticsRecord[],
  outside: SurveyAnalyticsRecord[],
  context: SegmentLabelContext,
  compare: boolean,
): SegmentConditionalSummary | null {
  const fields = conditionalModuleFields(schema);
  if (fields.length === 0) {
    return null;
  }

  const conceptKey = fields[0]?.concept_key as string;
  const overallField = schema.fields.find(
    (field) => field.concept_key === conceptKey && !field.facet && field.key.endsWith(".value"),
  );
  const overallValues = overallField ? numericFieldValues(selected, overallField.key) : [];
  const counts = new Map<number, number>();
  for (const row of selected) {
    const applicable = fields.filter((field) => {
      const value = getSurveyAnalyticsFieldValue(row, field.key);
      return typeof value === "number" && Number.isFinite(value);
    }).length;
    counts.set(applicable, (counts.get(applicable) ?? 0) + 1);
  }

  return {
    conceptKey,
    label: getConceptLabel(conceptKey, context),
    overall: scoreSnapshot(overallValues, conceptKey, context),
    modules: fields.map((field) => buildConditionalModule(field, selected, outside, context, compare)),
    applicableModuleCounts: Array.from(counts.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([count, households]) => ({
        count,
        households,
        share: selected.length === 0 ? 0 : households / selected.length,
      })),
  };
}

function assetField(schema: SurveyAnalyticsSchema) {
  return schema.fields.find(
    (field) => field.concept_role === "applicability_factor" && field.value_type === "string[]",
  );
}

function buildAssetPenetration(
  schema: SurveyAnalyticsSchema,
  selected: SurveyAnalyticsRecord[],
  outside: SurveyAnalyticsRecord[],
  compare: boolean,
): SegmentAssetPenetration[] {
  const field = assetField(schema);
  if (!field) {
    return [];
  }

  const segment = collectCategoryValues(selected, field);
  const other = compare ? collectCategoryValues(outside, field) : { counts: new Map<string, number>(), applicableN: 0 };
  const values = new Set([...segment.counts.keys(), ...other.counts.keys()]);

  return Array.from(values)
    .map((value) => {
      const segmentCount = segment.counts.get(value) ?? 0;
      const outsideCount = other.counts.get(value) ?? 0;
      const hideSegment = isSmallIdentifiableCount(segmentCount) || isSmallIdentifiableCount(selected.length);
      const hideOutside = !compare || isSmallIdentifiableCount(outsideCount);
      const suppressed = hideSegment || (compare && hideOutside);
      const segmentShare = segment.applicableN === 0 ? 0 : segmentCount / segment.applicableN;
      const outsideShare = other.applicableN === 0 ? 0 : outsideCount / other.applicableN;
      return {
        field: field.key,
        value,
        label: getAssetValueLabel(value),
        segmentCount: hideSegment ? null : segmentCount,
        segmentN: segment.applicableN,
        segmentShare: hideSegment ? null : segmentShare,
        outsideCount: hideOutside ? null : outsideCount,
        outsideN: other.applicableN,
        outsideShare: hideOutside ? null : outsideShare,
        deltaPercentagePoints: compare && !suppressed ? (segmentShare - outsideShare) * 100 : null,
        disclosure: suppressed ? ("suppressed" as const) : ("visible" as const),
        comparisonAvailable: compare,
      };
    })
    .sort((left, right) => {
      const leftShare = left.segmentShare ?? 0;
      const rightShare = right.segmentShare ?? 0;
      const leftDelta = Math.abs(left.deltaPercentagePoints ?? 0);
      const rightDelta = Math.abs(right.deltaPercentagePoints ?? 0);
      if (rightDelta !== leftDelta) {
        return rightDelta - leftDelta;
      }
      return rightShare - leftShare || left.value.localeCompare(right.value);
    });
}

function bandEntropy(bands: SegmentScoreSnapshot["bands"]) {
  const shares = bands.map((band) => band.share).filter((share) => share > 0);
  if (shares.length === 0) {
    return 0;
  }
  const raw = -shares.reduce((sum, share) => sum + share * Math.log(share), 0);
  return raw / Math.log(3);
}

function buildInternalVariation(
  axes: SegmentAnalysisProfileAxis[],
  supporting: SegmentSupportingFactorAxis[],
): SegmentInternalVariation[] {
  return [...axes, ...supporting]
    .filter((item) => !item.defining && item.applicableN > 0)
    .map((item) => {
      const iqr = item.q3 - item.q1;
      const dominant = item.bands.slice().sort((left, right) => right.count - left.count)[0];
      return {
        field: item.field,
        conceptKey: item.conceptKey,
        label: item.label,
        applicableN: item.applicableN,
        iqr,
        normalisedIqr: iqr / 4,
        bandEntropy: bandEntropy(item.bands),
        dominantBand: dominant?.key ?? "medium",
        bands: item.bands,
      };
    });
}

function geographyFields(schema: SurveyAnalyticsSchema) {
  const field = schema.fields.find((candidate) => candidate.key === "context.country_code");
  return field ? [field] : [];
}

function buildGeography(
  schema: SurveyAnalyticsSchema,
  selected: SurveyAnalyticsRecord[],
  analysed: SurveyAnalyticsRecord[],
  context: SegmentLabelContext,
): SegmentGeographyRow[] {
  return geographyFields(schema).flatMap((field) => {
    const analysedValues = collectCategoryValues(analysed, field);
    const selectedValues = collectCategoryValues(selected, field);
    const eligible = Array.from(analysedValues.counts.entries()).filter(
      ([, analysedCount]) => analysedCount >= SEGMENT_CELL_MIN_N,
    );
    if (eligible.length === 0) {
      return [];
    }
    const suppressedSegment = discloseExclusiveCounts(
      eligible.map(([value]) => ({
        key: value,
        count: selectedValues.counts.get(value) ?? 0,
      })),
      selected.length,
    );
    const suppressedOutside = applyExclusiveCellDisclosure(
      eligible.map(([value, analysedCount]) => ({
        key: value,
        count: analysedCount - (selectedValues.counts.get(value) ?? 0),
      })),
    );

    return eligible
      .map(([value, analysedCount]) => {
        const segmentCount = selectedValues.counts.get(value) ?? 0;
        const hide = suppressedSegment.has(value) || suppressedOutside.has(value);
        return {
          field: field.key,
          value,
          label: `${getFieldLabel(field.key, context)}: ${getChoiceValueLabel(value)}`,
          segmentCount: hide ? null : segmentCount,
          analysedCount,
          selectedN: selected.length,
          penetration: hide || analysedCount === 0 ? null : segmentCount / analysedCount,
          composition: hide || selected.length === 0 ? null : segmentCount / selected.length,
          disclosure: hide ? ("suppressed" as const) : ("visible" as const),
        };
      })
      .sort(
        (left, right) =>
          (right.penetration ?? -1) - (left.penetration ?? -1) || left.value.localeCompare(right.value),
      );
  });
}

function weatherValues(rows: SurveyAnalyticsRecord[], fieldKey: string) {
  return rows
    .filter((row) => isUsableWeatherQuality(row.mapper_output.context_metadata.climate?.quality_flag))
    .map((row) => getSurveyAnalyticsFieldValue(row, fieldKey))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
}

function buildWeather(
  schema: SurveyAnalyticsSchema,
  selected: SurveyAnalyticsRecord[],
  outside: SurveyAnalyticsRecord[],
  compare: boolean,
): SegmentWeatherSeries[] {
  const series = [
    { key: "context.climate.temp_outdoor_c", label: "Outdoor temperature", unit: "°C" },
    { key: "context.climate.humidity_pct", label: "Outdoor humidity", unit: "%" },
  ].filter((item) => schema.fields.some((field) => field.key === item.key));

  return series.flatMap((item) => {
    const values = weatherValues(selected, item.key);
    if (values.length === 0) {
      return [];
    }
    const outsideValues = compare ? weatherValues(outside, item.key) : [];
    return [
      {
        field: item.key,
        label: item.label,
        unit: item.unit,
        n: values.length,
        median: computeLinearQuantile(values, 0.5) ?? values[0],
        q1: computeLinearQuantile(values, 0.25) ?? values[0],
        q3: computeLinearQuantile(values, 0.75) ?? values[0],
        min: values[0],
        max: values[values.length - 1],
        outsideMedian: outsideValues.length ? computeLinearQuantile(outsideValues, 0.5) : null,
      },
    ];
  });
}

function scoredAssociationFields(schema: SurveyAnalyticsSchema) {
  return schema.fields.filter(
    (field) =>
      (field.concept_role === "primary_profile_axis" || field.concept_role === "behavioural_modulator") &&
      field.value_type === "number" &&
      !field.facet &&
      field.key.endsWith(".value") &&
      field.concept_key,
  );
}

function buildAssociations(
  schema: SurveyAnalyticsSchema,
  selected: SurveyAnalyticsRecord[],
  context: SegmentLabelContext,
): SegmentAssociation[] {
  const fields = scoredAssociationFields(schema);
  const pairs: SegmentAssociation[] = [];

  for (let leftIndex = 0; leftIndex < fields.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < fields.length; rightIndex += 1) {
      const left = fields[leftIndex];
      const right = fields[rightIndex];
      const leftSeries = selected.map((row) => {
        const value = getSurveyAnalyticsFieldValue(row, left.key);
        return typeof value === "number" && Number.isFinite(value) ? value : null;
      });
      const rightSeries = selected.map((row) => {
        const value = getSurveyAnalyticsFieldValue(row, right.key);
        return typeof value === "number" && Number.isFinite(value) ? value : null;
      });
      const paired = pairwiseNumericPairs(leftSeries, rightSeries);
      if (paired.left.length < SEGMENT_ASSOCIATION_MIN_N) {
        continue;
      }
      const rho = spearmanCorrelation(paired.left, paired.right);
      if (rho == null) {
        continue;
      }
      pairs.push({
        leftConceptKey: left.concept_key as string,
        leftLabel: getConceptLabel(left.concept_key as string, context),
        rightConceptKey: right.concept_key as string,
        rightLabel: getConceptLabel(right.concept_key as string, context),
        rho,
        pairedN: paired.left.length,
      });
    }
  }

  return pairs
    .sort((left, right) => Math.abs(right.rho) - Math.abs(left.rho) || left.leftConceptKey.localeCompare(right.leftConceptKey))
    .slice(0, SEGMENT_ASSOCIATION_MAX_PAIRS);
}

const INDEPENDENT_CHECK =
  "A predefined comparison, another sample, or independent evidence would be needed before treating this as a stable contrast.";

function facetContrastInsight(facets: SegmentFacetSignal[]): SegmentSemanticInsight | null {
  const byConstruct = new Map<string, SegmentFacetSignal[]>();
  for (const facet of facets) {
    if (facet.definingParent || facet.outside == null || facet.cliffsDelta == null) {
      continue;
    }
    const current = byConstruct.get(facet.conceptKey) ?? [];
    current.push(facet);
    byConstruct.set(facet.conceptKey, current);
  }

  let best:
    | {
        facet: SegmentFacetSignal;
        comparable: boolean;
        gap: number;
      }
    | null = null;

  for (const group of byConstruct.values()) {
    const ranked = group.slice().sort((left, right) => Math.abs(right.cliffsDelta ?? 0) - Math.abs(left.cliffsDelta ?? 0));
    const top = ranked[0];
    if (!top || top.cliffsDelta == null) {
      continue;
    }
    const runnerUp = ranked[1];
    const gap = runnerUp?.cliffsDelta == null ? 0 : Math.abs(top.cliffsDelta) - Math.abs(runnerUp.cliffsDelta);
    const comparable = ranked.length >= 2;
    const candidate = {
      facet: top,
      comparable,
      gap,
    };
    if (!best || Math.abs(top.cliffsDelta) > Math.abs(best.facet.cliffsDelta ?? 0)) {
      best = candidate;
    }
  }

  if (!best) {
    return null;
  }

  const selectedN = best.facet.applicableN;
  const outsideN = best.facet.outside?.applicableN ?? 0;
  if (!hasSemanticComparisonN(selectedN, outsideN)) {
    return null;
  }

  const { facet, comparable, gap } = best;
  const contrasted = comparable && gap >= SEGMENT_FACET_CONTRAST_GAP;
  const observed = contrasted
    ? `${facet.conceptLabel} · ${facet.label} shows a larger difference than the other measured facets of this construct (Δ median ${facet.medianDelta?.toFixed(2)}, δ=${facet.cliffsDelta?.toFixed(2)}, n=${facet.applicableN}/${facet.outside?.applicableN ?? 0}).`
    : `${facet.conceptLabel} · ${facet.label} shows the largest observed difference in the current comparison (Δ median ${facet.medianDelta?.toFixed(2)}, δ=${facet.cliffsDelta?.toFixed(2)}, n=${facet.applicableN}/${facet.outside?.applicableN ?? 0}).`;

  return {
    kind: "facet_contrast",
    observedPattern: observed,
    potentialReading: `The same overall score may be expressed differently through ${facet.label.toLowerCase()}. This remains a ${facet.evidenceLabel.toLowerCase()}.`,
    worthExamining: INDEPENDENT_CHECK,
    conceptKeys: [facet.conceptKey],
    evidence: {
      selectedN: facet.applicableN,
      outsideN: facet.outside?.applicableN ?? null,
      selectedValue: facet.median,
      outsideValue: facet.outside?.median ?? null,
      delta: facet.medianDelta,
      cliffsDelta: facet.cliffsDelta,
    },
  };
}

function buildInsights(input: {
  differentiatorsAvailable: boolean;
  scores: SegmentScoreDifferentiator[];
  facets: SegmentFacetSignal[];
  variation: SegmentInternalVariation[];
  assets: SegmentAssetPenetration[];
}): SegmentSemanticInsight[] {
  const insights: SegmentSemanticInsight[] = [];
  const topScore = input.differentiatorsAvailable
    ? input.scores.find((item) => item.cliffsDelta != null && Math.abs(item.cliffsDelta) >= 0.15)
    : null;
  if (topScore && hasSemanticComparisonN(topScore.segment.applicableN, topScore.outside.applicableN)) {
    const stats = `(Δ median ${topScore.medianDelta.toFixed(2)}, δ=${topScore.cliffsDelta?.toFixed(2)}, n=${topScore.segment.applicableN}/${topScore.outside.applicableN})`;
    const observedPattern =
      topScore.medianDelta === 0
        ? `${topScore.label} distributions differ from outside this segment although the medians are the same ${stats}.`
        : `${topScore.label} is ${(topScore.medianDelta ?? 0) >= 0 ? "higher" : "lower"} in this segment than outside it ${stats}.`;
    insights.push({
      kind: "score_difference",
      observedPattern,
      potentialReading: `${topScore.label} is associated with this segment, but the difference is descriptive and may reflect other shared conditions.`,
      worthExamining: INDEPENDENT_CHECK,
      conceptKeys: [topScore.conceptKey],
      evidence: {
        selectedN: topScore.segment.applicableN,
        outsideN: topScore.outside.applicableN,
        selectedValue: topScore.segment.median,
        outsideValue: topScore.outside.median,
        delta: topScore.medianDelta,
        cliffsDelta: topScore.cliffsDelta,
      },
    });
  }

  const facetInsight = input.differentiatorsAvailable ? facetContrastInsight(input.facets) : null;
  if (facetInsight && insights.length < 3) {
    insights.push(facetInsight);
  }

  const varied = input.variation.slice().sort((left, right) => right.normalisedIqr - left.normalisedIqr)[0];
  if (varied && hasSemanticInternalN(varied.applicableN) && insights.length < 3) {
    insights.push({
      kind: "internal_variation",
      observedPattern: `${varied.label} remains mixed inside the segment (normalised IQR ${varied.normalisedIqr.toFixed(2)}, band entropy ${varied.bandEntropy.toFixed(2)}, n=${varied.applicableN}).`,
      potentialReading: `Respondents who share the selected filters still differ on ${varied.label.toLowerCase()}.`,
      worthExamining: "This describes remaining mix inside the current definition; it is not a discovered cluster.",
      conceptKeys: [varied.conceptKey],
      evidence: {
        selectedN: varied.applicableN,
        outsideN: null,
        selectedValue: varied.iqr,
        outsideValue: null,
        delta: null,
        cliffsDelta: null,
      },
    });
  }

  const asset = input.differentiatorsAvailable
    ? input.assets.find(
        (item) =>
          item.comparisonAvailable &&
          item.disclosure === "visible" &&
          item.deltaPercentagePoints != null &&
          Math.abs(item.deltaPercentagePoints) >= 15,
      )
    : null;
  if (
    asset &&
    insights.length < 3 &&
    hasSemanticComparisonN(asset.segmentN, asset.outsideN)
  ) {
    insights.push({
      kind: "asset_difference",
      observedPattern: `${asset.label} appears in ${Math.round((asset.segmentShare ?? 0) * 100)}% of the segment versus ${Math.round((asset.outsideShare ?? 0) * 100)}% outside it (n=${asset.segmentN}/${asset.outsideN}).`,
      potentialReading: "Declared ownership differs, but ownership is not the same as declared capability.",
      worthExamining: INDEPENDENT_CHECK,
      conceptKeys: [],
      evidence: {
        selectedN: asset.segmentN,
        outsideN: asset.outsideN,
        selectedValue: asset.segmentShare,
        outsideValue: asset.outsideShare,
        delta: asset.deltaPercentagePoints,
        cliffsDelta: null,
      },
    });
  }

  if (insights.length === 0) {
    insights.push({
      kind: "none",
      observedPattern: SEMANTIC_INSUFFICIENT_EVIDENCE,
      potentialReading: "",
      worthExamining: "",
      conceptKeys: [],
      evidence: null,
    });
  }

  return insights.slice(0, 3);
}

export function buildSegmentAnalysis(input: {
  schema: SurveyAnalyticsSchema;
  rows: SurveyAnalyticsRecord[];
  definition: SegmentDefinition;
  generatedAt?: string;
}): SegmentAnalysisResult {
  const context = segmentLabelContext(input.schema);
  const selected = applySurveyAnalyticsFilters({
    schema: input.schema,
    rows: input.rows,
    filters: compileSegmentDefinition(input.definition),
  });
  const selectedIds = new Set(selected.map((row) => row.response_id));
  const outside = input.rows.filter((row) => !selectedIds.has(row.response_id));
  const axisFields = primaryAxisFields(input.schema);
  const profileAxes = axisFields
    .map((field) => buildProfileAxis(field, selected, input.rows, input.definition, context))
    .filter((axis): axis is SegmentAnalysisProfileAxis => axis != null);

  const wholeSample = isWholeSampleDefinition(input.definition);
  const differentiatorReason = wholeSample
    ? "whole_sample"
    : selected.length === 0
      ? "empty_segment"
      : outside.length === 0
        ? "empty_outside"
        : null;
  const compare = differentiatorReason == null;
  const facets = facetFields(input.schema)
    .map((field) =>
      buildFacetSignal(field, selected, input.rows, outside, input.definition, context, compare),
    )
    .filter((facet): facet is SegmentFacetSignal => facet != null);
  const supportingFactors = buildSupportingFactors(
    input.schema,
    selected,
    input.rows,
    outside,
    input.definition,
    context,
    compare,
  );
  const scores =
    differentiatorReason == null
      ? buildScoreDifferentiators(axisFields, selected, outside, input.definition, context)
      : [];
  const assets = buildAssetPenetration(input.schema, selected, outside, compare);
  const internalVariation = buildInternalVariation(profileAxes, supportingFactors);

  return {
    definition: input.definition,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sample: {
      selectedN: selected.length,
      outsideN: outside.length,
      analysedN: input.rows.length,
      share: input.rows.length === 0 ? null : selected.length / input.rows.length,
      referenceType: differentiatorReason == null ? "outside" : "none",
      comparisonAvailable: differentiatorReason == null,
    },
    readableConditions: describeReadableConditions(input.definition, input.schema),
    profileAxes,
    differentiators: {
      available: differentiatorReason == null,
      reason: differentiatorReason,
      scores,
      categories:
        differentiatorReason == null
          ? buildCategoryDifferentiators(input.schema, selected, outside, input.definition, context)
          : [],
    },
    facets,
    supportingFactors,
    conditionalModules: buildConditionalSummary(input.schema, selected, outside, context, compare),
    assets,
    internalVariation,
    geography: buildGeography(input.schema, selected, input.rows, context),
    weather: buildWeather(input.schema, selected, outside, compare),
    insights: buildInsights({
      differentiatorsAvailable: differentiatorReason == null,
      scores,
      facets,
      variation: internalVariation,
      assets,
    }),
    associations: buildAssociations(input.schema, selected, context),
  };
}

export function assertAggregateSegmentAnalysis(result: SegmentAnalysisResult) {
  const serialized = JSON.stringify(result);
  return {
    hasResponseId: serialized.includes("response_id") || serialized.includes("responseId"),
    hasAnswers: serialized.includes("answers_json"),
    hasMapperOutput: serialized.includes("mapper_output"),
  };
}
