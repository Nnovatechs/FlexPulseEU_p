import { FLEXPULSE_BEHAVIOURAL_SCHEMA_NAMESPACE } from "@/features/ontology/flexpulse-behavioural-schema";
import type { QuadrantSlot } from "@/features/surveys/analytics/overview-view-registry";
import type { OverviewBandKey } from "@/features/surveys/analytics/overview-semantics";

export type RelationshipInsightRecipe = {
  schemaNamespace: string;
  schemaVersion: number;
  leftConceptKey: string;
  rightConceptKey: string;
  direction: "positive" | "negative";
  title: string;
  meaning: string;
  decisionHypothesis: string;
  alternativeExplanation: string;
};

export type OpportunityDistributionRecipe = {
  schemaNamespace: string;
  schemaVersion: number;
  viewKey: string;
  pattern: "dominant" | "asymmetric";
  slot?: QuadrantSlot;
  asymmetricDirection?: "highY_lowX" | "lowY_highX";
  title: string;
  meaning: string;
  decisionHypothesis: string;
  alternativeExplanation: string;
};

export type DominantPatternRecipe = {
  schemaNamespace: string;
  schemaVersion: number;
  conceptKey: string;
  band: OverviewBandKey;
  title: string;
  meaning: string;
  decisionHypothesis: string;
  alternativeExplanation: string;
};

const NS = FLEXPULSE_BEHAVIOURAL_SCHEMA_NAMESPACE;
const VIEW = "flexpulse_willingness_dfc_v1";

export const RELATIONSHIP_INSIGHT_RECIPES: RelationshipInsightRecipe[] = [
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    leftConceptKey: "trust_in_automation",
    rightConceptKey: "flexibility_willingness",
    direction: "positive",
    title: "Trust and willingness move together",
    meaning:
      "Respondents who report greater confidence in automated energy control also tend to report greater willingness to participate in flexibility actions.",
    decisionHypothesis:
      "Programme variants that make control, predictability, household limits and override options explicit are reasonable candidates to test.",
    alternativeExplanation:
      "The association may partly reflect a general positive response tendency. It does not demonstrate that increasing trust will cause willingness to rise.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    leftConceptKey: "awareness_of_energy_systems",
    rightConceptKey: "flexibility_willingness",
    direction: "positive",
    title: "Awareness and willingness move together",
    meaning:
      "Respondents who report greater familiarity with household energy flexibility also tend to report greater willingness to accept flexibility actions.",
    decisionHypothesis:
      "It is reasonable to inspect how self-reported familiarity sits alongside other programme-relevant terms in this sample. The association alone does not show that awareness messaging is sufficient, exhausted, or should stop.",
    alternativeExplanation:
      "Awareness is self-reported. Shared wording about energy actions may contribute to the association. It does not show that raising awareness would cause willingness to increase.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    leftConceptKey: "thermal_comfort_norms",
    rightConceptKey: "flexibility_willingness",
    direction: "negative",
    title: "Stricter thermal norms sit with lower willingness",
    meaning:
      "Respondents with stricter expectations about preserving their chosen temperature also tended to report lower willingness to accept flexibility actions.",
    decisionHypothesis:
      "Appliance-based flexibility or narrower thermal interventions may be more suitable to test with this group than broader temperature-control programmes.",
    alternativeExplanation:
      "Flexibility willingness includes a thermal scenario, so part of the association may reflect shared scenario content. The result does not show that changing comfort expectations would cause willingness to increase.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    leftConceptKey: "tariff_preference_orientation",
    rightConceptKey: "flexibility_willingness",
    direction: "positive",
    title: "Tariff acceptance and willingness move together",
    meaning:
      "Respondents more accepting of time-varying or flexibility-linked tariffs also tend to report greater willingness to take flexibility actions.",
    decisionHypothesis:
      "Offers that keep tariff rules and household effort explicit are reasonable variants to test with this sample.",
    alternativeExplanation:
      "Both constructs ask about accepting change in household energy arrangements. The association does not show that changing a tariff would raise willingness.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    leftConceptKey: "der_engagement",
    rightConceptKey: "flexibility_willingness",
    direction: "positive",
    title: "DER engagement and willingness move together",
    meaning:
      "Respondents further along an adoption path for distributed-energy technologies also tend to report greater willingness to participate in flexibility actions.",
    decisionHypothesis:
      "It is reasonable to test whether households already considering DER offers respond differently to flexibility programmes than households earlier on that path.",
    alternativeExplanation:
      "Engagement and willingness may both capture a general openness to energy-system change. The association is not evidence that promoting DER adoption would raise willingness.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    leftConceptKey: "declared_flexibility_capability",
    rightConceptKey: "flexibility_willingness",
    direction: "positive",
    title: "Declared capability and willingness move together",
    meaning:
      "Respondents who report more practical capacity to shift applicable household assets also tend to report greater willingness to take flexibility actions.",
    decisionHypothesis:
      "Where capability is limited, examining asset access, scheduling control and service-preservation constraints is a reasonable next step before treating participation as mainly an attitude problem.",
    alternativeExplanation:
      "Overall DFC combines the modules applicable to each household. Asset composition can contribute to the association, and it does not show that raising capability would cause willingness to rise.",
  },
];

