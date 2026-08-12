export type OverviewBandKey = "high" | "medium" | "low";

export type OverviewConstructSemantics = {
  labels: Record<OverviewBandKey, string>;
  comparableHighShare: boolean;
};

const DEFAULT_CONSTRUCT_SEMANTICS: OverviewConstructSemantics = {
  labels: {
    high: "high",
    medium: "intermediate",
    low: "low",
  },
  comparableHighShare: true,
};

const CONSTRUCT_SEMANTICS: Record<string, OverviewConstructSemantics> = {
  flexibility_willingness: {
    labels: {
      high: "favourable",
      medium: "not clearly favourable",
      low: "unfavourable",
    },
    comparableHighShare: true,
  },
  trust_in_automation: {
    labels: {
      high: "confidence",
      medium: "unclear confidence",
      low: "distrust",
    },
    comparableHighShare: true,
  },
  awareness_of_energy_systems: {
    labels: {
      high: "high familiarity",
      medium: "intermediate familiarity",
      low: "low familiarity",
    },
    comparableHighShare: false,
  },
  declared_flexibility_capability: {
    labels: {
      high: "favourable",
      medium: "limited",
      low: "low declared capability",
    },
    comparableHighShare: true,
  },
  der_engagement: {
    labels: {
      high: "high engagement",
      medium: "intermediate engagement",
      low: "low engagement",
    },
    comparableHighShare: true,
  },
  thermal_comfort_norms: {
    labels: {
      high: "stricter",
      medium: "intermediate",
      low: "more permissive thermal norms",
    },
    comparableHighShare: false,
  },
  tariff_preference_orientation: {
    labels: {
      high: "acceptance",
      medium: "unclear acceptance",
      low: "rejection",
    },
    comparableHighShare: true,
  },
};

export function getOverviewConstructSemantics(conceptKey: string) {
  return CONSTRUCT_SEMANTICS[conceptKey] ?? DEFAULT_CONSTRUCT_SEMANTICS;
}

export function getOverviewBandLabel(conceptKey: string, band: OverviewBandKey) {
  return getOverviewConstructSemantics(conceptKey).labels[band];
}

export function getOverviewBandFromScore(score: number): OverviewBandKey {
  if (score >= 4) {
    return "high";
  }

  if (score <= 2) {
    return "low";
  }

  return "medium";
}
