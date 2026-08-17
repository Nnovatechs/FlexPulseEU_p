import { computeLinearQuantile } from "@/features/surveys/analytics/descriptive-stats";
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
  applyExclusiveCellDisclosure,
  discloseExclusiveCounts,
  SEGMENT_CELL_MIN_N,
} from "./disclosure";
import {
  getAssetValueLabel,
  getChoiceValueLabel,
  getConceptLabel,
  getEvidenceLabel,
  getFacetLabel,
  getFieldLabel,
  getScoreDirectionNote,
  SINGLE_ITEM_SIGNAL_LABEL,
  type SegmentLabelContext,
} from "./labels";
import { isUsableWeatherQuality } from "./presentation";
import { describeReadableConditions, segmentLabelContext } from "./readable-conditions";
import {
  hasSemanticComparisonN,
  SEGMENT_SEMANTIC_MIN_N,
  SEMANTIC_INSUFFICIENT_EVIDENCE,
} from "./semantic";
import type { SegmentDefinition } from "./types";
import type {
  ComparisonCompositionDifference,
  ComparisonDfcModule,
  ComparisonDfcSummary,
  ComparisonGeographyRow,
  ComparisonInsight,
  ComparisonOverlapRelation,
  ComparisonProfileAxis,
  ComparisonSample,
  ComparisonScoreDifference,
  ComparisonScoreKind,
  ComparisonWeatherSeries,
  SegmentComparisonResult,
} from "./comparison-types";

const EXCLUDED_CATEGORY_FIELDS = new Set([
  "response.audience_token",
  "context.climate.quality_flag",
  "context.location.best_code",
  "context.location.best_label",
  "context.location.best_granularity",
]);

function scoreInsightCopy(row: ComparisonScoreDifference, side: "A" | "B") {
  const observed = `Segment ${side} reports a higher ${row.label.toLowerCase()} than the other segment (Δ median ${row.medianDelta.toFixed(2)}, δ=${row.cliffsDelta?.toFixed(2)}, n=${row.applicableNA}/${row.applicableNB}).`;
  const direction = row.directionNote ? ` ${row.directionNote}` : "";
  if (row.kind === "primary_axis") {
    return {
      observed,
      potentialReading: `${row.label} is one of the main declared contrasts between these segments.${direction} Its facets can show where the gap concentrates.`,
      worthExamining: "Inspect the facet rows of this axis before treating the overall contrast as uniform.",
    };
  }
  if (row.kind === "facet") {
    const signal =
      row.evidenceLabel === SINGLE_ITEM_SIGNAL_LABEL || row.evidenceLevel === "interpretive_signal"
        ? ` ${SINGLE_ITEM_SIGNAL_LABEL}.`
        : row.evidenceLabel
          ? ` ${row.evidenceLabel}.`
          : "";
    return {
      observed,
      potentialReading: `The contrast concentrates on this aspect of the axis.${signal}${direction}`,
      worthExamining: "Read it as a concentrated part of the parent axis, not as a standalone cause.",
    };
  }
  if (row.kind === "capability_module") {
    return {
      observed,
      potentialReading: `${row.label} only describes households for which this module is applicable.${direction}`,
      worthExamining: "Do not generalise this module contrast to respondents outside its applicable population.",
    };
  }
  return {
    observed,
    potentialReading: `${row.label} helps characterise the groups.${direction} It is not a demonstrated causal mechanism.`,
    worthExamining: "Use it as context for the groups, not as an explanation of later behaviour.",
  };
}

function compositionInsightCopy(row: ComparisonCompositionDifference) {
  return {
    observed: `${row.valueLabel} appears in ${Math.round((row.shareA ?? 0) * 100)}% of Segment A versus ${Math.round((row.shareB ?? 0) * 100)}% of Segment B (n=${row.applicableNA}/${row.applicableNB}).`,
    potentialReading: "This is a difference in declared composition, not demonstrated behaviour or capability.",
    worthExamining: "Check whether the segment filters already make this mix expected.",
  };
}

