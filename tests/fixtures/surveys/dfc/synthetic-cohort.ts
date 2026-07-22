import type { MapperOutput } from "@/features/surveys/generator-types";
import {
  createDeclaredFlexibilityCapabilityBlueprintArtifact,
  DFC_INVENTORY_QUESTION_KEY,
  type DeclaredFlexibilityCapabilitySetKey,
} from "@/features/surveys/declared-flexibility-capability-module";
import { mapSurveyResponseToOutput } from "@/features/surveys/response-mapper";
import type { SubmittedSurveyAnswer } from "@/features/surveys/response-validation";
import type { SurveyAnalyticsRecord } from "@/features/surveys/survey-analytics";
import {
  buildDfcEvalSurveyFixture,
  DFC_EVAL_MAPPING_HASH,
  DFC_EVAL_MEASUREMENT_HASH,
  DFC_TRUST_QUESTION_KEY,
  DFC_WILLINGNESS_QUESTION_KEY,
} from "./survey";

/** Qualitative DFC expectation, including the non-applicable null state. */
export type DfcExpectedBand = "low" | "medium" | "high" | null;

/** Explicit asset/applicability condition used in the balanced DFC cohort. */
export type DfcCapabilityArchetype = {
  key:
    | "none_declared"
    | "not_sure_declared"
    | "single_ev_high"
    | "single_washer_low"
    | "multi_asset_medium";
  inventory: string[];
  setScores: Partial<Record<DeclaredFlexibilityCapabilitySetKey, number>>;
  expectedValue: number | null;
  expectedBand: DfcExpectedBand;
};

/** One respondent in the deterministic DFC compatibility cohort. */
export type DfcSyntheticPersona = {
  id: string;
  capabilityArchetype: DfcCapabilityArchetype["key"];
  trustBand: Exclude<DfcExpectedBand, null>;
  willingnessBand: Exclude<DfcExpectedBand, null>;
  answers: Record<string, SubmittedSurveyAnswer>;
  expectedCapabilityValue: number | null;
  expectedCapabilityBand: DfcExpectedBand;
};

/** Number of repetitions in each capability × trust × willingness cell. */
export const DFC_REPLICATES_PER_CELL = 6;

/** Exact respondent count required by the parallel DFC compatibility cohort. */
export const DFC_SYNTHETIC_COHORT_SIZE = 270;

/**
 * Five capability conditions crossed independently with three trust and three
 * willingness bands. Sentinel, single-asset and multi-asset paths are explicit.
 */
export const dfcCapabilityArchetypes: DfcCapabilityArchetype[] = [
  {
    key: "none_declared",
    inventory: ["none_of_these"],
    setScores: {},
    expectedValue: null,
    expectedBand: null,
  },
  {
    key: "not_sure_declared",
    inventory: ["not_sure"],
    setScores: {},
    expectedValue: null,
    expectedBand: null,
  },
  {
    key: "single_ev_high",
    inventory: ["ev"],
    setScores: { ev_charging: 5 },
    expectedValue: 5,
    expectedBand: "high",
  },
  {
    key: "single_washer_low",
    inventory: ["washing_machine"],
    setScores: { washing_machine_scheduling: 1 },
    expectedValue: 1,
    expectedBand: "low",
  },
  {
    key: "multi_asset_medium",
    inventory: ["ev", "heat_pump"],
    setScores: {
      ev_charging: 2,
      space_conditioning: 4,
    },
    expectedValue: 3,
    expectedBand: "medium",
  },
];

const INDEPENDENT_BANDS = [
  { band: "low", value: 1 },
  { band: "medium", value: 3 },
  { band: "high", value: 5 },
] as const;

function buildCapabilityAnswers(
  archetype: DfcCapabilityArchetype,
): Record<string, SubmittedSurveyAnswer> {
  const answers: Record<string, SubmittedSurveyAnswer> = {
    [DFC_INVENTORY_QUESTION_KEY]: [...archetype.inventory],
  };
  const blueprint = createDeclaredFlexibilityCapabilityBlueprintArtifact();

  for (const set of blueprint.sets) {
    const applies = set.triggering_assets.some((asset) =>
      archetype.inventory.includes(asset),
    );
    if (!applies) {
      continue;
    }

    const score = archetype.setScores[set.set_key];
    if (score == null) {
      throw new Error(`Missing explicit DFC score for ${set.set_key}.`);
    }
    for (const question of set.questions) {
      answers[question.question_key] = score;
    }
  }

  return answers;
}

/**
 * Materializes all 270 explicit synthetic respondents deterministically.
 */
export function buildDfcSyntheticCohortPersonas(): DfcSyntheticPersona[] {
  const personas = dfcCapabilityArchetypes.flatMap((capability) =>
    INDEPENDENT_BANDS.flatMap((trust) =>
      INDEPENDENT_BANDS.flatMap((willingness) =>
        Array.from({ length: DFC_REPLICATES_PER_CELL }, (_, replicaIndex) => ({
          id: [
            capability.key,
            `trust_${trust.band}`,
            `willingness_${willingness.band}`,
            String(replicaIndex + 1).padStart(2, "0"),
          ].join("__"),
          capabilityArchetype: capability.key,
          trustBand: trust.band,
          willingnessBand: willingness.band,
          answers: {
            [DFC_TRUST_QUESTION_KEY]: trust.value,
            [DFC_WILLINGNESS_QUESTION_KEY]: willingness.value,
            ...buildCapabilityAnswers(capability),
          },
          expectedCapabilityValue: capability.expectedValue,
          expectedCapabilityBand: capability.expectedBand,
        })),
      ),
    ),
  );

  if (personas.length !== DFC_SYNTHETIC_COHORT_SIZE) {
    throw new Error(
      `DFC cohort must contain ${DFC_SYNTHETIC_COHORT_SIZE} respondents.`,
    );
  }
  return personas;
}

/**
 * Maps one DFC synthetic persona through the production response mapper.
 */
export function mapDfcSyntheticPersona(
  persona: DfcSyntheticPersona,
): MapperOutput {
  const survey = buildDfcEvalSurveyFixture();
  return mapSurveyResponseToOutput({
    survey,
    answers: persona.answers,
    submittedLanguage: "English",
    countryCodeRaw: "es",
    mappingHashAtSubmission: DFC_EVAL_MAPPING_HASH,
    measurementHashAtSubmission: DFC_EVAL_MEASUREMENT_HASH,
    enrichment: null,
  });
}

/**
 * Builds the survey, personas and mapped analytics records as a parallel fixture.
 */
export function buildDfcSyntheticCohortDataset(): {
  survey: ReturnType<typeof buildDfcEvalSurveyFixture>;
  personas: DfcSyntheticPersona[];
  rows: SurveyAnalyticsRecord[];
} {
  const survey = buildDfcEvalSurveyFixture();
  const personas = buildDfcSyntheticCohortPersonas();
  const rows = personas.map((persona): SurveyAnalyticsRecord => ({
    response_id: `response_${persona.id}`,
    responded_at: "2026-07-21T10:00:00.000Z",
    audience_token: persona.capabilityArchetype,
    audience_label: persona.capabilityArchetype,
    mapper_output: mapSurveyResponseToOutput({
      survey,
      answers: persona.answers,
      submittedLanguage: "English",
      countryCodeRaw: "es",
      mappingHashAtSubmission: DFC_EVAL_MAPPING_HASH,
      measurementHashAtSubmission: DFC_EVAL_MEASUREMENT_HASH,
      enrichment: null,
    }),
    location_levels: [],
  }));

  return { survey, personas, rows };
}
