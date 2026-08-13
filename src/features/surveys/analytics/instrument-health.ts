import { getFlexpulseBehaviouralConcept } from "@/features/ontology/flexpulse-behavioural-schema";
import {
  ADVANCED_MODEL_ROWS,
  DFC_COMPONENT_LABELS,
  DFC_MODULE_LABELS,
  INSTRUMENT_HEALTH_ANALYSIS_VERSION,
  INSTRUMENT_HEALTH_CONCENTRATION_SHARE,
  INSTRUMENT_HEALTH_LOW_ITEM_TOTAL,
  INSTRUMENT_HEALTH_LOW_SPREAD_SD,
  INSTRUMENT_HEALTH_LOW_DIFFERENTIATION_SD,
  INSTRUMENT_HEALTH_OVERLAP_RHO,
  INSTRUMENT_HEALTH_SCORE_TOLERANCE,
  MULTILINGUAL_INVARIANCE_NOTE,
  buildItemFlag,
  getAlphaReading,
  getConstructDirectionNote,
  getConstructInterpretation,
  getInstrumentMeasurementRole,
  getMeasurementRoleLabel,
  type InstrumentHealthItemFlag,
  type InstrumentMeasurementRole,
  type ItemPolarity,
} from "@/features/surveys/analytics/instrument-health-semantics";
import {
  alignItemScore,
  alphaIfItemDeleted,
  averageInterItemCorrelation,
  bootstrapAlphaCi,
  buildNumericDescriptives,
  computeHtmt,
  correctedItemTotalCorrelations,
  cronbachAlpha,
  longestRun,
  pairwiseNumericPairs,
  pearsonCorrelation,
  sampleSd,
  spearmanCorrelation,
  type NumericDescriptives,
} from "@/features/surveys/analytics/instrument-health-stats";
import {
  getOverviewBandFromScore,
  getOverviewBandLabel,
  getOverviewConstructSemantics,
  type OverviewBandKey,
} from "@/features/surveys/analytics/overview-semantics";
import {
  DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
  DFC_COMPONENT_COUNT,
  type DeclaredFlexibilityCapabilitySetKey,
} from "@/features/surveys/declared-flexibility-capability-module";
import type {
  MapperOutput,
  MeasurementPlanEntry,
  PersistedSurvey,
  SurveyQuestionDefinition,
} from "@/features/surveys/generator-types";
import { compileMappingContract } from "@/features/surveys/generator-mapping";
import { isQuestionVisible, orderSurveyQuestions } from "@/features/surveys/question-visibility";
import { mapSurveyResponseToOutput } from "@/features/surveys/response-mapper";
import type { SubmittedSurveyAnswer } from "@/features/surveys/response-validation";

export type InstrumentHealthLikertBin = {
  value: number;
  count: number;
  share: number;
};

export type InstrumentHealthItemAnalysis = {
  questionKey: string;
  title: string;
  facet: string | null;
  polarity: ItemPolarity | "missing";
  reverseScored: boolean;
  eligibleN: number;
  answeredN: number;
  missingN: number;
  missingRate: number | null;
  scaleMin: number | null;
  scaleMax: number | null;
  likertBins: InstrumentHealthLikertBin[] | null;
  descriptives: NumericDescriptives;
  correctedItemTotal: number | null;
  alphaIfDeleted: number | null;
  deltaAlpha: number | null;
  flags: InstrumentHealthItemFlag[];
};

export type InstrumentHealthReliability = {
  status: "computed" | "not_applicable" | "not_computable";
  interpretive: boolean;
  reason: string | null;
  alpha: number | null;
  secondaryAlpha: number | null;
  alphaCi95: {
    lower: number | null;
    upper: number | null;
    validReplicates: number;
    requestedReplicates: number;
  } | null;
  completeCaseN: number;
  itemCount: number;
  averageInterItemCorrelation: number | null;
  itemTotalRange: { min: number; max: number } | null;
  omegaOrdinal: "not_computed";
  reading: string | null;
};

export type InstrumentHealthConstruct = {
  conceptKey: string;
  label: string;
  description: string | null;
  role: InstrumentMeasurementRole;
  roleLabel: string;
  validN: number;
  applicableN: number;
  itemCount: number;
  scoreDescriptives: NumericDescriptives;
  bands: Array<{
    key: OverviewBandKey;
    label: string;
    count: number;
    share: number;
  }>;
  reliability: InstrumentHealthReliability;
  itemFlagCount: number;
  interpretation: string;
  directionNote: string | null;
  items: InstrumentHealthItemAnalysis[];
};

export type InstrumentHealthCorrelationCell = {
  rowConceptKey: string;
  columnConceptKey: string;
  spearmanRho: number | null;
  pearsonR: number | null;
  n: number;
  overlapFlag: boolean;
};

export type InstrumentHealthHtmtCell = {
  conceptKeyA: string;
  conceptKeyB: string;
  value: number | null;
  status: "computed" | "not_computable";
  reason: string | null;
};

export type InstrumentHealthDfcFacet = {
  component: string;
  label: string;
  questionKey: string;
  descriptives: NumericDescriptives;
  likertBins: InstrumentHealthLikertBin[] | null;
  missingWithinApplicableN: number;
};

export type InstrumentHealthDfcModule = {
  setKey: string;
  label: string;
  applicableN: number;
  applicableShare: number;
  notApplicableN: number;
  expectedFacets: number;
  evidenceCount: number | null;
  scoreDescriptives: NumericDescriptives;
  facets: InstrumentHealthDfcFacet[];
  missingWithinApplicableN: number;
};