const ASSET_COMPOSITION_GAP_PP = 15;
const SCORE_INSIGHT_MIN_CLIFFS = 0.15;
const COMPOSITION_INSIGHT_MIN_PP = 15;

function selectRows(
  schema: SurveyAnalyticsSchema,
  rows: SurveyAnalyticsRecord[],
  definition: SegmentDefinition,
) {
  return applySurveyAnalyticsFilters({
    schema,
    rows,
    filters: compileSegmentDefinition(definition),
  });
}

function overlapRelation(nA: number, nB: number, intersectionN: number): ComparisonOverlapRelation {
  if (nA === nB && intersectionN === nA) {
    return "identical";
  }
  if (intersectionN === 0) {
    return "disjoint";
  }
  if (intersectionN === nA && nA < nB) {
    return "b_contains_a";
  }
  if (intersectionN === nB && nB < nA) {
    return "a_contains_b";
  }
  return "overlap";
}

function numericFieldValues(rows: SurveyAnalyticsRecord[], fieldKey: string) {
  return rows
    .map((row) => getSurveyAnalyticsFieldValue(row, fieldKey))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
}

function numericConceptValues(rows: SurveyAnalyticsRecord[], conceptKey: string) {
  return rows
    .map((row) => {
      const value = row.mapper_output.profile[conceptKey]?.value;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    })
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right);
}

function snapshot(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return {
    median: computeLinearQuantile(values, 0.5) ?? 0,
    q1: computeLinearQuantile(values, 0.25) ?? 0,
    q3: computeLinearQuantile(values, 0.75) ?? 0,
    applicableN: values.length,
  };
}

function isDefiningField(definitions: SegmentDefinition[], fieldKey: string, conceptKey: string) {
  return definitions.some((definition) =>
    definition.conditions.some(
      (condition) =>
        condition.field === fieldKey || condition.field.startsWith(`profile.${conceptKey}.`),
    ),
  );
}

function primaryAxisFields(schema: SurveyAnalyticsSchema) {
  return schema.fields.filter(
    (field) =>
      field.concept_role === "primary_profile_axis" &&
      field.measurement_role !== "conditional_module" &&
      field.value_type === "number" &&
      !field.facet &&
      field.key.endsWith(".value") &&
      field.concept_key,
  );
}

