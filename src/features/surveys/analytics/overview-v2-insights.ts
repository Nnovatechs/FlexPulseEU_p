import { pairwiseNumericPairs, spearmanCorrelation } from "@/features/surveys/analytics/instrument-health-stats";
import {
  findDominantPatternRecipe,
  findOpportunityDistributionRecipe,
  findRelationshipInsightRecipe,
} from "@/features/surveys/analytics/overview-insight-recipes";
import type { OverviewBandKey } from "@/features/surveys/analytics/overview-semantics";
import { OVERVIEW_SEMANTIC_INSIGHT_MIN_N } from "@/features/surveys/analytics/overview-v2-policy";
import type { QuadrantProfileViewDefinition, QuadrantSlot } from "@/features/surveys/analytics/overview-view-registry";
import type { SurveyAnalyticsRecord } from "@/features/surveys/survey-analytics";

export const OVERVIEW_INSIGHT_HEADER_NOTE =
  "Evidence-linked readings of this survey sample. They support investigation and decision design, but do not establish causal effects.";

export const OVERVIEW_SECTION_INTROS = {
  whatStandsOut: OVERVIEW_INSIGHT_HEADER_NOTE,
  flexibilityOpportunity:
    "A reading of the two main conditions for flexibility adoption in this sample: declared willingness and declared capability. Select one or more operational groups to compare their profiles on the remaining axes.",
  constructProfile:
    "How each measured construct is distributed in this sample: median, spread and the mix of semantic bands, always with the applicable n.",
  countryPulse:
    "The same constructs, summarised by country where the country sample is large enough to show without identifying respondents.",
} as const;

export const OVERVIEW_V2_INSIGHT_THRESHOLDS = {
  relationshipAbsRho: 0.3,
  relationshipMinN: OVERVIEW_SEMANTIC_INSIGHT_MIN_N,
  opportunityGap: 0.1,
  dominantShare: 0.6,
  dominantGap: 0.15,
  dominantMinN: OVERVIEW_SEMANTIC_INSIGHT_MIN_N,
  advancedSemanticsMinN: OVERVIEW_SEMANTIC_INSIGHT_MIN_N,
  maxInsights: 3,
  maxPerFamily: 1,
  maxPerConstruct: 2,
} as const;

export type OverviewV2InsightFamily =
  | "construct_relationship"
  | "opportunity_distribution"
  | "dominant_semantic_pattern";

export type OverviewV2Insight = {
  family: OverviewV2InsightFamily;
  title: string;
  statisticalSignal: string;
  meaning: string | null;
  decisionHypothesis: string | null;
  alternativeExplanation: string | null;
  conceptKeys: string[];
  evidenceN: number;
};

type InsightCandidate = OverviewV2Insight & {
  rank: number;
};

type ConstructInsightInput = {
  conceptKey: string;
  label: string;
  applicableN: number;
  bands: Array<{
    key: OverviewBandKey;
    label: string;
    share: number;
    count: number;
  }>;
};

type OpportunityInsightInput = {
  view: QuadrantProfileViewDefinition;
  applicableN: number;
  quadrants: Array<{
    slot: QuadrantSlot;
    key: string;
    label: string;
    count: number;
    share: number;
  }>;
};

export type BuildOverviewV2InsightsInput = {
  schemaNamespace: string;
  schemaVersion: number;
  rows: SurveyAnalyticsRecord[];
  constructs: ConstructInsightInput[];
  eligibleConceptKeys: string[];
  opportunity: OpportunityInsightInput | null;
};

function asNumericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getOverviewConceptValue(record: SurveyAnalyticsRecord, conceptKey: string) {
  return asNumericValue(record.mapper_output.profile[conceptKey]?.value);
}

function formatRho(value: number) {
  return value.toFixed(2);
}

function formatPercentPoints(value: number) {
  return `${Math.round(value * 100)}`;
}

function familyBaseRank(family: OverviewV2InsightFamily) {
  if (family === "construct_relationship") {
    return 100;
  }

  if (family === "opportunity_distribution") {
    return 90;
  }

  return 60;
}

function sampleBonus(n: number) {
  return Math.min(n, 80) / 80 * 20;
}

function recipeBonus(hasRecipe: boolean) {
  return hasRecipe ? 25 : 0;
}

function attachSemantics(
  candidate: Omit<InsightCandidate, "meaning" | "decisionHypothesis" | "alternativeExplanation" | "rank"> & {
    meaning: string | null;
    decisionHypothesis: string | null;
    alternativeExplanation: string | null;
    magnitude: number;
  },
): InsightCandidate {
  const hasRecipe = candidate.meaning != null;
  return {
    ...candidate,
    meaning: candidate.evidenceN >= OVERVIEW_V2_INSIGHT_THRESHOLDS.advancedSemanticsMinN ? candidate.meaning : null,
    decisionHypothesis:
      candidate.evidenceN >= OVERVIEW_V2_INSIGHT_THRESHOLDS.advancedSemanticsMinN
        ? candidate.decisionHypothesis
        : null,
    alternativeExplanation:
      candidate.evidenceN >= OVERVIEW_V2_INSIGHT_THRESHOLDS.advancedSemanticsMinN
        ? candidate.alternativeExplanation
        : null,
    rank:
      familyBaseRank(candidate.family) +
      candidate.magnitude * 50 +
      sampleBonus(candidate.evidenceN) +
      recipeBonus(hasRecipe),
  };
}