export type InstrumentHealthResponsePatterns = {
  identicalRatingItems: { n: number; share: number };
  lowWithinPersonSd: {
    n: number;
    share: number;
    threshold: number;
  };
  longestSameResponseRun: {
    median: number | null;
    p90: number | null;
    max: number | null;
    n: number;
  };
  straightliningByConstruct: Array<{
    conceptKey: string;
    label: string;
    n: number;
    share: number;
    completeCaseN: number;
  }>;
};

export type InstrumentHealthScope = {
  key: string;
  label: string;
  n: number;
  languageCode: string | null;
  constructs: InstrumentHealthConstruct[];
  correlations: InstrumentHealthCorrelationCell[];
  htmt: InstrumentHealthHtmtCell[];
  dfc: {
    modules: InstrumentHealthDfcModule[];
    applicableModuleCountDistribution: Array<{
      modules: number;
      n: number;
      share: number;
    }>;
  } | null;
  responsePatterns: InstrumentHealthResponsePatterns;
};

export type InstrumentHealthDebrief = {
  feedbackN: number;
  coverageShare: number | null;
  questionSetVersions: Array<{ version: string; n: number }>;
  ease: NumericDescriptives & { likertBins: InstrumentHealthLikertBin[] };
  textFieldsReceivedN: number;
};

export type InstrumentHealthData = {
  analysisVersion: string;
  generatedAt: string;
  cacheKey: string;
  context: {
    collectedN: number;
    readyN: number;
    includedN: number;
    currentMeasurementHash: string | null;
    currentMappingHash: string | null;
    excludedDifferentHashN: number;
    unknownHashN: number;
    languages: Array<{ code: string; n: number }>;
    itemCount: number;
    mapperVersions: string[];
  };
  integrity: {
    mappingGapN: number;
    scoringMismatchN: number;
    invalidNumericAnswerN: number;
    missingRequiredAnswerN: number;
    missingPolarityN: number;
    status: "consistent" | "review_required" | "not_evaluable";
  };
  scopes: Record<string, InstrumentHealthScope>;
  defaultScopeKey: string;
  advancedValidation: {
    status: "not_configured";
    display: "Not run";
  };
  multilingual: {
    languageCount: number;
    invarianceNote: string;
    advancedModels: typeof ADVANCED_MODEL_ROWS;
  };
  debrief: InstrumentHealthDebrief | null;
};

export type InstrumentHealthLoadedResponse = {
  pipelineStatus: string;
  submittedLanguage: string;
  measurementHashAtSubmission: string | null;
  mappingHashAtSubmission: string | null;
  answers: Record<string, SubmittedSurveyAnswer> | null;
  persistedOutput: MapperOutput | null;
};

export type InstrumentHealthFeedbackRecord = {
  easeRating: number;
  questionSetVersion: string;
  textFieldFilledCount: number;
};

export type InstrumentHealthSource = {
  survey: PersistedSurvey;
  responses: InstrumentHealthLoadedResponse[];
  feedback: InstrumentHealthFeedbackRecord[];
};

type PreparedItem = {
  question: SurveyQuestionDefinition;
  concept: MeasurementPlanEntry;
  intent: MeasurementPlanEntry["question_intents"] extends Array<infer T> | undefined
    ? T | undefined
    : never;
  polarity: ItemPolarity | "missing";
  scaleMin: number | null;
  scaleMax: number | null;
};

type IncludedResponse = {
  answers: Record<string, SubmittedSurveyAnswer>;
  submittedLanguage: string;
  persistedOutput: MapperOutput | null;
  recomputedOutput: MapperOutput | null;
};

const DFC_SET_KEYS: DeclaredFlexibilityCapabilitySetKey[] = [
  "washing_machine_scheduling",
  "ev_charging",
  "space_conditioning",
  "water_heating",
  "battery_operation",
];

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left == null && right == null) {
    return true;
  }

  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) <= INSTRUMENT_HEALTH_SCORE_TOLERANCE;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

function profileValuesMatch(
  recomputed: MapperOutput["profile"],
  persisted: MapperOutput["profile"] | undefined,
) {
  if (!persisted) {
    return false;
  }

  const keys = new Set([...Object.keys(recomputed), ...Object.keys(persisted)]);
  for (const key of keys) {
    if (!valuesEqual(recomputed[key]?.value ?? null, persisted[key]?.value ?? null)) {
      return false;
    }
  }

  return true;
}

function isLikertQuestion(question: SurveyQuestionDefinition) {
  return question.type === "rating_scale" && question.scale != null;
}

function asFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scaleBounds(question: SurveyQuestionDefinition, mappingMin: number | null, mappingMax: number | null) {
  return {
    min: mappingMin ?? question.scale?.min ?? null,
    max: mappingMax ?? question.scale?.max ?? null,
  };
}

function questionTitle(
  survey: PersistedSurvey,
  questionKey: string,
  languageCode: string | null,
) {
  const language = languageCode ?? survey.default_language;
  return (
    survey.definition_json.translations[language]?.questions[questionKey]?.title ??
    survey.definition_json.translations[survey.default_language]?.questions[questionKey]?.title ??
    questionKey
  );
}

