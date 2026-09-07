import { createHash } from "node:crypto";
import { DFC_INVENTORY_QUESTION_KEY, createDeclaredFlexibilityCapabilityBlueprintArtifact } from "@/features/surveys/declared-flexibility-capability-module";
import type { MapperOutput, PersistedSurvey } from "@/features/surveys/generator-types";
import { mapSurveyResponseToOutput, type ResponseEnrichmentRecord } from "@/features/surveys/response-mapper";
import type { SubmittedSurveyAnswer } from "@/features/surveys/response-validation";
import type { NormalizedLocationLevel } from "@/features/surveys/response-enrichment";
import {
  DASHBOARD_QA_COUNTRIES,
  DASHBOARD_QA_COUNTRY_RESPONSE_COUNT,
  DASHBOARD_QA_RESPONSE_COUNT,
  DASHBOARD_QA_VARIANTS_PER_ARCHETYPE,
  type DashboardQaCountryCode,
} from "./constants";
import { buildDashboardQaSurveyFixture } from "./survey-fixture";

export const DASHBOARD_QA_ARCHETYPE_KEYS = [
  "enabled_multi_asset_adopter",
  "willing_asset_limited",
  "capable_routine_constrained",
  "comfort_protective",
  "automation_sceptical",
  "explainability_seeking",
  "savings_led_dynamic_tariff",
  "bill_stability_risk_averse",
  "event_fatigue",
  "low_awareness_low_engagement",
] as const;

export type DashboardQaArchetypeKey = (typeof DASHBOARD_QA_ARCHETYPE_KEYS)[number];

type LikertCenters = {
  awareness_of_energy_systems: number;
  flexibility_willingness: number;
  thermal_comfort_norms: number;
  tariff_preference_orientation: number;
  trust_in_automation: number;
  der_engagement: number;
  manual_override_need: number;
  explainability_need: number;
  bill_stability_need: number;
  event_frequency_tolerance: number;
  savings_motivation: number;
  routine_dependency: number;
  dfc: number;
};

type ArchetypePlan = {
  key: DashboardQaArchetypeKey;
  assets: string[];
  interestedAssets: string[];
  winterSetpoint: number;
  summerSetpoint: number;
  tariffModel: "same_price" | "time_of_use" | "shift_rewards" | "dynamic_price" | "not_sure";
  centers: LikertCenters;
};

