import {
  hasSemanticComparisonN,
  type ComparisonCompositionDifference,
  type ComparisonScoreDifference,
  type ComparisonScoreKind,
} from "@/features/surveys/analytics/segments";

export const COMPARISON_PLOT_ROW_LIMIT = 6;
export const SCORE_SCALE_MIN = 1;
export const SCORE_SCALE_MAX = 5;
export const COMPOSITION_DOMAIN_MIN = 10;
export const COMPOSITION_DOMAIN_MAX = 100;
export const COMPOSITION_DOMAIN_STEP = 5;

export const COMPARISON_SCORE_KIND_LABEL: Record<ComparisonScoreKind, string> = {
  primary_axis: "Primary axis",
  facet: "Facet",
  modulator: "Modulator",
  capability_module: "Capability module",
};

export const COMPOSITION_FAMILY_LABEL: Record<"asset" | "category", string> = {
  asset: "Asset",
  category: "Category",
};

export function visibleScorePlotRows(rows: ComparisonScoreDifference[]) {
  return rows.slice(0, COMPARISON_PLOT_ROW_LIMIT);
}

export function plottableCompositionRows(rows: ComparisonCompositionDifference[]) {
  return rows.filter(
    (row) =>
      row.family !== "geography" &&
      row.disclosure === "visible" &&
      row.deltaPercentagePoints != null,
  );
}

export function visibleCompositionPlotRows(rows: ComparisonCompositionDifference[]) {
  return plottableCompositionRows(rows).slice(0, COMPARISON_PLOT_ROW_LIMIT);
}

export function scoreScaleRatio(value: number) {
  const clamped = Math.max(SCORE_SCALE_MIN, Math.min(SCORE_SCALE_MAX, value));
  return (clamped - SCORE_SCALE_MIN) / (SCORE_SCALE_MAX - SCORE_SCALE_MIN);
}

export function compositionAxisDomain(deltas: number[]) {
  const maxAbs = deltas.reduce((current, delta) => Math.max(current, Math.abs(delta)), 0);
  const rounded = Math.ceil(maxAbs / COMPOSITION_DOMAIN_STEP) * COMPOSITION_DOMAIN_STEP;
  return Math.min(COMPOSITION_DOMAIN_MAX, Math.max(COMPOSITION_DOMAIN_MIN, rounded || COMPOSITION_DOMAIN_MIN));
}

export function compositionBarLayout(delta: number, domain: number) {
  return {
    side: delta >= 0 ? ("a" as const) : ("b" as const),
    ratio: domain === 0 ? 0 : Math.min(1, Math.abs(delta) / domain),
  };
}

export function shouldDismissPlotTooltip(key: string) {
  return key === "Escape";
}

export function formatPlotScore(value: number) {
  return value.toFixed(2);
}

export function formatPlotCount(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatPlotPercent(share: number | null) {
  if (share == null || Number.isNaN(share)) {
    return "n/a";
  }
  return `${Math.round(share * 100)}%`;
}

export function formatPlotPp(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} pp`;
}

export function scorePlotAriaLabel(row: ComparisonScoreDifference) {
  const kind = COMPARISON_SCORE_KIND_LABEL[row.kind];
  return `${row.label}, ${kind}. Segment A median ${formatPlotScore(row.medianA)}, n=${formatPlotCount(row.applicableNA)}. Segment B median ${formatPlotScore(row.medianB)}, n=${formatPlotCount(row.applicableNB)}. Median difference ${formatPlotScore(row.medianDelta)}.`;
}

export function compositionPlotAriaLabel(row: ComparisonCompositionDifference) {
  const delta = row.deltaPercentagePoints ?? 0;
  return `${row.label}: ${row.valueLabel}. Segment A ${formatPlotPercent(row.shareA)}, n=${formatPlotCount(row.applicableNA)}. Segment B ${formatPlotPercent(row.shareB)}, n=${formatPlotCount(row.applicableNB)}. Difference ${formatPlotPp(delta)}.`;
}

export function scorePlotTooltipLines(row: ComparisonScoreDifference) {
  const lines = [
    row.label,
    COMPARISON_SCORE_KIND_LABEL[row.kind],
    `Segment A · median ${formatPlotScore(row.medianA)} · IQR ${formatPlotScore(row.q1A)}–${formatPlotScore(row.q3A)} · n=${formatPlotCount(row.applicableNA)}`,
    `Segment B · median ${formatPlotScore(row.medianB)} · IQR ${formatPlotScore(row.q1B)}–${formatPlotScore(row.q3B)} · n=${formatPlotCount(row.applicableNB)}`,
    `Median difference A−B · ${formatPlotScore(row.medianDelta)}`,
    row.cliffsDelta == null
      ? "Effect size unavailable because the segments are not disjoint."
      : `Cliff’s δ · ${row.cliffsDelta.toFixed(2)}`,
  ];
  if (row.directionNote) {
    lines.push(row.directionNote);
  }
  if (row.kind === "facet" && row.evidenceLabel) {
    lines.push(row.evidenceLabel);
  }
  if (!hasSemanticComparisonN(row.applicableNA, row.applicableNB)) {
    lines.push("Small applicable sample · descriptive only.");
  }
  return lines;
}

export function compositionPlotTooltipLines(row: ComparisonCompositionDifference) {
  const family = row.family === "asset" ? COMPOSITION_FAMILY_LABEL.asset : COMPOSITION_FAMILY_LABEL.category;
  const countA = row.countA == null ? "n/a" : `${formatPlotCount(row.countA)}/${formatPlotCount(row.applicableNA)}`;
  const countB = row.countB == null ? "n/a" : `${formatPlotCount(row.countB)}/${formatPlotCount(row.applicableNB)}`;
  const lines = [
    `${row.label}: ${row.valueLabel}`,
    family,
    `Segment A · ${formatPlotPercent(row.shareA)} · ${countA}`,
    `Segment B · ${formatPlotPercent(row.shareB)} · ${countB}`,
    `Difference A−B · ${formatPlotPp(row.deltaPercentagePoints ?? 0)}`,
  ];
  if (!hasSemanticComparisonN(row.applicableNA, row.applicableNB)) {
    lines.push("Small applicable sample · descriptive only.");
  }
  return lines;
}
