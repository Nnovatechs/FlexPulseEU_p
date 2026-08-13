import { describe, expect, it } from "vitest";
import {
  alignItemScore,
  alphaIfItemDeleted,
  bootstrapAlphaCi,
  buildNumericDescriptives,
  computeHtmt,
  correctedItemTotalCorrelations,
  cronbachAlpha,
  midranks,
  pairwiseNumericPairs,
  pearsonCorrelation,
  sampleSd,
  spearmanCorrelation,
} from "@/features/surveys/analytics/instrument-health-stats";

describe("instrument-health-stats", () => {
  it("keeps positive polarity and reverses 1-5 negative polarity", () => {
    expect(alignItemScore(5, 1, 5, "positive")).toBe(5);
    expect(alignItemScore(5, 1, 5, "negative")).toBe(1);
    expect(alignItemScore(1, 1, 5, "negative")).toBe(5);
    expect(alignItemScore(3, 1, 5, "neutral")).toBeNull();
  });

  it("computes sample SD, endpoints and top/bottom-two on a 1-5 scale", () => {
    const values = [1, 2, 3, 4, 5];
    const descriptives = buildNumericDescriptives(values, { min: 1, max: 5 });

    expect(descriptives.n).toBe(5);
    expect(descriptives.mean).toBe(3);
    expect(descriptives.median).toBe(3);
    expect(descriptives.sd).toBeCloseTo(sampleSd(values) ?? 0);
    expect(descriptives.floorShare).toBe(0.2);
    expect(descriptives.ceilingShare).toBe(0.2);
    expect(descriptives.topTwoShare).toBe(0.4);
    expect(descriptives.bottomTwoShare).toBe(0.4);
  });

  it("returns empty descriptives and no invented top-two for non 1-5 scales", () => {
    expect(buildNumericDescriptives([]).n).toBe(0);
    expect(buildNumericDescriptives([10, 20], { min: 0, max: 100 }).topTwoShare).toBeNull();
  });

  it("computes a known Cronbach alpha of 1 for identical items", () => {
    const result = cronbachAlpha([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);

    expect(result.status).toBe("computed");
    if (result.status === "computed") {
      expect(result.alpha).toBeCloseTo(1);
    }
  });

  it("does not compute alpha when total variance is zero", () => {
    const result = cronbachAlpha([
      [1, 3],
      [2, 2],
      [3, 1],
    ]);

    expect(result).toMatchObject({ status: "not_computable" });
  });

  it("computes corrected item-total and alpha if deleted", () => {
    const completeCases = [
      [1, 1, 2],
      [2, 2, 3],
      [3, 3, 4],
      [4, 4, 5],
    ];
    const citc = correctedItemTotalCorrelations(completeCases);
    const deleted = alphaIfItemDeleted(completeCases);

    expect(citc[0]).not.toBeNull();
    expect(deleted[0]).not.toBeNull();
  });

  it("uses midranks for Spearman ties and pairwise n", () => {
    expect(midranks([1, 2, 2, 3])).toEqual([1, 2.5, 2.5, 4]);

    const left = [1, 2, null, 4];
    const right = [1, 3, 2, 5];
    const paired = pairwiseNumericPairs(left, right);
    expect(paired.n).toBe(3);
    expect(spearmanCorrelation(paired.left, paired.right)).not.toBeNull();
    expect(pearsonCorrelation(paired.left, paired.right)).not.toBeNull();
  });

  it("does not coerce nulls into zeros", () => {
    const paired = pairwiseNumericPairs([1, null, 3], [1, 0, 3]);
    expect(paired).toEqual({ left: [1, 3], right: [1, 3], n: 2 });
  });

  it("computes a known HTMT value and rejects single-item constructs", () => {
    const a = [
      [1, 2, 3, 4],
      [1, 2, 3, 4],
    ];
    const b = [
      [4, 3, 2, 1],
      [4, 3, 2, 1],
    ];
    const result = computeHtmt(a, b);
    expect(result.status).toBe("computed");
    expect(result.value).toBeGreaterThan(0);

    expect(computeHtmt([[1, 2, 3]], b).status).toBe("not_computable");
  });

  it("returns a deterministic bootstrap interval for a fixed seed", () => {
    const completeCases = [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ];
    const first = bootstrapAlphaCi({ completeCases, seedKey: "hash:overall:trust", replicates: 50 });
    const second = bootstrapAlphaCi({ completeCases, seedKey: "hash:overall:trust", replicates: 50 });
    expect(first).toEqual(second);
    expect(first.validReplicates).toBeGreaterThan(0);
  });
});