function mappingBounds(survey: PersistedSurvey, questionKey: string) {
  const compiled = survey.mapping_compiled_json ?? compileMappingContract(survey.mapping_contract_json);
  const strategy = compiled.by_question_key[questionKey]?.transform_strategy;
  if (strategy?.kind !== "numeric_range") {
    return { min: null as number | null, max: null as number | null };
  }

  return {
    min: typeof strategy.min === "number" ? strategy.min : null,
    max: typeof strategy.max === "number" ? strategy.max : null,
  };
}

function prepareItems(survey: PersistedSurvey, concepts: MeasurementPlanEntry[]) {
  const questionsByKey = new Map(
    survey.definition_json.questions.map((question) => [question.question_key, question]),
  );
  const items: PreparedItem[] = [];

  for (const concept of concepts) {
    for (const questionKey of concept.question_keys) {
      const question = questionsByKey.get(questionKey);
      if (!question) {
        continue;
      }

      const intent = concept.question_intents?.find((entry) => entry.question_key === questionKey);
      const bounds = mappingBounds(survey, questionKey);
      const scale = scaleBounds(question, bounds.min, bounds.max);
      items.push({
        question,
        concept,
        intent,
        polarity: intent?.polarity ?? "missing",
        scaleMin: scale.min,
        scaleMax: scale.max,
      });
    }
  }

  return items;
}