const ARCHETYPES: ArchetypePlan[] = [
  {
    key: "enabled_multi_asset_adopter",
    assets: ["washing_machine", "ev", "heat_pump", "hot_water_tank", "battery_storage", "pv_system"],
    interestedAssets: ["ev", "heat_pump", "battery_storage", "pv_system", "thermal_storage"],
    winterSetpoint: 19,
    summerSetpoint: 24,
    tariffModel: "shift_rewards",
    centers: {
      awareness_of_energy_systems: 5,
      flexibility_willingness: 5,
      thermal_comfort_norms: 2,
      tariff_preference_orientation: 5,
      trust_in_automation: 5,
      der_engagement: 5,
      manual_override_need: 2,
      explainability_need: 2,
      bill_stability_need: 2,
      event_frequency_tolerance: 5,
      savings_motivation: 4,
      routine_dependency: 2,
      dfc: 5,
    },
  },
  {
    key: "willing_asset_limited",
    assets: ["none_of_these"],
    interestedAssets: ["ev", "heat_pump"],
    winterSetpoint: 20,
    summerSetpoint: 25,
    tariffModel: "time_of_use",
    centers: {
      awareness_of_energy_systems: 4,
      flexibility_willingness: 5,
      thermal_comfort_norms: 3,
      tariff_preference_orientation: 4,
      trust_in_automation: 4,
      der_engagement: 2,
      manual_override_need: 3,
      explainability_need: 3,
      bill_stability_need: 3,
      event_frequency_tolerance: 4,
      savings_motivation: 4,
      routine_dependency: 2,
      dfc: 3,
    },
  },
  {
    key: "capable_routine_constrained",
    assets: ["washing_machine", "ev"],
    interestedAssets: ["ev", "washing_machine"],
    winterSetpoint: 20,
    summerSetpoint: 25,
    tariffModel: "time_of_use",
    centers: {
      awareness_of_energy_systems: 4,
      flexibility_willingness: 2,
      thermal_comfort_norms: 3,
      tariff_preference_orientation: 3,
      trust_in_automation: 3,
      der_engagement: 4,
      manual_override_need: 3,
      explainability_need: 3,
      bill_stability_need: 3,
      event_frequency_tolerance: 3,
      savings_motivation: 3,
      routine_dependency: 5,
      dfc: 4,
    },
  },
  {
    key: "comfort_protective",
    assets: ["heat_pump", "air_conditioning"],
    interestedAssets: ["heat_pump", "air_conditioning"],
    winterSetpoint: 17,
    summerSetpoint: 27,
    tariffModel: "same_price",
    centers: {
      awareness_of_energy_systems: 3,
      flexibility_willingness: 2,
      thermal_comfort_norms: 5,
      tariff_preference_orientation: 3,
      trust_in_automation: 3,
      der_engagement: 3,
      manual_override_need: 4,
      explainability_need: 3,
      bill_stability_need: 4,
      event_frequency_tolerance: 2,
      savings_motivation: 3,
      routine_dependency: 4,
      dfc: 3,
    },
  },
  {
    key: "automation_sceptical",
    assets: ["ev"],
    interestedAssets: ["ev"],
    winterSetpoint: 20,
    summerSetpoint: 25,
    tariffModel: "same_price",
    centers: {
      awareness_of_energy_systems: 3,
      flexibility_willingness: 3,
      thermal_comfort_norms: 3,
      tariff_preference_orientation: 3,
      trust_in_automation: 2,
      der_engagement: 3,
      manual_override_need: 5,
      explainability_need: 4,
      bill_stability_need: 3,
      event_frequency_tolerance: 3,
      savings_motivation: 3,
      routine_dependency: 3,
      dfc: 3,
    },
  },
  {
    key: "explainability_seeking",
    assets: ["washing_machine"],
    interestedAssets: ["washing_machine", "battery_storage"],
    winterSetpoint: 19,
    summerSetpoint: 24,
    tariffModel: "time_of_use",
    centers: {
      awareness_of_energy_systems: 4,
      flexibility_willingness: 3,
      thermal_comfort_norms: 3,
      tariff_preference_orientation: 3,
      trust_in_automation: 3,
      der_engagement: 3,
      manual_override_need: 3,
      explainability_need: 5,
      bill_stability_need: 3,
      event_frequency_tolerance: 3,
      savings_motivation: 3,
      routine_dependency: 3,
      dfc: 4,
    },
  },
  {
    key: "savings_led_dynamic_tariff",
    assets: ["battery_storage", "pv_system"],
    interestedAssets: ["battery_storage", "pv_system", "ev"],
    winterSetpoint: 18,
    summerSetpoint: 26,
    tariffModel: "dynamic_price",
    centers: {
      awareness_of_energy_systems: 4,
      flexibility_willingness: 4,
      thermal_comfort_norms: 3,
      tariff_preference_orientation: 5,
      trust_in_automation: 4,
      der_engagement: 4,
      manual_override_need: 2,
      explainability_need: 2,
      bill_stability_need: 2,
      event_frequency_tolerance: 4,
      savings_motivation: 5,
      routine_dependency: 2,
      dfc: 4,
    },
  },
  {
    key: "bill_stability_risk_averse",
    assets: ["hot_water_tank"],
    interestedAssets: ["hot_water_tank"],
    winterSetpoint: 21,
    summerSetpoint: 24,
    tariffModel: "same_price",
    centers: {
      awareness_of_energy_systems: 3,
      flexibility_willingness: 3,
      thermal_comfort_norms: 4,
      tariff_preference_orientation: 2,
      trust_in_automation: 3,
      der_engagement: 2,
      manual_override_need: 4,
      explainability_need: 3,
      bill_stability_need: 5,
      event_frequency_tolerance: 2,
      savings_motivation: 2,
      routine_dependency: 4,
      dfc: 3,
    },
  },
  {
    key: "event_fatigue",
    assets: ["washing_machine", "heat_pump"],
    interestedAssets: ["washing_machine"],
    winterSetpoint: 20,
    summerSetpoint: 25,
    tariffModel: "time_of_use",
    centers: {
      awareness_of_energy_systems: 3,
      flexibility_willingness: 3,
      thermal_comfort_norms: 3,
      tariff_preference_orientation: 3,
      trust_in_automation: 3,
      der_engagement: 3,
      manual_override_need: 3,
      explainability_need: 3,
      bill_stability_need: 3,
      event_frequency_tolerance: 1,
      savings_motivation: 3,
      routine_dependency: 4,
      dfc: 4,
    },
  },
  {
    key: "low_awareness_low_engagement",
    assets: ["none_of_these"],
    interestedAssets: ["none_of_these"],
    winterSetpoint: 20,
    summerSetpoint: 25,
    tariffModel: "not_sure",
    centers: {
      awareness_of_energy_systems: 2,
      flexibility_willingness: 2,
      thermal_comfort_norms: 3,
      tariff_preference_orientation: 2,
      trust_in_automation: 2,
      der_engagement: 1,
      manual_override_need: 4,
      explainability_need: 4,
      bill_stability_need: 4,
      event_frequency_tolerance: 2,
      savings_motivation: 2,
      routine_dependency: 4,
      dfc: 2,
    },
  },
];

