import { describe, expect, it } from "vitest";
import {
  compositionAxisDomain,
  compositionBarLayout,
  compositionPlotAriaLabel,
  plottableCompositionRows,
  scorePlotAriaLabel,
  scorePlotTooltipLines,
  scoreScaleRatio,
  shouldDismissPlotTooltip,
  visibleCompositionPlotRows,
  visibleScorePlotRows,
} from "@/app/(app)/surveys/[surveyId]/analytics-v2/comparison-plot-model";
import type {
  ComparisonCompositionDifference,
  ComparisonScoreDifference,
} from "@/features/surveys/analytics/segments";

function scoreRow(overrides: Partial<ComparisonScoreDifference> = {}): ComparisonScoreDifference {
  return {
    kind: "primary_axis",
    conceptKey: "trust_in_automation",
    field: "profile.trust_in_automation.value",
    label: "Trust in automation",
    facet: null,
    evidenceLevel: null,
    evidenceLabel: null,
    directionNote: null,
    definitionDifference: false,
    medianA: 4,
    medianB: 2,
    q1A: 3.5,
    q3A: 4.5,
    q1B: 1.5,
    q3B: 2.5,
    medianDelta: 2,
    cliffsDelta: 0.8,
    applicableNA: 8,
    applicableNB: 8,
    ...overrides,
  };
}

function compositionRow(
  overrides: Partial<ComparisonCompositionDifference> = {},
): ComparisonCompositionDifference {
  return {
    field: "profile.owned_der_assets.value",
    label: "Household energy assets",
    value: "ev",
    valueLabel: "Electric vehicle",
    family: "asset",
    shareA: 0.4,
    shareB: 0.1,
    countA: 8,
    countB: 2,
    deltaPercentagePoints: 30,
    applicableNA: 20,
    applicableNB: 20,
    definitionDifference: false,
    disclosure: "visible",
    ...overrides,
  };
}

describe("comparison plots", () => {
  it("maps score scale 1 to the start and 5 to the end", () => {
    expect(scoreScaleRatio(1)).toBe(0);
    expect(scoreScaleRatio(5)).toBe(1);
    expect(scoreScaleRatio(3)).toBe(0.5);
  });

  it("keeps engine order and limits visible score rows to six", () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      scoreRow({ field: `field.${index}`, label: `Row ${index}`, medianA: 5 - index * 0.1 }),
    );
    const visible = visibleScorePlotRows(rows);
    expect(visible.map((row) => row.field)).toEqual(rows.slice(0, 6).map((row) => row.field));
    expect(visible).toHaveLength(6);
  });

  it("places A/B medians inside their IQR on the same 1–5 scale", () => {
    const row = scoreRow();
    expect(scoreScaleRatio(row.q1A)).toBeLessThan(scoreScaleRatio(row.medianA));
    expect(scoreScaleRatio(row.medianA)).toBeLessThan(scoreScaleRatio(row.q3A));
    expect(scoreScaleRatio(row.q1B)).toBeLessThan(scoreScaleRatio(row.medianB));
    expect(scoreScaleRatio(row.medianB)).toBeLessThan(scoreScaleRatio(row.q3B));
  });

  it("still includes small-n score rows and marks them descriptive only", () => {
    const small = scoreRow({
      field: "profile.manual_override_need.value",
      label: "Manual override need",
      applicableNA: 1,
      applicableNB: 7,
      kind: "modulator",
      conceptKey: "manual_override_need",
    });
    expect(visibleScorePlotRows([small])).toEqual([small]);
    expect(scorePlotTooltipLines(small).some((line) => line.includes("descriptive only"))).toBe(true);
  });

  it("describes missing Cliff’s delta when segments are not disjoint", () => {
    const overlap = scoreRow({ cliffsDelta: null });
    expect(scorePlotTooltipLines(overlap).join(" ")).toContain("not disjoint");
  });

  it("plots composition bars with the A−B sign and a symmetric domain", () => {
    expect(compositionBarLayout(20, 20).side).toBe("a");
    expect(compositionBarLayout(-12, 20).side).toBe("b");
    expect(compositionBarLayout(20, 20).ratio).toBe(1);
    expect(compositionAxisDomain([12, -7])).toBe(15);
    expect(compositionAxisDomain([3])).toBe(10);
    expect(compositionAxisDomain([96])).toBe(100);
  });

  it("omits geography, suppressed and null composition rows", () => {
    const rows = [
      compositionRow({ value: "geo", family: "geography", label: "Country code" }),
      compositionRow({ value: "hidden", disclosure: "suppressed", deltaPercentagePoints: null, shareA: null }),
      compositionRow({ value: "missing", deltaPercentagePoints: null }),
      compositionRow({ value: "ev" }),
    ];
    expect(plottableCompositionRows(rows).map((row) => row.value)).toEqual(["ev"]);
    expect(visibleCompositionPlotRows(rows)).toHaveLength(1);
  });

  it("returns no plottable rows when the series is empty", () => {
    expect(visibleScorePlotRows([])).toEqual([]);
    expect(visibleCompositionPlotRows([])).toEqual([]);
  });

  it("builds keyboard summaries and dismisses the tooltip on Escape", () => {
    expect(shouldDismissPlotTooltip("Escape")).toBe(true);
    expect(shouldDismissPlotTooltip("Enter")).toBe(false);
    expect(scorePlotAriaLabel(scoreRow())).toContain("Segment A median");
    expect(compositionPlotAriaLabel(compositionRow())).toContain("Difference");
  });
});