function countBy<T>(values: T[], keyFn: (value: T) => string) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = keyFn(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function likertBins(values: number[], min: number, max: number): InstrumentHealthLikertBin[] {
  const size = Math.round(max - min) + 1;
  if (size < 2 || size > 11) {
    return [];
  }

  return Array.from({ length: size }, (_, index) => {
    const value = min + index;
    const count = values.filter((entry) => entry === value).length;
    return {
      value,
      count,
      share: values.length === 0 ? 0 : count / values.length,
    };
  });
}

function extractCompleteCases(rows: Array<Array<number | null>>) {
  if (rows.length === 0) {
    return [] as number[][];
  }

  const itemCount = rows[0].length;
  return rows.filter(
    (row) => row.length === itemCount && row.every((value) => value != null),
  ) as number[][];
}

function itemFlagList(input: {
  descriptives: NumericDescriptives;
  correctedItemTotal: number | null;
  interpretive: boolean;
}): InstrumentHealthItemFlag[] {
  const flags: InstrumentHealthItemFlag[] = [];
  const { descriptives } = input;

  if (descriptives.n > 0 && descriptives.sd === 0) {
    flags.push(buildItemFlag("zero_variance", "All valid answers are identical."));
  }

  if (
    descriptives.topTwoShare != null &&
    descriptives.topTwoShare >= INSTRUMENT_HEALTH_CONCENTRATION_SHARE
  ) {
    flags.push(
      buildItemFlag(
        "top_two_concentration",
        `${Math.round(descriptives.topTwoShare * 100)}% of valid answers are 4 or 5.`,
      ),
    );
  }

  if (
    descriptives.bottomTwoShare != null &&
    descriptives.bottomTwoShare >= INSTRUMENT_HEALTH_CONCENTRATION_SHARE
  ) {
    flags.push(
      buildItemFlag(
        "bottom_two_concentration",
        `${Math.round(descriptives.bottomTwoShare * 100)}% of valid answers are 1 or 2.`,
      ),
    );
  }

  if (
    descriptives.sd != null &&
    descriptives.sd > 0 &&
    descriptives.sd < INSTRUMENT_HEALTH_LOW_SPREAD_SD
  ) {
    flags.push(buildItemFlag("low_spread", `Sample SD is ${descriptives.sd.toFixed(2)}.`));
  }

  if (
    input.interpretive &&
    input.correctedItemTotal != null &&
    input.correctedItemTotal < INSTRUMENT_HEALTH_LOW_ITEM_TOTAL
  ) {
    flags.push(
      buildItemFlag("low_item_total", `Corrected item-total is ${input.correctedItemTotal.toFixed(2)}.`),
    );
  }

  if (
    (descriptives.floorShare != null && descriptives.floorShare > 0.15) ||
    (descriptives.ceilingShare != null && descriptives.ceilingShare > 0.15)
  ) {
    const floor = descriptives.floorShare == null ? "n/a" : `${Math.round(descriptives.floorShare * 100)}%`;
    const ceiling =
      descriptives.ceilingShare == null ? "n/a" : `${Math.round(descriptives.ceilingShare * 100)}%`;
    flags.push(
      buildItemFlag("endpoint_concentration", `Exact floor ${floor}; exact ceiling ${ceiling}.`),
    );
  }

  return flags;
}

function emptyReliability(reason: string, interpretive: boolean, itemCount: number, completeCaseN = 0): InstrumentHealthReliability {
  return {
    status: "not_applicable",
    interpretive,
    reason,
    alpha: null,
    secondaryAlpha: null,
    alphaCi95: null,
    completeCaseN,
    itemCount,
    averageInterItemCorrelation: null,
    itemTotalRange: null,
    omegaOrdinal: "not_computed",
    reading: reason,
  };
}

function buildReliability(input: {
  role: InstrumentMeasurementRole;
  completeCases: number[][];
  seedKey: string;
}): InstrumentHealthReliability {
  const itemCount = input.completeCases[0]?.length ?? 0;
  const completeCaseN = input.completeCases.length;
  const interpretive = input.role === "reflective_candidate";

  if (input.role === "conditional_module") {
    return emptyReliability("Not a reflective scale. DFC is never given a global alpha.", false, itemCount, completeCaseN);
  }

  if (input.role === "not_applicable") {
    return emptyReliability("Outside consistency analysis.", false, itemCount, completeCaseN);
  }

  if (itemCount < 2) {
    return emptyReliability("Reliability not applicable to a single item.", interpretive, itemCount, completeCaseN);
  }

  const alphaResult = cronbachAlpha(input.completeCases);
  const citc = correctedItemTotalCorrelations(input.completeCases).filter(
    (value): value is number => value != null,
  );
  const itemTotalRange =
    citc.length > 0
      ? { min: Math.min(...citc), max: Math.max(...citc) }
      : null;
  const average = averageInterItemCorrelation(input.completeCases);

  if (alphaResult.status !== "computed") {
    return {
      status: "not_computable",
      interpretive,
      reason: alphaResult.reason,
      alpha: null,
      secondaryAlpha: null,
      alphaCi95: null,
      completeCaseN,
      itemCount,
      averageInterItemCorrelation: average,
      itemTotalRange,
      omegaOrdinal: "not_computed",
      reading: alphaResult.reason,
    };
  }

  const ci = interpretive
    ? bootstrapAlphaCi({ completeCases: input.completeCases, seedKey: input.seedKey })
    : null;

  const reading = interpretive
    ? getAlphaReading(alphaResult.alpha)
    : "Internal consistency is not a pass/fail criterion for this measure.";

  return {
    status: interpretive ? "computed" : "not_applicable",
    interpretive,
    reason: interpretive ? null : "Not a reflective scale",
    alpha: interpretive ? alphaResult.alpha : null,
    secondaryAlpha: interpretive ? null : alphaResult.alpha,
    alphaCi95: ci,
    completeCaseN,
    itemCount,
    averageInterItemCorrelation: average,
    itemTotalRange,
    omegaOrdinal: "not_computed",
    reading,
  };
}

function numericAnswer(
  answers: Record<string, SubmittedSurveyAnswer>,
  questionKey: string,
) {
  return asFiniteNumber(answers[questionKey]);
}

function isOutOfRange(value: number, min: number | null, max: number | null) {
  if (min != null && value < min) {
    return true;
  }

  if (max != null && value > max) {
    return true;
  }

  return false;
}

function buildConstruct(
  survey: PersistedSurvey,
  concept: MeasurementPlanEntry,
  responses: IncludedResponse[],
  items: PreparedItem[],
  languageCode: string | null,
  seedKey: string,
): InstrumentHealthConstruct {
  const role = getInstrumentMeasurementRole(concept.concept_key);
  const ontology = getFlexpulseBehaviouralConcept(concept.concept_key);
  const semantics = getOverviewConstructSemantics(concept.concept_key);
  const constructItems = items.filter((item) => item.concept.concept_key === concept.concept_key);
  const ratingItems = constructItems.filter((item) => isLikertQuestion(item.question));
  const scores: number[] = [];
  const alignedRows: Array<Array<number | null>> = [];

  for (const response of responses) {
    const score = asFiniteNumber(response.recomputedOutput?.profile[concept.concept_key]?.value
      ?? response.persistedOutput?.profile[concept.concept_key]?.value);
    if (score != null) {
      scores.push(score);
    }

    alignedRows.push(
      ratingItems.map((item) => {
        if (!isQuestionVisible(item.question, response.answers)) {
          return null;
        }

        const raw = numericAnswer(response.answers, item.question.question_key);
        if (raw == null || item.scaleMin == null || item.scaleMax == null || item.polarity === "missing") {
          return null;
        }

        return alignItemScore(raw, item.scaleMin, item.scaleMax, item.polarity);
      }),
    );
  }

  const completeCases = extractCompleteCases(alignedRows);
  const reliability = buildReliability({
    role,
    completeCases,
    seedKey: `${seedKey}:${concept.concept_key}`,
  });
  const deletedAlphas = alphaIfItemDeleted(completeCases);
  const citc = correctedItemTotalCorrelations(completeCases);
  const fullAlpha = reliability.alpha ?? reliability.secondaryAlpha;
  const scale = { min: 1, max: 5 };
  const scoreDescriptives = buildNumericDescriptives(scores, scale);
  const bandCounts = new Map<OverviewBandKey, number>();
  for (const score of scores) {
    const band = getOverviewBandFromScore(score);
    bandCounts.set(band, (bandCounts.get(band) ?? 0) + 1);
  }

  const itemAnalyses: InstrumentHealthItemAnalysis[] = ratingItems.map((item, itemIndex) => {
    const eligibleValues: number[] = [];
    let eligibleN = 0;

    for (const response of responses) {
      if (!isQuestionVisible(item.question, response.answers)) {
        continue;
      }

      eligibleN += 1;
      const raw = numericAnswer(response.answers, item.question.question_key);
      if (raw != null && (item.scaleMin == null || item.scaleMax == null || !isOutOfRange(raw, item.scaleMin, item.scaleMax))) {
        eligibleValues.push(raw);
      }
    }

    const descriptives = buildNumericDescriptives(
      eligibleValues,
      item.scaleMin != null && item.scaleMax != null
        ? { min: item.scaleMin, max: item.scaleMax }
        : null,
    );
    const corrected = citc[itemIndex] ?? null;
    const alphaWithout = deletedAlphas[itemIndex] ?? null;
    const missingN = eligibleN - eligibleValues.length;
    const missingRate = eligibleN === 0 ? null : missingN / eligibleN;
    const flags = itemFlagList({
      descriptives,
      correctedItemTotal: role === "reflective_candidate" ? corrected : null,
      interpretive: role === "reflective_candidate",
    });

    return {
      questionKey: item.question.question_key,
      title: questionTitle(survey, item.question.question_key, languageCode),
      facet: item.intent?.facet ?? null,
      polarity: item.polarity,
      reverseScored: item.polarity === "negative",
      eligibleN,
      answeredN: eligibleValues.length,
      missingN,
      missingRate,
      scaleMin: item.scaleMin,
      scaleMax: item.scaleMax,
      likertBins:
        item.scaleMin != null && item.scaleMax != null
          ? likertBins(eligibleValues, item.scaleMin, item.scaleMax)
          : null,
      descriptives,
      correctedItemTotal: role === "reflective_candidate" ? corrected : null,
      alphaIfDeleted: role === "reflective_candidate" ? alphaWithout : null,
      deltaAlpha:
        role === "reflective_candidate" && fullAlpha != null && alphaWithout != null
          ? alphaWithout - fullAlpha
          : null,
      flags,
    };
  });

  const itemFlagCount = itemAnalyses.reduce((sum, item) => sum + item.flags.length, 0);

  return {
    conceptKey: concept.concept_key,
    label: ontology?.label ?? concept.concept_key,
    description: semantics.description ?? ontology?.description ?? null,
    role,
    roleLabel: getMeasurementRoleLabel(role),
    validN: completeCases.length,
    applicableN: scores.length,
    itemCount: ratingItems.length,
    scoreDescriptives,
    bands: (["high", "medium", "low"] as const).map((band) => ({
      key: band,
      label: getOverviewBandLabel(concept.concept_key, band),
      count: bandCounts.get(band) ?? 0,
      share: scores.length === 0 ? 0 : (bandCounts.get(band) ?? 0) / scores.length,
    })),
    reliability,
    itemFlagCount,
    interpretation: getConstructInterpretation({
      role,
      itemFlagCount,
      itemCount: ratingItems.length,
    }),
    directionNote: getConstructDirectionNote(concept.concept_key),
    items: itemAnalyses,
  };
}

function buildCorrelations(constructs: InstrumentHealthConstruct[], responses: IncludedResponse[]) {
  const scored = constructs.filter((construct) => construct.role !== "not_applicable");
  const cells: InstrumentHealthCorrelationCell[] = [];

  for (const row of scored) {
    for (const column of scored) {
      if (row.conceptKey === column.conceptKey) {
        cells.push({
          rowConceptKey: row.conceptKey,
          columnConceptKey: column.conceptKey,
          spearmanRho: 1,
          pearsonR: 1,
          n: row.applicableN,
          overlapFlag: false,
        });
        continue;
      }

      const left = responses.map((response) =>
        asFiniteNumber(
          response.recomputedOutput?.profile[row.conceptKey]?.value
            ?? response.persistedOutput?.profile[row.conceptKey]?.value,
        ),
      );
      const right = responses.map((response) =>
        asFiniteNumber(
          response.recomputedOutput?.profile[column.conceptKey]?.value
            ?? response.persistedOutput?.profile[column.conceptKey]?.value,
        ),
      );
      const paired = pairwiseNumericPairs(left, right);
      const rho = spearmanCorrelation(paired.left, paired.right);
      cells.push({
        rowConceptKey: row.conceptKey,
        columnConceptKey: column.conceptKey,
        spearmanRho: rho,
        pearsonR: pearsonCorrelation(paired.left, paired.right),
        n: paired.n,
        overlapFlag: rho != null && Math.abs(rho) >= INSTRUMENT_HEALTH_OVERLAP_RHO,
      });
    }
  }

  return cells;
}

function buildHtmt(constructs: InstrumentHealthConstruct[], responses: IncludedResponse[], items: PreparedItem[]) {
  const reflective = constructs.filter(
    (construct) => construct.role === "reflective_candidate" && construct.itemCount >= 2,
  );
  const cells: InstrumentHealthHtmtCell[] = [];

  for (let leftIndex = 0; leftIndex < reflective.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < reflective.length; rightIndex += 1) {
      const left = reflective[leftIndex];
      const right = reflective[rightIndex];
      const leftItems = items.filter(
        (item) => item.concept.concept_key === left.conceptKey && isLikertQuestion(item.question),
      );
      const rightItems = items.filter(
        (item) => item.concept.concept_key === right.conceptKey && isLikertQuestion(item.question),
      );
      const leftMatrix = leftItems.map((item) =>
        responses.map((response) => {
          const raw = numericAnswer(response.answers, item.question.question_key);
          if (raw == null || item.scaleMin == null || item.scaleMax == null || item.polarity === "missing") {
            return null;
          }
          return alignItemScore(raw, item.scaleMin, item.scaleMax, item.polarity);
        }),
      );
      const rightMatrix = rightItems.map((item) =>
        responses.map((response) => {
          const raw = numericAnswer(response.answers, item.question.question_key);
          if (raw == null || item.scaleMin == null || item.scaleMax == null || item.polarity === "missing") {
            return null;
          }
          return alignItemScore(raw, item.scaleMin, item.scaleMax, item.polarity);
        }),
      );
      const result = computeHtmt(leftMatrix, rightMatrix);
      cells.push({
        conceptKeyA: left.conceptKey,
        conceptKeyB: right.conceptKey,
        value: result.value,
        status: result.status,
        reason: result.reason,
      });
    }
  }

  return cells;
}