export const OPPORTUNITY_DISTRIBUTION_RECIPES: OpportunityDistributionRecipe[] = [
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    viewKey: VIEW,
    pattern: "asymmetric",
    asymmetricDirection: "highY_lowX",
    title: "Limited capability is the more common one-sided gap",
    meaning:
      "Favourable willingness with limited declared capability is the most frequent unilateral imbalance in this sample.",
    decisionHypothesis:
      "Asset access, scheduling control and service-preservation constraints are reasonable areas to examine before treating participation as primarily an awareness or persuasion problem.",
    alternativeExplanation:
      "Overall DFC combines the modules applicable to each household. Asset composition can contribute to this pattern.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    viewKey: VIEW,
    pattern: "asymmetric",
    asymmetricDirection: "lowY_highX",
    title: "Lower willingness is the more common one-sided gap",
    meaning:
      "Favourable declared capability with lower willingness is the most frequent unilateral imbalance in this sample.",
    decisionHypothesis:
      "Control, predictability, household limits and the terms of requested actions are reasonable areas to examine before treating the gap as an asset or scheduling problem.",
    alternativeExplanation:
      "Willingness items include specific trade-offs. A cautious response to those scenarios can sit alongside a higher declared capability score.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    viewKey: VIEW,
    pattern: "dominant",
    slot: "highHigh",
    title: "Favourable willingness and capability concentrate",
    meaning:
      "A large share of applicable respondents report both favourable willingness and favourable declared capability.",
    decisionHypothesis:
      "This sample is a reasonable place to examine how those households differ from the remaining groups on other profile axes, rather than treating participation as uniformly constrained.",
    alternativeExplanation:
      "The pattern describes this sample. It does not show that these households would take up a live programme.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    viewKey: VIEW,
    pattern: "dominant",
    slot: "highLow",
    title: "Favourable willingness with limited capability concentrates",
    meaning:
      "A large share of applicable respondents report favourable willingness while declared capability remains limited.",
    decisionHypothesis:
      "Practical constraints around applicable assets and service preservation are reasonable areas to inspect before treating this group as ready to participate.",
    alternativeExplanation:
      "Overall DFC depends on the modules that apply to each household. Asset mix can produce this concentration.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    viewKey: VIEW,
    pattern: "dominant",
    slot: "lowHigh",
    title: "Favourable capability with lower willingness concentrates",
    meaning:
      "A large share of applicable respondents report practical capacity while declared willingness remains lower.",
    decisionHypothesis:
      "The terms of requested actions, control and household limits are reasonable areas to inspect before treating this as an asset-access problem.",
    alternativeExplanation:
      "Willingness scores reflect specific survey scenarios. They are not observed programme take-up.",
  },
];

