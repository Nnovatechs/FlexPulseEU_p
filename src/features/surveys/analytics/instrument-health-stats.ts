import { computeLinearQuantile } from "@/features/surveys/analytics/overview-v2";
import type { ItemPolarity } from "@/features/surveys/analytics/instrument-health-semantics";
import { INSTRUMENT_HEALTH_ALPHA_BOOTSTRAP_REPLICATES } from "@/features/surveys/analytics/instrument-health-semantics";

export type NumericDescriptives = {
  n: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  q1: number | null;
  q3: number | null;
  min: number | null;
  max: number | null;
  floorShare: number | null;
  ceilingShare: number | null;
  topTwoShare: number | null;
  bottomTwoShare: number | null;
};

export type CronbachAlphaResult =
  | {
      status: "computed";
      alpha: number;
      itemVariances: number[];
      totalVariance: number;
    }
  | {
      status: "not_computable";
      reason: string;
    };

export function alignItemScore(
  value: number,
  min: number,
  max: number,
  polarity: ItemPolarity,
): number | null {
  if (polarity === "neutral") {
    return null;
  }

  if (polarity === "negative") {
    return min + max - value;
  }

  return value;
}

export function mean(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sampleVariance(values: number[]) {
  if (values.length < 2) {
    return null;
  }

  const average = mean(values);
  if (average == null) {
    return null;
  }

  const sumSquares = values.reduce((sum, value) => sum + (value - average) ** 2, 0);
  return sumSquares / (values.length - 1);
}

export function sampleSd(values: number[]) {
  const variance = sampleVariance(values);
  return variance == null ? null : Math.sqrt(variance);
}

export function buildNumericDescriptives(
  values: number[],
  scale?: { min: number; max: number } | null,
): NumericDescriptives {
  if (values.length === 0) {
    return {
      n: 0,
      mean: null,
      median: null,
      sd: null,
      q1: null,
      q3: null,
      min: null,
      max: null,
      floorShare: null,
      ceilingShare: null,
      topTwoShare: null,
      bottomTwoShare: null,
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const isLikert15 = scale?.min === 1 && scale?.max === 5;
  const floorCount =
    scale == null ? null : values.filter((value) => value === scale.min).length;
  const ceilingCount =
    scale == null ? null : values.filter((value) => value === scale.max).length;

  return {
    n: values.length,
    mean: mean(values),
    median: computeLinearQuantile(sorted, 0.5),
    sd: sampleSd(values),
    q1: computeLinearQuantile(sorted, 0.25),
    q3: computeLinearQuantile(sorted, 0.75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    floorShare: floorCount == null ? null : floorCount / values.length,
    ceilingShare: ceilingCount == null ? null : ceilingCount / values.length,
    topTwoShare: isLikert15
      ? values.filter((value) => value >= 4).length / values.length
      : null,
    bottomTwoShare: isLikert15
      ? values.filter((value) => value <= 2).length / values.length
      : null,
  };
}

export function pearsonCorrelation(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 2) {
    return null;
  }

  const leftMean = mean(left);
  const rightMean = mean(right);
  if (leftMean == null || rightMean == null) {
    return null;
  }

  let numerator = 0;
  let leftSquares = 0;
  let rightSquares = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquares += leftDelta * leftDelta;
    rightSquares += rightDelta * rightDelta;
  }

  if (leftSquares === 0 || rightSquares === 0) {
    return null;
  }

  return numerator / Math.sqrt(leftSquares * rightSquares);
}

export function midranks(values: number[]) {
  const ordered = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value || left.index - right.index);
  const ranks = Array.from({ length: values.length }, () => 0);

  let cursor = 0;
  while (cursor < ordered.length) {
    let end = cursor;
    while (end + 1 < ordered.length && ordered[end + 1].value === ordered[cursor].value) {
      end += 1;
    }

    const averageRank = (cursor + end) / 2 + 1;
    for (let index = cursor; index <= end; index += 1) {
      ranks[ordered[index].index] = averageRank;
    }

    cursor = end + 1;
  }

  return ranks;
}

export function spearmanCorrelation(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 2) {
    return null;
  }

  return pearsonCorrelation(midranks(left), midranks(right));
}

export function pairwiseNumericPairs(left: Array<number | null>, right: Array<number | null>) {
  const pairedLeft: number[] = [];
  const pairedRight: number[] = [];

  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (leftValue == null || rightValue == null) {
      continue;
    }

    pairedLeft.push(leftValue);
    pairedRight.push(rightValue);
  }

  return { left: pairedLeft, right: pairedRight, n: pairedLeft.length };
}

export function cronbachAlpha(completeCases: number[][]): CronbachAlphaResult {
  const completeCaseN = completeCases.length;
  const itemCount = completeCases[0]?.length ?? 0;

  if (itemCount < 2) {
    return { status: "not_computable", reason: "Fewer than two items." };
  }

  if (completeCaseN < 2) {
    return { status: "not_computable", reason: "Fewer than two complete cases." };
  }

  const columns = Array.from({ length: itemCount }, (_, itemIndex) =>
    completeCases.map((row) => row[itemIndex]),
  );
  const itemVariances = columns.map((column) => sampleVariance(column));
  if (itemVariances.some((value) => value == null)) {
    return { status: "not_computable", reason: "An item variance could not be computed." };
  }

  const totals = completeCases.map((row) => row.reduce((sum, value) => sum + value, 0));
  const totalVariance = sampleVariance(totals);
  if (totalVariance == null) {
    return { status: "not_computable", reason: "Total score variance could not be computed." };
  }

  if (totalVariance === 0) {
    return { status: "not_computable", reason: "Total score variance is zero." };
  }

  const varianceSum = (itemVariances as number[]).reduce((sum, value) => sum + value, 0);
  return {
    status: "computed",
    alpha: (itemCount / (itemCount - 1)) * (1 - varianceSum / totalVariance),
    itemVariances: itemVariances as number[],
    totalVariance,
  };
}