function buildRelationshipCandidates(input: BuildOverviewV2InsightsInput): InsightCandidate[] {
  const labels = new Map(input.constructs.map((construct) => [construct.conceptKey, construct.label]));
  const candidates: InsightCandidate[] = [];
  const keys = input.eligibleConceptKeys;

  for (let leftIndex = 0; leftIndex < keys.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < keys.length; rightIndex += 1) {
      const leftKey = keys[leftIndex];
      const rightKey = keys[rightIndex];
      const leftSeries = input.rows.map((row) => getOverviewConceptValue(row, leftKey));
      const rightSeries = input.rows.map((row) => getOverviewConceptValue(row, rightKey));
      const paired = pairwiseNumericPairs(leftSeries, rightSeries);
      if (paired.n < OVERVIEW_V2_INSIGHT_THRESHOLDS.relationshipMinN) {
        continue;
      }

      const rho = spearmanCorrelation(paired.left, paired.right);
      if (rho == null || Math.abs(rho) < OVERVIEW_V2_INSIGHT_THRESHOLDS.relationshipAbsRho) {
        continue;
      }

      const direction = rho >= 0 ? "positive" : "negative";
      const recipe = findRelationshipInsightRecipe({
        schemaNamespace: input.schemaNamespace,
        schemaVersion: input.schemaVersion,
        leftConceptKey: leftKey,
        rightConceptKey: rightKey,
        direction,
      });
      const leftLabel = labels.get(leftKey) ?? leftKey;
      const rightLabel = labels.get(rightKey) ?? rightKey;
      const title = recipe?.title ?? `${leftLabel} and ${rightLabel} are associated`;
      const signed = direction === "positive" ? "positively" : "negatively";

      candidates.push(
        attachSemantics({
          family: "construct_relationship",
          title,
          statisticalSignal: `${leftLabel} was ${signed} associated with ${rightLabel}: Spearman’s ρ = ${formatRho(rho)}, matched n=${paired.n}.`,
          meaning: recipe?.meaning ?? null,
          decisionHypothesis: recipe?.decisionHypothesis ?? null,
          alternativeExplanation: recipe?.alternativeExplanation ?? null,
          conceptKeys: [leftKey, rightKey],
          evidenceN: paired.n,
          magnitude: Math.abs(rho),
        }),
      );
    }
  }

  return candidates;
}

function buildOpportunityCandidates(
  input: BuildOverviewV2InsightsInput,
): InsightCandidate[] {
  const opportunity = input.opportunity;
  if (!opportunity || opportunity.applicableN < OVERVIEW_V2_INSIGHT_THRESHOLDS.advancedSemanticsMinN) {
    return [];
  }

  const sorted = opportunity.quadrants
    .slice()
    .sort((left, right) => right.share - left.share || right.count - left.count);
  const [top, second] = sorted;
  const candidates: InsightCandidate[] = [];

  if (top && second && top.share - second.share >= OVERVIEW_V2_INSIGHT_THRESHOLDS.opportunityGap) {
    const recipe = findOpportunityDistributionRecipe({
      schemaNamespace: input.schemaNamespace,
      schemaVersion: input.schemaVersion,
      viewKey: opportunity.view.key,
      pattern: "dominant",
      slot: top.slot,
    });
    candidates.push(
      attachSemantics({
        family: "opportunity_distribution",
        title: recipe?.title ?? `${top.label} is the largest group`,
        statisticalSignal: `${formatPercentPoints(top.share)}% of applicable respondents are in ${top.label.toLowerCase()}, ${formatPercentPoints(top.share - second.share)} percentage points above the next group; applicable n=${opportunity.applicableN}.`,
        meaning: recipe?.meaning ?? null,
        decisionHypothesis: recipe?.decisionHypothesis ?? null,
        alternativeExplanation: recipe?.alternativeExplanation ?? null,
        conceptKeys: [opportunity.view.yAxis.conceptKey, opportunity.view.xAxis.conceptKey],
        evidenceN: opportunity.applicableN,
        magnitude: top.share - second.share,
      }),
    );
  }

  const highLow = opportunity.quadrants.find((quadrant) => quadrant.slot === "highLow");
  const lowHigh = opportunity.quadrants.find((quadrant) => quadrant.slot === "lowHigh");
  if (highLow && lowHigh) {
    const gap = highLow.share - lowHigh.share;
    if (Math.abs(gap) >= OVERVIEW_V2_INSIGHT_THRESHOLDS.opportunityGap) {
      const asymmetricDirection = gap >= 0 ? "highY_lowX" : "lowY_highX";
      const recipe = findOpportunityDistributionRecipe({
        schemaNamespace: input.schemaNamespace,
        schemaVersion: input.schemaVersion,
        viewKey: opportunity.view.key,
        pattern: "asymmetric",
        asymmetricDirection,
      });
      const larger = gap >= 0 ? highLow : lowHigh;
      const smaller = gap >= 0 ? lowHigh : highLow;
      candidates.push(
        attachSemantics({
          family: "opportunity_distribution",
          title: recipe?.title ?? "Opportunity groups are asymmetric",
          statisticalSignal: `${formatPercentPoints(larger.share)}% of applicable respondents report ${larger.label.toLowerCase()}, compared with ${formatPercentPoints(smaller.share)}% reporting ${smaller.label.toLowerCase()}; difference ${formatPercentPoints(Math.abs(gap))} percentage points, applicable n=${opportunity.applicableN}.`,
          meaning: recipe?.meaning ?? null,
          decisionHypothesis: recipe?.decisionHypothesis ?? null,
          alternativeExplanation: recipe?.alternativeExplanation ?? null,
          conceptKeys: [opportunity.view.yAxis.conceptKey, opportunity.view.xAxis.conceptKey],
          evidenceN: opportunity.applicableN,
          magnitude: Math.abs(gap),
        }),
      );
    }
  }

  return candidates;
}