function dfcQuestionsForSet(
  items: PreparedItem[],
  setKey: string,
) {
  return items.filter(
    (item) =>
      item.concept.concept_key === DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY &&
      item.intent?.facet === setKey,
  );
}

function buildDfc(responses: IncludedResponse[], items: PreparedItem[]) {
  const dfcItems = items.filter(
    (item) => item.concept.concept_key === DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
  );
  if (dfcItems.length === 0) {
    return null;
  }

  const modules: InstrumentHealthDfcModule[] = DFC_SET_KEYS.map((setKey) => {
    const setItems = dfcQuestionsForSet(items, setKey);
    let applicableN = 0;
    let missingWithinApplicableN = 0;
    const scores: number[] = [];
    const facetValues = new Map<string, number[]>();
    const facetMissing = new Map<string, number>();

    for (const response of responses) {
      const applicable = setItems.some((item) => isQuestionVisible(item.question, response.answers));
      if (!applicable) {
        continue;
      }

      applicableN += 1;
      const values: number[] = [];
      for (const item of setItems) {
        const raw = numericAnswer(response.answers, item.question.question_key);
        if (raw == null) {
          facetMissing.set(item.question.question_key, (facetMissing.get(item.question.question_key) ?? 0) + 1);
          continue;
        }

        values.push(raw);
        const current = facetValues.get(item.question.question_key) ?? [];
        current.push(raw);
        facetValues.set(item.question.question_key, current);
      }

      if (values.length < DFC_COMPONENT_COUNT) {
        missingWithinApplicableN += 1;
      }

      if (values.length === DFC_COMPONENT_COUNT) {
        scores.push(values.reduce((sum, value) => sum + value, 0) / DFC_COMPONENT_COUNT);
      }
    }

    return {
      setKey,
      label: DFC_MODULE_LABELS[setKey] ?? setKey,
      applicableN,
      applicableShare: responses.length === 0 ? 0 : applicableN / responses.length,
      notApplicableN: responses.length - applicableN,
      expectedFacets: DFC_COMPONENT_COUNT,
      evidenceCount: scores.length === 0 ? null : DFC_COMPONENT_COUNT,
      scoreDescriptives: buildNumericDescriptives(scores, { min: 1, max: 5 }),
      facets: setItems.map((item) => {
        const values = facetValues.get(item.question.question_key) ?? [];
        return {
          component: item.intent?.slot_key ?? item.question.question_key,
          label: DFC_COMPONENT_LABELS[item.intent?.slot_key?.split("_").slice(-2).join("_") ?? ""]
            ?? item.intent?.intent
            ?? item.question.question_key,
          questionKey: item.question.question_key,
          descriptives: buildNumericDescriptives(values, { min: 1, max: 5 }),
          likertBins: likertBins(values, 1, 5),
          missingWithinApplicableN: facetMissing.get(item.question.question_key) ?? 0,
        };
      }),
      missingWithinApplicableN,
    };
  });

  const moduleCounts = responses.map((response) =>
    DFC_SET_KEYS.filter((setKey) =>
      dfcQuestionsForSet(items, setKey).some((item) => isQuestionVisible(item.question, response.answers)),
    ).length,
  );
  const distributionCounts = countBy(moduleCounts, (value) => String(value));
  const applicableModuleCountDistribution = Array.from(distributionCounts.entries())
    .map(([modules, n]) => ({
      modules: Number(modules),
      n,
      share: responses.length === 0 ? 0 : n / responses.length,
    }))
    .sort((left, right) => left.modules - right.modules);

  return { modules, applicableModuleCountDistribution };
}

