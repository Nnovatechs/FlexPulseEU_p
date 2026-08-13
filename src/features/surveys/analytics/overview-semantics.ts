export type OverviewBandKey = "high" | "medium" | "low";

export type OverviewConstructSemantics = {
  description?: string;
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
    description:
      "Declared readiness to join or accept bounded household energy-flexibility actions, including appliance rescheduling, temporary temperature adjustments and changes to planned routines.",
    labels: {
      high: "favourable",
      medium: "not clearly favourable",
      low: "unfavourable",
    },
    comparableHighShare: true,
  },
  trust_in_automation: {
    description:
      "Readiness to rely on automated household energy control to perform suitable actions reliably, predictably and within stated operational boundaries.",
    labels: {
      high: "confidence",
      medium: "unclear confidence",
      low: "distrust",
    },
    comparableHighShare: true,
  },
  awareness_of_energy_systems: {
    description:
      "Self-reported familiarity with and understanding of how household energy flexibility works, including time-varying demand and prices, shiftable electricity use, system consequences and the scope of automation.",
    labels: {
      high: "high familiarity",
      medium: "intermediate familiarity",
      low: "low familiarity",
    },
    comparableHighShare: false,
  },
  declared_flexibility_capability: {
    description:
      "Self-reported practical and repeatable capacity to shift the operation of applicable household assets while preserving the services and routines the household needs.",
    labels: {
      high: "favourable",
      medium: "limited",
      low: "low declared capability",
    },
    comparableHighShare: true,
  },
  der_engagement: {
    description:
      "The household’s position along an engagement and adoption pathway for distributed-energy technologies and services, covering personal relevance, information seeking, adoption consideration and readiness to take a concrete next step.",
    labels: {
      high: "high engagement",
      medium: "intermediate engagement",
      low: "low engagement",
    },
    comparableHighShare: true,
  },
  thermal_comfort_norms: {
    description:
      "Personal expectations about maintaining a chosen indoor temperature, tolerating defined temperature deviations and returning to the chosen setting afterwards.",
    labels: {
      high: "stricter",
      medium: "intermediate",
      low: "more permissive thermal norms",
    },
    comparableHighShare: false,
  },
  tariff_preference_orientation: {
    description:
      "Declared acceptance of specified time-varying or flexibility-linked tariff arrangements, including fixed time-of-use periods, dynamic prices, conditional rewards and required planning effort.",
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