const COUNTRY_LANGUAGE: Record<DashboardQaCountryCode, string> = {
  IE: "English",
  ES: "Spanish",
  FR: "French",
};

const COUNTRY_CENTROID: Record<DashboardQaCountryCode, { lat: number; lon: number }> = {
  IE: { lat: 53.35, lon: -6.26 },
  ES: { lat: 40.42, lon: -3.7 },
  FR: { lat: 48.86, lon: 2.35 },
};

export type DashboardQaSyntheticRecord = {
  id: string;
  archetypeKey: DashboardQaArchetypeKey;
  variant: number;
  countryCode: DashboardQaCountryCode;
  submittedLanguage: string;
  answers: Record<string, SubmittedSurveyAnswer>;
  mapperOutput: MapperOutput;
  enrichment: ResponseEnrichmentRecord;
  locationLevels: NormalizedLocationLevel[];
};

export type DashboardQaSyntheticDataset = {
  survey: PersistedSurvey;
  records: DashboardQaSyntheticRecord[];
};

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clampLikert(value: number) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function jitterLikert(center: number, seed: number) {
  const unit = seededUnit(seed);
  const delta = unit < 0.18 ? -1 : unit > 0.82 ? 1 : 0;
  return clampLikert(center + delta);
}

function countryShift(country: DashboardQaCountryCode, variant: number) {
  if (country === "ES" && variant % 4 === 0) {
    return 1;
  }
  if (country === "FR" && variant % 4 === 1) {
    return -1;
  }
  return 0;
}

function questionKeysForConcept(survey: PersistedSurvey, conceptKey: string) {
  return (
    survey.definition_json.survey_meta.measurement_plan_json?.concepts.find(
      (concept) => concept.concept_key === conceptKey,
    )?.question_keys ?? []
  );
}