function buildResponsePatterns(
  survey: PersistedSurvey,
  responses: IncludedResponse[],
  constructs: InstrumentHealthConstruct[],
) {
  const orderedQuestions = orderSurveyQuestions(survey.definition_json.questions).filter(isLikertQuestion);
  let identicalN = 0;
  let lowSdN = 0;
  const runs: number[] = [];
  const ratedResponseN = responses.length;

  for (const response of responses) {
    const visibleRatings = orderedQuestions
      .filter((question) => isQuestionVisible(question, response.answers))
      .map((question) => numericAnswer(response.answers, question.question_key))
      .filter((value): value is number => value != null);

    if (visibleRatings.length >= 2 && visibleRatings.every((value) => value === visibleRatings[0])) {
      identicalN += 1;
    }

    const sd = sampleSd(visibleRatings);
    if (visibleRatings.length >= 2 && sd != null && sd < INSTRUMENT_HEALTH_LOW_DIFFERENTIATION_SD) {
      lowSdN += 1;
    }

    if (visibleRatings.length > 0) {
      runs.push(longestRun(visibleRatings));
    }
  }

  const runDescriptives = buildNumericDescriptives(runs);
  const sortedRuns = [...runs].sort((left, right) => left - right);

  return {
    identicalRatingItems: {
      n: identicalN,
      share: ratedResponseN === 0 ? 0 : identicalN / ratedResponseN,
    },
    lowWithinPersonSd: {
      n: lowSdN,
      share: ratedResponseN === 0 ? 0 : lowSdN / ratedResponseN,
      threshold: INSTRUMENT_HEALTH_LOW_DIFFERENTIATION_SD,
    },
    longestSameResponseRun: {
      median: runDescriptives.median,
      p90: sortedRuns.length === 0 ? null : sortedRuns[Math.min(sortedRuns.length - 1, Math.floor(0.9 * (sortedRuns.length - 1)))],
      max: runDescriptives.max,
      n: runs.length,
    },
    straightliningByConstruct: constructs
      .filter((construct) => construct.role === "reflective_candidate" && construct.itemCount >= 2)
      .map((construct) => {
        let n = 0;
        let completeCaseN = 0;
        for (const response of responses) {
          const values = construct.items
            .map((item) => numericAnswer(response.answers, item.questionKey))
            .filter((value): value is number => value != null);
          if (values.length < 2) {
            continue;
          }

          completeCaseN += 1;
          if (values.every((value) => value === values[0])) {
            n += 1;
          }
        }

        return {
          conceptKey: construct.conceptKey,
          label: construct.label,
          n,
          share: completeCaseN === 0 ? 0 : n / completeCaseN,
          completeCaseN,
        };
      }),
  };
}