export function correctedItemTotalCorrelations(completeCases: number[][]) {
  const itemCount = completeCases[0]?.length ?? 0;
  return Array.from({ length: itemCount }, (_, itemIndex) => {
    const item = completeCases.map((row) => row[itemIndex]);
    const rest = completeCases.map((row) =>
      row.reduce((sum, value, index) => (index === itemIndex ? sum : sum + value), 0),
    );
    return pearsonCorrelation(item, rest);
  });
}

export function alphaIfItemDeleted(completeCases: number[][]) {
  const itemCount = completeCases[0]?.length ?? 0;
  return Array.from({ length: itemCount }, (_, itemIndex) => {
    const reduced = completeCases.map((row) => row.filter((_, index) => index !== itemIndex));
    const result = cronbachAlpha(reduced);
    return result.status === "computed" ? result.alpha : null;
  });
}

export function averageInterItemCorrelation(completeCases: number[][]) {
  const itemCount = completeCases[0]?.length ?? 0;
  if (itemCount < 2 || completeCases.length < 2) {
    return null;
  }

  const correlations: number[] = [];
  for (let leftIndex = 0; leftIndex < itemCount; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < itemCount; rightIndex += 1) {
      const correlation = pearsonCorrelation(
        completeCases.map((row) => row[leftIndex]),
        completeCases.map((row) => row[rightIndex]),
      );
      if (correlation != null) {
        correlations.push(correlation);
      }
    }
  }

  return mean(correlations);
}

export function hashStringToSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createMulberry32(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let nextValue = Math.imul(state ^ (state >>> 15), 1 | state);
    nextValue ^= nextValue + Math.imul(nextValue ^ (nextValue >>> 7), 61 | nextValue);
    return ((nextValue ^ (nextValue >>> 14)) >>> 0) / 4294967296;
  };
}

export function bootstrapAlphaCi(input: {
  completeCases: number[][];
  seedKey: string;
  replicates?: number;
}) {
  const replicates = input.replicates ?? INSTRUMENT_HEALTH_ALPHA_BOOTSTRAP_REPLICATES;
  const observed = cronbachAlpha(input.completeCases);
  if (observed.status !== "computed") {
    return {
      lower: null as number | null,
      upper: null as number | null,
      validReplicates: 0,
      requestedReplicates: replicates,
    };
  }

  const random = createMulberry32(hashStringToSeed(input.seedKey));
  const alphas: number[] = [];
  const n = input.completeCases.length;

  for (let replicate = 0; replicate < replicates; replicate += 1) {
    const sample = Array.from({ length: n }, () => {
      const index = Math.floor(random() * n);
      return input.completeCases[index];
    });
    const result = cronbachAlpha(sample);
    if (result.status === "computed") {
      alphas.push(result.alpha);
    }
  }

  if (alphas.length === 0) {
    return {
      lower: null as number | null,
      upper: null as number | null,
      validReplicates: 0,
      requestedReplicates: replicates,
    };
  }

  const sorted = [...alphas].sort((left, right) => left - right);
  return {
    lower: computeLinearQuantile(sorted, 0.025),
    upper: computeLinearQuantile(sorted, 0.975),
    validReplicates: alphas.length,
    requestedReplicates: replicates,
  };
}

export function meanAbs(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return mean(values.map((value) => Math.abs(value)));
}

export function computeHtmt(itemMatrixA: Array<Array<number | null>>, itemMatrixB: Array<Array<number | null>>) {
  if (itemMatrixA.length < 2 || itemMatrixB.length < 2) {
    return { status: "not_computable" as const, value: null, reason: "Each construct needs at least two items." };
  }

  const withinA = pairwiseItemCorrelations(itemMatrixA);
  const withinB = pairwiseItemCorrelations(itemMatrixB);
  const between: number[] = [];

  for (const left of itemMatrixA) {
    for (const right of itemMatrixB) {
      const paired = pairwiseNumericPairs(left, right);
      const correlation = pearsonCorrelation(paired.left, paired.right);
      if (correlation != null) {
        between.push(correlation);
      }
    }
  }

  const meanWithinA = meanAbs(withinA);
  const meanWithinB = meanAbs(withinB);
  const meanBetween = meanAbs(between);

  if (
    meanWithinA == null ||
    meanWithinB == null ||
    meanBetween == null ||
    meanWithinA === 0 ||
    meanWithinB === 0
  ) {
    return {
      status: "not_computable" as const,
      value: null,
      reason: "A within- or between-construct correlation mean is missing or zero.",
    };
  }

  return {
    status: "computed" as const,
    value: meanBetween / Math.sqrt(meanWithinA * meanWithinB),
    reason: null,
  };
}

function pairwiseItemCorrelations(itemMatrix: Array<Array<number | null>>) {
  const correlations: number[] = [];

  for (let leftIndex = 0; leftIndex < itemMatrix.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < itemMatrix.length; rightIndex += 1) {
      const paired = pairwiseNumericPairs(itemMatrix[leftIndex], itemMatrix[rightIndex]);
      const correlation = pearsonCorrelation(paired.left, paired.right);
      if (correlation != null) {
        correlations.push(correlation);
      }
    }
  }

  return correlations;
}

export function longestRun(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] === values[index - 1]) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}
