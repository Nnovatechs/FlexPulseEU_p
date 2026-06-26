import type { SubmittedSurveyAnswer } from "@/features/surveys/response-validation";
import {
  buildAnalyticsRecordForPersona,
  buildMapperProfilingSurveyFixture,
  type SyntheticPersona,
} from "./factory";

type ArchetypeKey =
  | "automation_ready"
  | "control_protective"
  | "price_optimizer"
  | "comfort_first"
  | "neutral"
  | "der_engaged"
  | "contradictory"
  | "partial_sparse";

type NumericAnswerPlan = {
  trustReliability1: number;
  trustReliability2: number;
  trustControlNegative: number;
  flexDelay: number;
  flexFrequencyNegative: number;
  comfortStrict: number;
  tariffSavings: number;
  tariffStability: number;
};

type ArchetypeDefinition = {
  key: ArchetypeKey;
  purpose: string;
  count: number;
  countryCode: string;
  submittedLanguage: string;
  center: NumericAnswerPlan;
  assetOptions: string[];
  assetProbability: number;
  missingRate: number;
  expectedBands: {
    trust: "low" | "medium" | "high";
    flexibility: "low" | "medium" | "high";
    comfort: "low" | "medium" | "high";
  };
};

export const syntheticCohortArchetypes: ArchetypeDefinition[] = [
  {
    key: "automation_ready",
    purpose: "High trust, high flexibility and low comfort rigidity.",
    count: 36,
    countryCode: "ES",
    submittedLanguage: "Spanish",
    center: {
      trustReliability1: 5,
      trustReliability2: 5,
      trustControlNegative: 1,
      flexDelay: 5,
      flexFrequencyNegative: 1,
      comfortStrict: 2,
      tariffSavings: 4,
      tariffStability: 3,
    },
    assetOptions: ["ev", "battery", "pv"],
    assetProbability: 0.7,
    missingRate: 0,
    expectedBands: { trust: "high", flexibility: "high", comfort: "low" },
  },
  {
    key: "control_protective",
    purpose: "Low trust, low flexibility and high need for direct control.",
    count: 34,
    countryCode: "HR",
    submittedLanguage: "Croatian",
    center: {
      trustReliability1: 2,
      trustReliability2: 2,
      trustControlNegative: 5,
      flexDelay: 2,
      flexFrequencyNegative: 5,
      comfortStrict: 5,
      tariffSavings: 2,
      tariffStability: 5,
    },
    assetOptions: [],
    assetProbability: 0,
    missingRate: 0,
    expectedBands: { trust: "low", flexibility: "low", comfort: "high" },
  },
  {
    key: "price_optimizer",
    purpose: "Savings-led profile with high flexibility and moderate trust.",
    count: 34,
    countryCode: "FR",
    submittedLanguage: "French",
    center: {
      trustReliability1: 3,
      trustReliability2: 3,
      trustControlNegative: 3,
      flexDelay: 5,
      flexFrequencyNegative: 2,
      comfortStrict: 3,
      tariffSavings: 5,
      tariffStability: 2,
    },
    assetOptions: ["heat_pump", "thermal_storage"],
    assetProbability: 0.45,
    missingRate: 0,
    expectedBands: { trust: "medium", flexibility: "high", comfort: "medium" },
  },
  {
    key: "comfort_first",
    purpose: "Comfort-protective household with low flexibility tolerance.",
    count: 34,
    countryCode: "IE",
    submittedLanguage: "English",
    center: {
      trustReliability1: 3,
      trustReliability2: 3,
      trustControlNegative: 4,
      flexDelay: 2,
      flexFrequencyNegative: 4,
      comfortStrict: 5,
      tariffSavings: 3,
      tariffStability: 4,
    },
    assetOptions: ["heat_pump"],
    assetProbability: 0.35,
    missingRate: 0,
    expectedBands: { trust: "medium", flexibility: "low", comfort: "high" },
  },
  {
    key: "neutral",
    purpose: "Neutral position with mid-scale answers and no strong behavioural pull.",
    count: 40,
    countryCode: "DE",
    submittedLanguage: "English",
    center: {
      trustReliability1: 3,
      trustReliability2: 3,
      trustControlNegative: 3,
      flexDelay: 3,
      flexFrequencyNegative: 3,
      comfortStrict: 3,
      tariffSavings: 3,
      tariffStability: 3,
    },
    assetOptions: ["pv", "heat_pump"],
    assetProbability: 0.25,
    missingRate: 0,
    expectedBands: { trust: "medium", flexibility: "medium", comfort: "medium" },
  },
  {
    key: "der_engaged",
    purpose: "Asset-rich DER users with high flexibility and practical familiarity.",
    count: 34,
    countryCode: "ES",
    submittedLanguage: "Spanish",
    center: {
      trustReliability1: 4,
      trustReliability2: 4,
      trustControlNegative: 2,
      flexDelay: 5,
      flexFrequencyNegative: 2,
      comfortStrict: 3,
      tariffSavings: 4,
      tariffStability: 3,
    },
    assetOptions: ["ev", "battery", "pv", "heat_pump"],
    assetProbability: 0.85,
    missingRate: 0,
    expectedBands: { trust: "high", flexibility: "high", comfort: "medium" },
  },
  {
    key: "contradictory",
    purpose: "Trusts reliability but reports discomfort with autonomous control.",
    count: 30,
    countryCode: "FR",
    submittedLanguage: "French",
    center: {
      trustReliability1: 5,
      trustReliability2: 5,
      trustControlNegative: 5,
      flexDelay: 5,
      flexFrequencyNegative: 5,
      comfortStrict: 4,
      tariffSavings: 5,
      tariffStability: 5,
    },
    assetOptions: ["ev", "battery"],
    assetProbability: 0.6,
    missingRate: 0,
    expectedBands: { trust: "high", flexibility: "medium", comfort: "high" },
  },
  {
    key: "partial_sparse",
    purpose: "Sparse responses used to check null handling and sample sizes.",
    count: 28,
    countryCode: "HR",
    submittedLanguage: "Croatian",
    center: {
      trustReliability1: 4,
      trustReliability2: 4,
      trustControlNegative: 2,
      flexDelay: 4,
      flexFrequencyNegative: 2,
      comfortStrict: 3,
      tariffSavings: 4,
      tariffStability: 3,
    },
    assetOptions: ["pv"],
    assetProbability: 0.3,
    missingRate: 0.45,
    expectedBands: { trust: "high", flexibility: "high", comfort: "medium" },
  },
];

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clampLikert(value: number) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function jitterLikert(center: number, seed: number, missingRate = 0) {
  if (seededUnit(seed + 101) < missingRate) {
    return undefined;
  }

  const jitter = seededUnit(seed) < 0.2 ? -1 : seededUnit(seed) > 0.8 ? 1 : 0;
  return clampLikert(center + jitter);
}