function buildDebrief(feedback: InstrumentHealthFeedbackRecord[], includedN: number): InstrumentHealthDebrief | null {
  if (feedback.length === 0) {
    return null;
  }

  const easeValues = feedback.map((entry) => entry.easeRating);
  const versions = Array.from(countBy(feedback, (entry) => entry.questionSetVersion).entries())
    .map(([version, n]) => ({ version, n }))
    .sort((left, right) => right.n - left.n);

  return {
    feedbackN: feedback.length,
    coverageShare: includedN === 0 ? null : feedback.length / includedN,
    questionSetVersions: versions,
    ease: {
      ...buildNumericDescriptives(easeValues, { min: 1, max: 5 }),
      likertBins: likertBins(easeValues, 1, 5),
    },
    textFieldsReceivedN: feedback.reduce((sum, entry) => sum + entry.textFieldFilledCount, 0),
  };
}

function buildScope(input: {
  key: string;
  label: string;
  languageCode: string | null;
  survey: PersistedSurvey;
  concepts: MeasurementPlanEntry[];
  items: PreparedItem[];
  responses: IncludedResponse[];
  seedKey: string;
}): InstrumentHealthScope {
  const constructs = input.concepts
    .filter((concept) => getInstrumentMeasurementRole(concept.concept_key) !== "not_applicable")
    .map((concept) =>
      buildConstruct(
        input.survey,
        concept,
        input.responses,
        input.items,
        input.languageCode,
        input.seedKey,
      ),
    );

  return {
    key: input.key,
    label: input.label,
    n: input.responses.length,
    languageCode: input.languageCode,
    constructs,
    correlations: buildCorrelations(constructs, input.responses),
    htmt: buildHtmt(constructs, input.responses, input.items),
    dfc: buildDfc(input.responses, input.items),
    responsePatterns: buildResponsePatterns(input.survey, input.responses, constructs),
  };
}