function buildDominantPatternCandidates(input: BuildOverviewV2InsightsInput): InsightCandidate[] {
  return input.constructs.flatMap((construct) => {
    if (construct.applicableN < OVERVIEW_V2_INSIGHT_THRESHOLDS.dominantMinN) {
      return [];
    }

    const ordered = construct.bands.slice().sort((left, right) => right.share - left.share);
    const [top, second] = ordered;
    if (!top || top.share < OVERVIEW_V2_INSIGHT_THRESHOLDS.dominantShare) {
      return [];
    }

    const gap = top.share - (second?.share ?? 0);
    if (gap < OVERVIEW_V2_INSIGHT_THRESHOLDS.dominantGap) {
      return [];
    }

    const recipe = findDominantPatternRecipe({
      schemaNamespace: input.schemaNamespace,
      schemaVersion: input.schemaVersion,
      conceptKey: construct.conceptKey,
      band: top.key,
    });
    if (!recipe) {
      return [];
    }

    return [
      attachSemantics({
        family: "dominant_semantic_pattern",
        title: recipe.title,
        statisticalSignal: `${formatPercentPoints(top.share)}% of respondents fall in the ${top.label} band for ${construct.label.toLowerCase()}; n=${construct.applicableN}.`,
        meaning: recipe.meaning,
        decisionHypothesis: recipe.decisionHypothesis,
        alternativeExplanation: recipe.alternativeExplanation,
        conceptKeys: [construct.conceptKey],
        evidenceN: construct.applicableN,
        magnitude: gap,
      }),
    ];
  });
}

function selectInsights(candidates: InsightCandidate[]): OverviewV2Insight[] {
  const selected: InsightCandidate[] = [];
  const familyCount = new Map<OverviewV2InsightFamily, number>();
  const constructCount = new Map<string, number>();

  for (const candidate of candidates.slice().sort((left, right) => right.rank - left.rank)) {
    if (selected.length >= OVERVIEW_V2_INSIGHT_THRESHOLDS.maxInsights) {
      break;
    }

    if ((familyCount.get(candidate.family) ?? 0) >= OVERVIEW_V2_INSIGHT_THRESHOLDS.maxPerFamily) {
      continue;
    }

    const wouldExceedConstruct = candidate.conceptKeys.some(
      (conceptKey) => (constructCount.get(conceptKey) ?? 0) >= OVERVIEW_V2_INSIGHT_THRESHOLDS.maxPerConstruct,
    );
    if (wouldExceedConstruct) {
      continue;
    }

    selected.push(candidate);
    familyCount.set(candidate.family, (familyCount.get(candidate.family) ?? 0) + 1);
    for (const conceptKey of candidate.conceptKeys) {
      constructCount.set(conceptKey, (constructCount.get(conceptKey) ?? 0) + 1);
    }
  }

  return selected.map((candidate) => ({
    family: candidate.family,
    title: candidate.title,
    statisticalSignal: candidate.statisticalSignal,
    meaning: candidate.meaning,
    decisionHypothesis: candidate.decisionHypothesis,
    alternativeExplanation: candidate.alternativeExplanation,
    conceptKeys: candidate.conceptKeys,
    evidenceN: candidate.evidenceN,
  }));
}

export function buildOverviewV2Insights(input: BuildOverviewV2InsightsInput): OverviewV2Insight[] {
  return selectInsights([
    ...buildRelationshipCandidates(input),
    ...buildOpportunityCandidates(input),
    ...buildDominantPatternCandidates(input),
  ]);
}