function selectAssets(
  options: string[],
  probability: number,
  index: number,
): string[] {
  return options.filter((_, optionIndex) => {
    const draw = seededUnit(index * 31 + optionIndex * 17 + 7);
    return draw <= probability;
  });
}

function addAnswer(
  answers: Record<string, SubmittedSurveyAnswer>,
  questionKey: string,
  value: number | undefined,
) {
  if (value != null) {
    answers[questionKey] = value;
  }
}

function buildAnswers(archetype: ArchetypeDefinition, index: number) {
  const seedBase = (index + 1) * 97;
  const answers: Record<string, SubmittedSurveyAnswer> = {};

  addAnswer(
    answers,
    "Q_TRUST_RELIABILITY_1",
    jitterLikert(archetype.center.trustReliability1, seedBase + 1, archetype.missingRate),
  );
  addAnswer(
    answers,
    "Q_TRUST_RELIABILITY_2",
    jitterLikert(archetype.center.trustReliability2, seedBase + 2, archetype.missingRate),
  );
  addAnswer(
    answers,
    "Q_TRUST_CONTROL_NEG",
    jitterLikert(archetype.center.trustControlNegative, seedBase + 3, archetype.missingRate),
  );
  addAnswer(
    answers,
    "Q_FLEX_DELAY",
    jitterLikert(archetype.center.flexDelay, seedBase + 4, archetype.missingRate),
  );
  addAnswer(
    answers,
    "Q_FLEX_FREQ_NEG",
    jitterLikert(archetype.center.flexFrequencyNegative, seedBase + 5, archetype.missingRate),
  );
  addAnswer(
    answers,
    "Q_COMFORT_STRICT",
    jitterLikert(archetype.center.comfortStrict, seedBase + 6, archetype.missingRate),
  );
  addAnswer(
    answers,
    "Q_TARIFF_SAVINGS",
    jitterLikert(archetype.center.tariffSavings, seedBase + 7, archetype.missingRate),
  );
  addAnswer(
    answers,
    "Q_TARIFF_STABILITY",
    jitterLikert(archetype.center.tariffStability, seedBase + 8, archetype.missingRate),
  );

  const assets = selectAssets(archetype.assetOptions, archetype.assetProbability, index);
  if (assets.length > 0 || archetype.missingRate === 0) {
    answers.Q_DER_ASSETS = assets;
  }

  return answers;
}

export function buildSyntheticCohortPersonas(): SyntheticPersona[] {
  return syntheticCohortArchetypes.flatMap((archetype) =>
    Array.from({ length: archetype.count }, (_, index) => ({
      id: `${archetype.key}_${String(index + 1).padStart(3, "0")}`,
      purpose: archetype.purpose,
      countryCode: archetype.countryCode,
      submittedLanguage: archetype.submittedLanguage,
      audienceToken: archetype.key,
      answers: buildAnswers(archetype, index),
      expectedProfile: {},
    })),
  );
}

export function buildSyntheticCohortDataset() {
  const survey = buildMapperProfilingSurveyFixture();
  const personas = buildSyntheticCohortPersonas();

  return {
    survey,
    personas,
    rows: personas.map((persona) => buildAnalyticsRecordForPersona(survey, persona)),
    archetypes: syntheticCohortArchetypes,
  };
}