export function buildInstrumentHealthData(source: InstrumentHealthSource): InstrumentHealthData {
  const generatedAt = new Date().toISOString();
  const survey = source.survey;
  const currentMeasurementHash = survey.measurement_hash ?? null;
  const currentMappingHash = survey.mapping_hash ?? null;
  const collectedN = source.responses.length;
  const readyResponses = source.responses.filter((response) => response.pipelineStatus === "ready");
  const readyN = readyResponses.length;
  const excludedDifferentHashN = source.responses.filter((response) => {
    const hash = response.measurementHashAtSubmission;
    return hash != null && currentMeasurementHash != null && hash !== currentMeasurementHash;
  }).length;
  const unknownHashN = source.responses.filter((response) => {
    return currentMeasurementHash != null && response.measurementHashAtSubmission == null;
  }).length;

  const measurementPlan = survey.definition_json.survey_meta.measurement_plan_json;
  const cacheKey = [
    survey.id,
    currentMeasurementHash ?? "",
    currentMappingHash ?? "",
    INSTRUMENT_HEALTH_ANALYSIS_VERSION,
  ].join(":");

  if (!measurementPlan) {
    return {
      analysisVersion: INSTRUMENT_HEALTH_ANALYSIS_VERSION,
      generatedAt,
      cacheKey,
      context: {
        collectedN,
        readyN,
        includedN: 0,
        currentMeasurementHash,
        currentMappingHash,
        excludedDifferentHashN,
        unknownHashN,
        languages: [],
        itemCount: 0,
        mapperVersions: [],
      },
      integrity: {
        mappingGapN: collectedN - readyResponses.filter((response) => response.persistedOutput).length,
        scoringMismatchN: 0,
        invalidNumericAnswerN: 0,
        missingRequiredAnswerN: 0,
        missingPolarityN: 0,
        status: "not_evaluable",
      },
      scopes: {
        overall: {
          key: "overall",
          label: "Overall",
          n: 0,
          languageCode: null,
          constructs: [],
          correlations: [],
          htmt: [],
          dfc: null,
          responsePatterns: {
            identicalRatingItems: { n: 0, share: 0 },
            lowWithinPersonSd: { n: 0, share: 0, threshold: INSTRUMENT_HEALTH_LOW_DIFFERENTIATION_SD },
            longestSameResponseRun: { median: null, p90: null, max: null, n: 0 },
            straightliningByConstruct: [],
          },
        },
      },
      defaultScopeKey: "overall",
      advancedValidation: { status: "not_configured", display: "Not run" },
      multilingual: {
        languageCount: 0,
        invarianceNote: MULTILINGUAL_INVARIANCE_NOTE,
        advancedModels: ADVANCED_MODEL_ROWS,
      },
      debrief: null,
    };
  }

  const includedCandidates = readyResponses.filter((response) => {
    if (currentMeasurementHash == null) {
      return response.measurementHashAtSubmission == null;
    }

    return response.measurementHashAtSubmission === currentMeasurementHash;
  });

  const items = prepareItems(survey, measurementPlan.concepts);
  const missingPolarityN = items.filter(
    (item) => isLikertQuestion(item.question) && item.polarity === "missing",
  ).length;

  const included: IncludedResponse[] = includedCandidates
    .filter((response) => response.answers != null)
    .map((response) => {
      const answers = response.answers as Record<string, SubmittedSurveyAnswer>;
      let recomputedOutput: MapperOutput | null = null;
      try {
        recomputedOutput = mapSurveyResponseToOutput({
          survey,
          answers,
          submittedLanguage: response.submittedLanguage,
          countryCodeRaw: null,
          mappingHashAtSubmission: response.mappingHashAtSubmission,
          measurementHashAtSubmission: response.measurementHashAtSubmission,
          enrichment: null,
        });
      } catch {
        recomputedOutput = null;
      }

      return {
        answers,
        submittedLanguage: response.submittedLanguage,
        persistedOutput: response.persistedOutput,
        recomputedOutput,
      };
    });

  const mappedReadyN = readyResponses.filter((response) => response.persistedOutput).length;
  const mappingGapN = collectedN - mappedReadyN;
  let scoringMismatchN = 0;
  let invalidNumericAnswerN = 0;
  let missingRequiredAnswerN = 0;

  for (const response of included) {
    if (response.recomputedOutput && response.persistedOutput) {
      if (!profileValuesMatch(response.recomputedOutput.profile, response.persistedOutput.profile)) {
        scoringMismatchN += 1;
      }
    } else if (response.recomputedOutput && !response.persistedOutput) {
      scoringMismatchN += 1;
    }

    for (const question of survey.definition_json.questions) {
      const visible = isQuestionVisible(question, response.answers);
      if (!visible) {
        continue;
      }

      const answer = response.answers[question.question_key];
      if (question.required && (answer == null || (Array.isArray(answer) && answer.length === 0))) {
        missingRequiredAnswerN += 1;
      }

      if (isLikertQuestion(question)) {
        const numeric = asFiniteNumber(answer);
        const item = items.find((entry) => entry.question.question_key === question.question_key);
        if (answer != null && numeric == null) {
          invalidNumericAnswerN += 1;
        } else if (numeric != null && isOutOfRange(numeric, item?.scaleMin ?? question.scale?.min ?? null, item?.scaleMax ?? question.scale?.max ?? null)) {
          invalidNumericAnswerN += 1;
        }
      }
    }
  }

  const integrityStatus =
    collectedN === 0
      ? "not_evaluable"
      : scoringMismatchN > 0 || invalidNumericAnswerN > 0 || missingRequiredAnswerN > 0 || missingPolarityN > 0
        ? "review_required"
        : "consistent";

  const languageCounts = Array.from(countBy(included, (response) => response.submittedLanguage).entries())
    .map(([code, n]) => ({ code, n }))
    .sort((left, right) => right.n - left.n || left.code.localeCompare(right.code));

  const mapperVersions = Array.from(
    new Set(
      included
        .map((response) => response.persistedOutput?.mapping_metadata.mapper_version)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const seedKey = cacheKey;
  const overall = buildScope({
    key: "overall",
    label: "Overall",
    languageCode: null,
    survey,
    concepts: measurementPlan.concepts,
    items,
    responses: included,
    seedKey,
  });

  const scopes: Record<string, InstrumentHealthScope> = {
    overall,
  };

  for (const language of languageCounts) {
    const key = `language:${language.code}`;
    scopes[key] = buildScope({
      key,
      label: language.code,
      languageCode: language.code,
      survey,
      concepts: measurementPlan.concepts,
      items,
      responses: included.filter((response) => response.submittedLanguage === language.code),
      seedKey: `${seedKey}:${key}`,
    });
  }

  const analysedItemCount = items.filter((item) => {
    const role = getInstrumentMeasurementRole(item.concept.concept_key);
    return role !== "not_applicable" && isLikertQuestion(item.question);
  }).length;

  return {
    analysisVersion: INSTRUMENT_HEALTH_ANALYSIS_VERSION,
    generatedAt,
    cacheKey,
    context: {
      collectedN,
      readyN,
      includedN: included.length,
      currentMeasurementHash,
      currentMappingHash,
      excludedDifferentHashN,
      unknownHashN,
      languages: languageCounts,
      itemCount: analysedItemCount,
      mapperVersions,
    },
    integrity: {
      mappingGapN,
      scoringMismatchN,
      invalidNumericAnswerN,
      missingRequiredAnswerN,
      missingPolarityN,
      status: integrityStatus,
    },
    scopes,
    defaultScopeKey: "overall",
    advancedValidation: { status: "not_configured", display: "Not run" },
    multilingual: {
      languageCount: languageCounts.length,
      invarianceNote: MULTILINGUAL_INVARIANCE_NOTE,
      advancedModels: ADVANCED_MODEL_ROWS,
    },
    debrief: buildDebrief(source.feedback, included.length),
  };
}

export function instrumentHealthJsonContainsSensitiveField(payload: unknown) {
  const serialized = JSON.stringify(payload);
  return (
    serialized.includes("response_id") ||
    serialized.includes("answers_json") ||
    serialized.includes("postal") ||
    serialized.includes("prolific")
  );
}