function buildLikertAnswers(
  survey: PersistedSurvey,
  centers: LikertCenters,
  seedBase: number,
  country: DashboardQaCountryCode,
  variant: number,
) {
  const answers: Record<string, SubmittedSurveyAnswer> = {};
  const shift = countryShift(country, variant);
  const conceptCenters: Array<[keyof Omit<LikertCenters, "dfc">, number]> = [
    ["awareness_of_energy_systems", centers.awareness_of_energy_systems],
    ["flexibility_willingness", centers.flexibility_willingness],
    ["thermal_comfort_norms", centers.thermal_comfort_norms],
    ["tariff_preference_orientation", centers.tariff_preference_orientation],
    ["trust_in_automation", centers.trust_in_automation],
    ["der_engagement", centers.der_engagement],
    ["manual_override_need", centers.manual_override_need],
    ["explainability_need", centers.explainability_need],
    ["bill_stability_need", centers.bill_stability_need],
    ["event_frequency_tolerance", centers.event_frequency_tolerance],
    ["savings_motivation", centers.savings_motivation],
    ["routine_dependency", centers.routine_dependency],
  ];

  conceptCenters.forEach(([conceptKey, center], conceptIndex) => {
    const keys = questionKeysForConcept(survey, conceptKey);
    keys.forEach((questionKey, itemIndex) => {
      const extra = conceptKey === "savings_motivation" || conceptKey === "tariff_preference_orientation"
        ? shift
        : 0;
      answers[questionKey] = jitterLikert(
        center + extra,
        seedBase + conceptIndex * 17 + itemIndex * 3,
      );
    });
  });

  return answers;
}