function primaryFacetFields(schema: SurveyAnalyticsSchema) {
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

function isLocationField(field: SurveyAnalyticsFieldDefinition) {
  if (field.source === "geo" || field.key.startsWith("geo.")) {
    return true;
  }
  if (field.key.startsWith("context.location.") || field.key.includes("postal")) {
    return true;
  }
  return field.key === "context.country_code";
}

function geographyFields(schema: SurveyAnalyticsSchema) {
  const field = schema.fields.find((candidate) => candidate.key === "context.country_code");
  return field ? [field] : [];
}

function buildScoreRow(input: {
  kind: ComparisonScoreKind;
  field: SurveyAnalyticsFieldDefinition;
  rowsA: SurveyAnalyticsRecord[];
  rowsB: SurveyAnalyticsRecord[];
  definitions: SegmentDefinition[];
  context: SegmentLabelContext;
  effectSizes: boolean;
  valuesA?: number[];
  valuesB?: number[];
}): ComparisonScoreDifference | null {
  const conceptKey = input.field.concept_key as string;
  const valuesA = input.valuesA ?? numericFieldValues(input.rowsA, input.field.key);
  const valuesB = input.valuesB ?? numericFieldValues(input.rowsB, input.field.key);
  const snapA = snapshot(valuesA);
  const snapB = snapshot(valuesB);
  if (!snapA || !snapB) {
    return null;
  }

  const facet = input.field.facet ?? null;
  const evidenceLevel =
    input.field.evidence_level === "facet_subscore" || input.field.evidence_level === "interpretive_signal"
      ? input.field.evidence_level
      : null;

  return {
    kind: input.kind,
    conceptKey,
    field: input.field.key,
    label: facet
      ? `${getConceptLabel(conceptKey, input.context)} · ${getFacetLabel(conceptKey, facet, input.context)}`
      : getConceptLabel(conceptKey, input.context),
    facet,
    evidenceLevel,
    evidenceLabel: evidenceLevel ? getEvidenceLabel(evidenceLevel) : null,
    directionNote: getScoreDirectionNote(conceptKey, input.context),
    definitionDifference: isDefiningField(input.definitions, input.field.key, conceptKey),
    medianA: snapA.median,
    medianB: snapB.median,
    q1A: snapA.q1,
    q3A: snapA.q3,
    q1B: snapB.q1,
    q3B: snapB.q3,
    medianDelta: snapA.median - snapB.median,
    cliffsDelta: input.effectSizes ? computeCliffsDelta(valuesA, valuesB) : null,
    applicableNA: snapA.applicableN,
    applicableNB: snapB.applicableN,
  };
}

function compareScoreRows(left: ComparisonScoreDifference, right: ComparisonScoreDifference) {
  const leftStable = hasSemanticComparisonN(left.applicableNA, left.applicableNB);
  const rightStable = hasSemanticComparisonN(right.applicableNA, right.applicableNB);
  if (leftStable !== rightStable) {
    return leftStable ? -1 : 1;
  }
  const leftCliffs = Math.abs(left.cliffsDelta ?? 0);
  const rightCliffs = Math.abs(right.cliffsDelta ?? 0);
  if (rightCliffs !== leftCliffs) {
    return rightCliffs - leftCliffs;
  }
  const leftMedian = Math.abs(left.medianDelta);
  const rightMedian = Math.abs(right.medianDelta);
  if (rightMedian !== leftMedian) {
    return rightMedian - leftMedian;
  }
  return left.label.localeCompare(right.label);
}

function collectCategoryValues(rows: SurveyAnalyticsRecord[], field: SurveyAnalyticsFieldDefinition) {
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

function categoryValueLabel(field: SurveyAnalyticsFieldDefinition, value: string) {
  if (field.concept_key === "owned_der_assets" || field.key.includes("owned_der_assets")) {
    return getAssetValueLabel(value);
  }
  return getChoiceValueLabel(value);
}

function compositionFamily(
  field: SurveyAnalyticsFieldDefinition,
  geoKeys: Set<string>,
): ComparisonCompositionDifference["family"] {
  if (field.concept_role === "applicability_factor" || field.key.includes("owned_der_assets")) {
    return "asset";
  }
  if (geoKeys.has(field.key)) {
    return "geography";
  }
  return "category";
}

function buildCompositionRows(
  schema: SurveyAnalyticsSchema,
  rowsA: SurveyAnalyticsRecord[],
  rowsB: SurveyAnalyticsRecord[],
  definitions: SegmentDefinition[],
  context: SegmentLabelContext,
): ComparisonCompositionDifference[] {
  const geoKeys = new Set(geographyFields(schema).map((field) => field.key));
  const defining = new Set(definitions.flatMap((definition) => definition.conditions.map((condition) => condition.field)));
  const fields = schema.fields.filter((field) => {
    if (EXCLUDED_CATEGORY_FIELDS.has(field.key) || field.facet || isLocationField(field)) {
      return false;
    }
    if (field.concept_role === "applicability_factor" && field.value_type === "string[]") {
      return true;
    }
    if (geoKeys.has(field.key)) {
      return false;
    }
    if (field.source === "profile" || field.source === "geo") {
      return false;
    }
    return field.value_type === "string" || field.value_type === "string[]";
  });

  return fields
    .flatMap((field) => {
      const groupA = collectCategoryValues(rowsA, field);
      const groupB = collectCategoryValues(rowsB, field);
      if (groupA.applicableN === 0 && groupB.applicableN === 0) {
        return [];
      }
      const values = new Set([...groupA.counts.keys(), ...groupB.counts.keys()]);
      const raw = Array.from(values).map((value) => ({
        value,
        countA: groupA.counts.get(value) ?? 0,
        countB: groupB.counts.get(value) ?? 0,
      }));
      const suppressedA = discloseExclusiveCounts(
        raw.map((item) => ({ key: item.value, count: item.countA })),
        rowsA.length,
      );
      const suppressedB = discloseExclusiveCounts(
        raw.map((item) => ({ key: item.value, count: item.countB })),
        rowsB.length,
      );
      return raw.map((item) => {
        const hideA = suppressedA.has(item.value);
        const hideB = suppressedB.has(item.value);
        const shareA = groupA.applicableN === 0 ? 0 : item.countA / groupA.applicableN;
        const shareB = groupB.applicableN === 0 ? 0 : item.countB / groupB.applicableN;
        const suppressed = hideA || hideB;
        return {
          field: field.key,
          label: getFieldLabel(field.key, context),
          value: item.value,
          valueLabel: categoryValueLabel(field, item.value),
          family: compositionFamily(field, geoKeys),
          shareA: hideA ? null : shareA,
          shareB: hideB ? null : shareB,
          countA: hideA ? null : item.countA,
          countB: hideB ? null : item.countB,
          deltaPercentagePoints: suppressed ? null : (shareA - shareB) * 100,
          applicableNA: groupA.applicableN,
          applicableNB: groupB.applicableN,
          definitionDifference: defining.has(field.key),
          disclosure: suppressed ? ("suppressed" as const) : ("visible" as const),
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
    });
}

function buildDfcSummary(
  schema: SurveyAnalyticsSchema,
  rowsA: SurveyAnalyticsRecord[],
  rowsB: SurveyAnalyticsRecord[],
  context: SegmentLabelContext,
  effectSizes: boolean,
  assetCompositionDiffers: boolean,
): ComparisonDfcSummary | null {
  const fields = conditionalModuleFields(schema);
  if (fields.length === 0) {
    return null;
  }
  const conceptKey = fields[0]?.concept_key as string;
  const overallField = schema.fields.find(
    (field) => field.concept_key === conceptKey && !field.facet && field.key.endsWith(".value"),
  );
  const overallA = overallField ? snapshot(numericFieldValues(rowsA, overallField.key)) : null;
  const overallB = overallField ? snapshot(numericFieldValues(rowsB, overallField.key)) : null;
  const overallValuesA = overallField ? numericFieldValues(rowsA, overallField.key) : [];
  const overallValuesB = overallField ? numericFieldValues(rowsB, overallField.key) : [];

  const modules: ComparisonDfcModule[] = fields.map((field) => {
    const valuesA = numericFieldValues(rowsA, field.key);
    const valuesB = numericFieldValues(rowsB, field.key);
    const snapA = snapshot(valuesA);
    const snapB = snapshot(valuesB);
    const setKey = field.facet as string;
    return {
      conceptKey,
      setKey,
      field: field.key,
      label: getFacetLabel(conceptKey, setKey, context),
      applicableNA: snapA?.applicableN ?? 0,
      applicableNB: snapB?.applicableN ?? 0,
      notApplicableNA: rowsA.length - (snapA?.applicableN ?? 0),
      notApplicableNB: rowsB.length - (snapB?.applicableN ?? 0),
      applicabilityRateA: rowsA.length === 0 ? null : (snapA?.applicableN ?? 0) / rowsA.length,
      applicabilityRateB: rowsB.length === 0 ? null : (snapB?.applicableN ?? 0) / rowsB.length,
      medianA: snapA?.median ?? null,
      medianB: snapB?.median ?? null,
      q1A: snapA?.q1 ?? null,
      q3A: snapA?.q3 ?? null,
      q1B: snapB?.q1 ?? null,
      q3B: snapB?.q3 ?? null,
      medianDelta: snapA && snapB ? snapA.median - snapB.median : null,
      cliffsDelta: effectSizes && snapA && snapB ? computeCliffsDelta(valuesA, valuesB) : null,
    };
  });

  return {
    conceptKey,
    label: getConceptLabel(conceptKey, context),
    overall: {
      medianA: overallA?.median ?? null,
      medianB: overallB?.median ?? null,
      q1A: overallA?.q1 ?? null,
      q3A: overallA?.q3 ?? null,
      q1B: overallB?.q1 ?? null,
      q3B: overallB?.q3 ?? null,
      applicableNA: overallA?.applicableN ?? 0,
      applicableNB: overallB?.applicableN ?? 0,
      medianDelta: overallA && overallB ? overallA.median - overallB.median : null,
      cliffsDelta: effectSizes && overallA && overallB ? computeCliffsDelta(overallValuesA, overallValuesB) : null,
      includedInMainRanking: false,
    },
    modules,
    assetCompositionDiffers,
  };
}

function buildGeography(
  schema: SurveyAnalyticsSchema,
  rowsA: SurveyAnalyticsRecord[],
  rowsB: SurveyAnalyticsRecord[],
  analysed: SurveyAnalyticsRecord[],
  context: SegmentLabelContext,
): ComparisonGeographyRow[] {
  return geographyFields(schema).flatMap((field) => {
    const analysedValues = collectCategoryValues(analysed, field);
    const groupA = collectCategoryValues(rowsA, field);
    const groupB = collectCategoryValues(rowsB, field);
    const eligible = Array.from(analysedValues.counts.entries()).filter(
      ([, analysedCount]) => analysedCount >= SEGMENT_CELL_MIN_N,
    );
    if (eligible.length === 0) {
      return [];
    }
    const suppressedA = discloseExclusiveCounts(
      eligible.map(([value]) => ({ key: value, count: groupA.counts.get(value) ?? 0 })),
      rowsA.length,
    );
    const suppressedB = discloseExclusiveCounts(
      eligible.map(([value]) => ({ key: value, count: groupB.counts.get(value) ?? 0 })),
      rowsB.length,
    );
    const suppressedAComplement = applyExclusiveCellDisclosure(
      eligible.map(([value, analysedCount]) => ({
        key: value,
        count: analysedCount - (groupA.counts.get(value) ?? 0),
      })),
    );
    const suppressedBComplement = applyExclusiveCellDisclosure(
      eligible.map(([value, analysedCount]) => ({
        key: value,
        count: analysedCount - (groupB.counts.get(value) ?? 0),
      })),
    );

    return eligible
      .map(([value, analysedCount]) => {
        const countA = groupA.counts.get(value) ?? 0;
        const countB = groupB.counts.get(value) ?? 0;
        const hide =
          suppressedA.has(value) ||
          suppressedB.has(value) ||
          suppressedAComplement.has(value) ||
          suppressedBComplement.has(value);
        const shareA = rowsA.length === 0 ? 0 : countA / rowsA.length;
        const shareB = rowsB.length === 0 ? 0 : countB / rowsB.length;
        return {
          field: field.key,
          value,
          label: `${getFieldLabel(field.key, context)}: ${getChoiceValueLabel(value)}`,
          shareA: hide ? null : shareA,
          shareB: hide ? null : shareB,
          countA: hide ? null : countA,
          countB: hide ? null : countB,
          analysedCount,
          deltaPercentagePoints: hide ? null : (shareA - shareB) * 100,
          disclosure: hide ? ("suppressed" as const) : ("visible" as const),
        };
      })
      .sort((left, right) => {
        const leftDelta = left.deltaPercentagePoints == null ? -1 : Math.abs(left.deltaPercentagePoints);
        const rightDelta = right.deltaPercentagePoints == null ? -1 : Math.abs(right.deltaPercentagePoints);
        if (rightDelta !== leftDelta) {
          return rightDelta - leftDelta;
        }
        return left.value.localeCompare(right.value);
      });
  });
}

function buildWeather(
  schema: SurveyAnalyticsSchema,
  rowsA: SurveyAnalyticsRecord[],
  rowsB: SurveyAnalyticsRecord[],
): ComparisonWeatherSeries[] {
  return [
    { key: "context.climate.temp_outdoor_c", label: "Outdoor temperature", unit: "°C" },
    { key: "context.climate.humidity_pct", label: "Outdoor humidity", unit: "%" },
  ]
    .filter((item) => schema.fields.some((field) => field.key === item.key))
    .flatMap((item) => {
      const valuesA = rowsA
        .filter((row) => isUsableWeatherQuality(row.mapper_output.context_metadata.climate?.quality_flag))
        .map((row) => getSurveyAnalyticsFieldValue(row, item.key))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .sort((left, right) => left - right);
      const valuesB = rowsB
        .filter((row) => isUsableWeatherQuality(row.mapper_output.context_metadata.climate?.quality_flag))
        .map((row) => getSurveyAnalyticsFieldValue(row, item.key))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .sort((left, right) => left - right);
      if (valuesA.length === 0 && valuesB.length === 0) {
        return [];
      }
      return [
        {
          field: item.key,
          label: item.label,
          unit: item.unit,
          nA: valuesA.length,
          nB: valuesB.length,
          medianA: valuesA.length === 0 ? null : (computeLinearQuantile(valuesA, 0.5) ?? null),
          medianB: valuesB.length === 0 ? null : (computeLinearQuantile(valuesB, 0.5) ?? null),
        },
      ];
    });
}

function overlapDescription(sample: ComparisonSample) {
  if (sample.relation === "a_contains_b") {
    return `Segment B is contained in Segment A (A∩B=${sample.intersectionN}, A only=${sample.aOnlyN}, B only=${sample.bOnlyN}).`;
  }
  if (sample.relation === "b_contains_a") {
    return `Segment A is contained in Segment B (A∩B=${sample.intersectionN}, A only=${sample.aOnlyN}, B only=${sample.bOnlyN}).`;
  }
  return `Segments A and B overlap (A∩B=${sample.intersectionN}, A only=${sample.aOnlyN}, B only=${sample.bOnlyN}).`;
}

function buildInsights(input: {
  sample: ComparisonSample;
  scores: ComparisonScoreDifference[];
  composition: ComparisonCompositionDifference[];
}): ComparisonInsight[] {
  if (input.sample.relation === "identical") {
    return [];
  }

  if (!input.sample.effectSizesAvailable) {
    const observed = [
      overlapDescription(input.sample),
      "Descriptive results remain available. Effect sizes designed for independent samples are not applied.",
    ].join(" ");
    const insights: ComparisonInsight[] = [
      {
        kind: "descriptive",
        observedPattern: observed,
        potentialReading: "",
        worthExamining: "",
        conceptKeys: [],
        evidence: {
          selectedN: input.sample.nA,
          outsideN: input.sample.nB,
          selectedValue: null,
          outsideValue: null,
          delta: null,
          cliffsDelta: null,
        },
      },
    ];
    const descriptiveScores = input.scores.filter(
      (row) =>
        !row.definitionDifference &&
        hasSemanticComparisonN(row.applicableNA, row.applicableNB) &&
        Math.abs(row.medianDelta) > 0,
    );
    const usedConcepts = new Set<string>();
    for (const row of descriptiveScores) {
      if (insights.length >= 3) {
        break;
      }
      if (usedConcepts.has(row.conceptKey)) {
        continue;
      }
      usedConcepts.add(row.conceptKey);
      const side = row.medianDelta >= 0 ? "A" : "B";
      insights.push({
        kind: "descriptive",
        observedPattern: `${row.label} has a higher median in Segment ${side} (Δ median ${row.medianDelta.toFixed(2)}, n=${row.applicableNA}/${row.applicableNB}). Because the samples are not disjoint, this remains a descriptive contrast.`,
        potentialReading: "",
        worthExamining: "",
        conceptKeys: [row.conceptKey],
        evidence: {
          selectedN: row.applicableNA,
          outsideN: row.applicableNB,
          selectedValue: row.medianA,
          outsideValue: row.medianB,
          delta: row.medianDelta,
          cliffsDelta: null,
        },
      });
    }
    return insights.slice(0, 3);
  }

  const insights: ComparisonInsight[] = [];
  const usedConcepts = new Set<string>();
  const scoreHits = input.scores.filter(
    (row) =>
      !row.definitionDifference &&
      row.cliffsDelta != null &&
      Math.abs(row.cliffsDelta) >= SCORE_INSIGHT_MIN_CLIFFS &&
      hasSemanticComparisonN(row.applicableNA, row.applicableNB),
  );
  for (const row of scoreHits) {
    if (insights.length >= 3) {
      break;
    }
    if (usedConcepts.has(row.conceptKey)) {
      continue;
    }
    usedConcepts.add(row.conceptKey);
    const side = (row.medianDelta ?? 0) >= 0 ? "A" : "B";
    const copy = scoreInsightCopy(row, side);
    insights.push({
      kind: "score_difference",
      observedPattern: copy.observed,
      potentialReading: copy.potentialReading,
      worthExamining: copy.worthExamining,
      conceptKeys: [row.conceptKey],
      evidence: {
        selectedN: row.applicableNA,
        outsideN: row.applicableNB,
        selectedValue: row.medianA,
        outsideValue: row.medianB,
        delta: row.medianDelta,
        cliffsDelta: row.cliffsDelta,
      },
    });
  }

  const usedFields = new Set<string>();
  const compositionHits = input.composition.filter(
    (row) =>
      !row.definitionDifference &&
      row.family !== "geography" &&
      row.disclosure === "visible" &&
      row.deltaPercentagePoints != null &&
      row.deltaPercentagePoints !== 0 &&
      Math.abs(row.deltaPercentagePoints) >= COMPOSITION_INSIGHT_MIN_PP &&
      hasSemanticComparisonN(row.applicableNA, row.applicableNB),
  );
  for (const row of compositionHits) {
    if (insights.length >= 3) {
      break;
    }
    if (usedFields.has(row.field)) {
      continue;
    }
    usedFields.add(row.field);
    const copy = compositionInsightCopy(row);
    insights.push({
      kind: "composition_difference",
      observedPattern: copy.observed,
      potentialReading: copy.potentialReading,
      worthExamining: copy.worthExamining,
      conceptKeys: [],
      evidence: {
        selectedN: row.applicableNA,
        outsideN: row.applicableNB,
        selectedValue: row.shareA,
        outsideValue: row.shareB,
        delta: row.deltaPercentagePoints,
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

export function buildSegmentComparison(input: {
  schema: SurveyAnalyticsSchema;
  rows: SurveyAnalyticsRecord[];
  definitionA: SegmentDefinition;
  definitionB: SegmentDefinition;
  generatedAt?: string;
}): SegmentComparisonResult {
  const context = segmentLabelContext(input.schema);
  const rowsA = selectRows(input.schema, input.rows, input.definitionA);
  const rowsB = selectRows(input.schema, input.rows, input.definitionB);
  const idsB = new Set(rowsB.map((row) => row.response_id));
  let intersectionN = 0;
  for (const row of rowsA) {
    if (idsB.has(row.response_id)) {
      intersectionN += 1;
    }
  }
  const nA = rowsA.length;
  const nB = rowsB.length;
  const relation = overlapRelation(nA, nB, intersectionN);
  const sample: ComparisonSample = {
    analysedN: input.rows.length,
    nA,
    nB,
    intersectionN,
    aOnlyN: nA - intersectionN,
    bOnlyN: nB - intersectionN,
    shareA: input.rows.length === 0 ? null : nA / input.rows.length,
    shareB: input.rows.length === 0 ? null : nB / input.rows.length,
    relation,
    effectSizesAvailable: relation === "disjoint",
  };
  const definitions = [input.definitionA, input.definitionB];
  const blockedReason = relation === "identical" ? ("identical" as const) : null;
  const effectSizes = sample.effectSizesAvailable && !blockedReason;

  const scoreCandidates = blockedReason
    ? []
    : [
        ...primaryAxisFields(input.schema).map((field) =>
          buildScoreRow({
            kind: "primary_axis",
            field,
            rowsA,
            rowsB,
            definitions,
            context,
            effectSizes,
            valuesA: numericConceptValues(rowsA, field.concept_key as string),
            valuesB: numericConceptValues(rowsB, field.concept_key as string),
          }),
        ),
        ...primaryFacetFields(input.schema).map((field) =>
          buildScoreRow({
            kind: "facet",
            field,
            rowsA,
            rowsB,
            definitions,
            context,
            effectSizes,
          }),
        ),
        ...modulatorFields(input.schema).map((field) =>
          buildScoreRow({
            kind: "modulator",
            field,
            rowsA,
            rowsB,
            definitions,
            context,
            effectSizes,
            valuesA: numericConceptValues(rowsA, field.concept_key as string),
            valuesB: numericConceptValues(rowsB, field.concept_key as string),
          }),
        ),
        ...conditionalModuleFields(input.schema).map((field) =>
          buildScoreRow({
            kind: "capability_module",
            field,
            rowsA,
            rowsB,
            definitions,
            context,
            effectSizes,
          }),
        ),
      ].filter((row): row is ComparisonScoreDifference => row != null);

  const scoreDifferences = scoreCandidates.filter((row) => !row.definitionDifference).sort(compareScoreRows);
  const definitionDifferences = scoreCandidates.filter((row) => row.definitionDifference).sort(compareScoreRows);
  const compositionDifferences = blockedReason
    ? []
    : buildCompositionRows(input.schema, rowsA, rowsB, definitions, context).filter(
        (row) => !row.definitionDifference && row.deltaPercentagePoints !== 0,
      );
  const assetCompositionDiffers = compositionDifferences.some(
    (row) =>
      row.family === "asset" &&
      row.disclosure === "visible" &&
      row.deltaPercentagePoints != null &&
      Math.abs(row.deltaPercentagePoints) >= ASSET_COMPOSITION_GAP_PP,
  );
  const dfc = blockedReason
    ? null
    : buildDfcSummary(input.schema, rowsA, rowsB, context, effectSizes, assetCompositionDiffers);
  const profileAxes: ComparisonProfileAxis[] = blockedReason
    ? []
    : primaryAxisFields(input.schema).flatMap((field) => {
        const conceptKey = field.concept_key as string;
        const snapA = snapshot(numericConceptValues(rowsA, conceptKey));
        const snapB = snapshot(numericConceptValues(rowsB, conceptKey));
        if (!snapA || !snapB) {
          return [];
        }
        return [
          {
            conceptKey,
            field: field.key,
            label: getConceptLabel(conceptKey, context),
            directionNote: getScoreDirectionNote(conceptKey, context),
            medianA: snapA.median,
            medianB: snapB.median,
            applicableNA: snapA.applicableN,
            applicableNB: snapB.applicableN,
          },
        ];
      });
  const countryDefines = definitions.some((definition) =>
    definition.conditions.some((condition) => condition.field === "context.country_code"),
  );
  const geography = blockedReason || countryDefines ? [] : buildGeography(input.schema, rowsA, rowsB, input.rows, context);
  const weather = blockedReason ? [] : buildWeather(input.schema, rowsA, rowsB);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    definitionA: input.definitionA,
    definitionB: input.definitionB,
    readableConditionsA: describeReadableConditions(input.definitionA, input.schema),
    readableConditionsB: describeReadableConditions(input.definitionB, input.schema),
    sample,
    blockedReason,
    scoreDifferences,
    definitionDifferences,
    compositionDifferences,
    dfc,
    profileAxes,
    geography,
    weather,
    insights: blockedReason
      ? []
      : buildInsights({ sample, scores: scoreDifferences, composition: compositionDifferences }),
    rules: {
      semanticMinN: SEGMENT_SEMANTIC_MIN_N,
      cellMinN: SEGMENT_CELL_MIN_N,
      scoreRanking: "abs_cliffs_delta",
      compositionRanking: "abs_percentage_points",
      effectSizesRequireDisjoint: true,
    },
  };
}

export function assertAggregateSegmentComparison(result: SegmentComparisonResult) {
  const serialized = JSON.stringify(result);
  return {
    hasResponseId: serialized.includes("response_id") || serialized.includes("responseId"),
    hasAnswers: serialized.includes("answers_json"),
    hasMapperOutput: serialized.includes("mapper_output"),
  };
}