export const DOMINANT_PATTERN_RECIPES: DominantPatternRecipe[] = [
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    conceptKey: "awareness_of_energy_systems",
    band: "high",
    title: "High self-reported awareness is widespread",
    meaning:
      "Basic familiarity with time-varying energy demand and household flexibility is already common in this sample.",
    decisionHypothesis:
      "Future research may obtain more information by testing applied understanding or programme trade-offs than by repeating basic awareness messages.",
    alternativeExplanation:
      "Awareness is self-reported and some items represent relatively familiar concepts. It is not a demonstrated knowledge test.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    conceptKey: "trust_in_automation",
    band: "high",
    title: "Declared trust in automation is widespread",
    meaning:
      "Most respondents in this sample report confidence in automated household energy control within stated boundaries.",
    decisionHypothesis:
      "It is reasonable to test whether making override, predictability and household limits explicit still changes stated willingness in a sample that already reports high trust.",
    alternativeExplanation:
      "Trust is self-reported and does not demonstrate how people would respond to a live automated system.",
  },
  {
    schemaNamespace: NS,
    schemaVersion: 1,
    conceptKey: "thermal_comfort_norms",
    band: "high",
    title: "Stricter thermal norms are widespread",
    meaning:
      "Most respondents in this sample report stricter expectations about preserving a chosen indoor temperature.",
    decisionHypothesis:
      "Narrower or non-thermal flexibility options are reasonable candidates to test before assuming broad temperature-control programmes will fit this sample.",
    alternativeExplanation:
      "A high thermal score means stricter norms, not a better outcome. It does not show how people would behave in a live thermal event.",
  },
];

function samePair(left: string, right: string, recipe: RelationshipInsightRecipe) {
  return (
    (recipe.leftConceptKey === left && recipe.rightConceptKey === right) ||
    (recipe.leftConceptKey === right && recipe.rightConceptKey === left)
  );
}

export function findRelationshipInsightRecipe(input: {
  schemaNamespace: string;
  schemaVersion: number;
  leftConceptKey: string;
  rightConceptKey: string;
  direction: "positive" | "negative";
}) {
  return (
    RELATIONSHIP_INSIGHT_RECIPES.find(
      (recipe) =>
        recipe.schemaNamespace === input.schemaNamespace &&
        recipe.schemaVersion === input.schemaVersion &&
        recipe.direction === input.direction &&
        samePair(input.leftConceptKey, input.rightConceptKey, recipe),
    ) ?? null
  );
}

export function findOpportunityDistributionRecipe(input: {
  schemaNamespace: string;
  schemaVersion: number;
  viewKey: string;
  pattern: "dominant" | "asymmetric";
  slot?: QuadrantSlot;
  asymmetricDirection?: "highY_lowX" | "lowY_highX";
}) {
  return (
    OPPORTUNITY_DISTRIBUTION_RECIPES.find((recipe) => {
      if (
        recipe.schemaNamespace !== input.schemaNamespace ||
        recipe.schemaVersion !== input.schemaVersion ||
        recipe.viewKey !== input.viewKey ||
        recipe.pattern !== input.pattern
      ) {
        return false;
      }

      if (recipe.pattern === "dominant") {
        return recipe.slot === input.slot;
      }

      return recipe.asymmetricDirection === input.asymmetricDirection;
    }) ?? null
  );
}

export function findDominantPatternRecipe(input: {
  schemaNamespace: string;
  schemaVersion: number;
  conceptKey: string;
  band: OverviewBandKey;
}) {
  return (
    DOMINANT_PATTERN_RECIPES.find(
      (recipe) =>
        recipe.schemaNamespace === input.schemaNamespace &&
        recipe.schemaVersion === input.schemaVersion &&
        recipe.conceptKey === input.conceptKey &&
        recipe.band === input.band,
    ) ?? null
  );
}