function clampSetpoint(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function buildHouseholdAnswers(
  survey: PersistedSurvey,
  plan: ArchetypePlan,
  seedBase: number,
  variant: number,
) {
  const answers: Record<string, SubmittedSurveyAnswer> = {};
  const interestedKey = questionKeysForConcept(survey, "interested_der_assets")[0];
  const winterKey = questionKeysForConcept(survey, "winter_comfort_setpoint_c")[0];
  const summerKey = questionKeysForConcept(survey, "summer_comfort_setpoint_c")[0];
  const tariffKey = questionKeysForConcept(survey, "preferred_tariff_model")[0];
  const winterJitter = seededUnit(seedBase + 3) < 0.2 ? -1 : seededUnit(seedBase + 5) > 0.85 ? 1 : 0;
  const summerJitter = seededUnit(seedBase + 7) < 0.2 ? -1 : seededUnit(seedBase + 9) > 0.85 ? 1 : 0;
  const tariffShift = variant % 6 === 0 && plan.tariffModel === "dynamic_price" ? "shift_rewards" : plan.tariffModel;

  if (interestedKey) {
    answers[interestedKey] = plan.interestedAssets;
  }
  if (winterKey) {
    answers[winterKey] = clampSetpoint(plan.winterSetpoint + winterJitter, 14, 26);
  }
  if (summerKey) {
    answers[summerKey] = clampSetpoint(plan.summerSetpoint + summerJitter, 18, 32);
  }
  if (tariffKey) {
    answers[tariffKey] = tariffShift;
  }
  return answers;
}

function buildDfcAnswers(assets: string[], center: number, seedBase: number) {
  const answers: Record<string, SubmittedSurveyAnswer> = {
    [DFC_INVENTORY_QUESTION_KEY]: assets,
  };
  if (assets.includes("none_of_these") || assets.includes("not_sure")) {
    return answers;
  }

  const blueprint = createDeclaredFlexibilityCapabilityBlueprintArtifact();
  blueprint.sets.forEach((set, setIndex) => {
    const applicable = set.triggering_assets.some((asset) => assets.includes(asset));
    if (!applicable) {
      return;
    }
    set.questions.forEach((question, componentIndex) => {
      answers[question.question_key] = jitterLikert(
        center,
        seedBase + setIndex * 11 + componentIndex,
      );
    });
  });
  return answers;
}

function buildLocationLevels(
  country: DashboardQaCountryCode,
  recordId: string,
): NormalizedLocationLevel[] {
  const centroid = COUNTRY_CENTROID[country];
  return [
    { kind: "country", code: country, label: country, providerId: null, centroidLat: null, centroidLon: null },
    {
      kind: "region",
      code: `${country}:region:qa`,
      label: `${country} QA region`,
      providerId: null,
      centroidLat: centroid.lat,
      centroidLon: centroid.lon,
    },
    {
      kind: "city",
      code: `${country}:city:${recordId}`,
      label: `${country} QA city`,
      providerId: null,
      centroidLat: centroid.lat,
      centroidLon: centroid.lon,
    },
  ];
}

function buildEnrichment(
  country: DashboardQaCountryCode,
  recordId: string,
  locationLevels: NormalizedLocationLevel[],
): ResponseEnrichmentRecord {
  const centroid = COUNTRY_CENTROID[country];
  return {
    provider: "dashboard_qa_sandbox",
    normalized_country_code: country,
    location_agg_code: `${country}:city:${recordId}`,
    location_agg_label: `${country} QA city`,
    location_granularity: "city",
    centroid_lat: centroid.lat,
    centroid_lon: centroid.lon,
    normalized_location_json: {
      provider: "dashboard_qa_sandbox",
      levels: locationLevels,
    },
    temp_outdoor_c: country === "ES" ? 21 : country === "FR" ? 16 : 13,
    humidity_pct: 55,
    observed_at: "2026-05-08T10:00:00.000Z",
    quality_flag: "synthetic",
  };
}

export function deterministicDashboardQaUuid(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function buildDashboardQaSyntheticDataset(input: {
  surveyId: string;
  ownerUserId: string;
  createdAt?: string;
}): DashboardQaSyntheticDataset {
  const createdAt = input.createdAt ?? "2026-09-01T09:00:00.000Z";
  const survey = buildDashboardQaSurveyFixture({
    surveyId: input.surveyId,
    ownerUserId: input.ownerUserId,
    createdAt,
  });

  const records: DashboardQaSyntheticRecord[] = [];
  let index = 0;

  for (const country of DASHBOARD_QA_COUNTRIES) {
    for (const archetype of ARCHETYPES) {
      for (let variant = 0; variant < DASHBOARD_QA_VARIANTS_PER_ARCHETYPE; variant += 1) {
        const id = deterministicDashboardQaUuid(`dashboard-qa-v2:${input.surveyId}:r:${index}`);
        const seedBase = (index + 1) * 97;
        const answers = {
          ...buildLikertAnswers(survey, archetype.centers, seedBase, country, variant),
          ...buildHouseholdAnswers(survey, archetype, seedBase + 200, variant),
          ...buildDfcAnswers(archetype.assets, archetype.centers.dfc, seedBase + 400),
        };
        const locationLevels = buildLocationLevels(country, id);
        const enrichment = buildEnrichment(country, id, locationLevels);
        const mapperOutput = mapSurveyResponseToOutput({
          survey,
          answers,
          submittedLanguage: COUNTRY_LANGUAGE[country],
          countryCodeRaw: country.toLowerCase(),
          mappingHashAtSubmission: survey.mapping_hash,
          measurementHashAtSubmission: survey.measurement_hash ?? null,
          enrichment,
        });

        records.push({
          id,
          archetypeKey: archetype.key,
          variant,
          countryCode: country,
          submittedLanguage: COUNTRY_LANGUAGE[country],
          answers,
          mapperOutput,
          enrichment,
          locationLevels,
        });
        index += 1;
      }
    }
  }

  if (records.length !== DASHBOARD_QA_RESPONSE_COUNT) {
    throw new Error(`Dashboard QA dataset must contain ${DASHBOARD_QA_RESPONSE_COUNT} rows.`);
  }

  for (const country of DASHBOARD_QA_COUNTRIES) {
    const count = records.filter((record) => record.countryCode === country).length;
    if (count !== DASHBOARD_QA_COUNTRY_RESPONSE_COUNT) {
      throw new Error(`Dashboard QA dataset must contain ${DASHBOARD_QA_COUNTRY_RESPONSE_COUNT} ${country} rows.`);
    }
  }

  return { survey, records };
}
