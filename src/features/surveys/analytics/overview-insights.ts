import type {
  SurveyAnalyticsFieldDefinition,
  SurveyAnalyticsQueryRow,
} from "@/features/surveys/survey-analytics";
import {
  formatPlainValue,
  getConceptTitle,
  getGroupLabel,
  getMetricValue,
  getSegmentEntries,
  metricKeyFor,
} from "./profile-explorer-utils";

export type SemanticInsight = {
  title: string;
  body: string;
  evidence: string;
  tone: "mainstream" | "representation" | "country" | "archetype";
};

export const MIN_INSIGHT_SAMPLE = 20;
export const MIN_MEANINGFUL_DELTA = 0.35;

const ARCHETYPE_IMPLICATIONS: Record<string, string> = {
  automation_ready:
    "The sample leans toward automation-ready adoption: lead with automated flexibility offers and keep the control story clear.",
  control_protective:
    "The strongest tendency is control protection: prioritise opt-outs, manual override and trust-building before asking for flexibility.",
  price_optimizer:
    "The sample is savings-led: price signals, bill impact and simple reward framing should carry the proposition.",
  comfort_first:
    "Comfort is the main constraint: flexibility programmes need comfort guarantees before optimisation messages will land.",
  neutral:
    "The sample sits in a neutral position: broad one-size-fits-all messaging for automation or flexibility is unlikely to move everyone. Country-level and archetype-specific messages will probably do more work here.",
  neutral_mainstream:
    "The sample sits in a neutral position: broad one-size-fits-all messaging for automation or flexibility is unlikely to move everyone. Country-level and archetype-specific messages will probably do more work here.",
  der_engaged:
    "The sample is DER-engaged: this is a stronger candidate for advanced flexibility pilots and asset-specific propositions.",
  contradictory:
    "The sample contains a contradiction: reliability trust exists, but autonomy still creates friction. Control design and messaging need to be separated.",
  partial_sparse:
    "The strongest tendency is sparse evidence: use this segment to inspect data quality before drawing a product direction.",
};

const COUNTRY_LABELS: Record<string, string> = {
  DE: "Germany (DE)",
  ES: "Spain (ES)",
  FR: "France (FR)",
  HR: "Croatia (HR)",
  IE: "Ireland (IE)",
};

function formatShare(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function getRowResponseCount(row: SurveyAnalyticsQueryRow | null | undefined) {
  return getMetricValue(row, "responses") ?? row?.response_count ?? 0;
}

function getRawGroupValue(row: SurveyAnalyticsQueryRow, fieldKey: string) {
  const value = row.group[fieldKey];
  return typeof value === "string" ? value : "";
}

function getDisplayLabel(label: string, tone: "country" | "archetype") {
  if (tone === "country") {
    return COUNTRY_LABELS[label] ?? label;
  }

  return label;
}

function buildRepresentationInsight(
  audienceRows: SurveyAnalyticsQueryRow[],
  audienceField: SurveyAnalyticsFieldDefinition | null,
  totalResponses: number,
): SemanticInsight | null {
  if (!audienceField || totalResponses <= 0) {
    return null;
  }

  const ranked = audienceRows
    .filter((row) => !row.evidence.suppress_detail)
    .map((row) => ({
      value: getRawGroupValue(row, audienceField.key),
      label: getGroupLabel(row, audienceField.key),
      count: getRowResponseCount(row),
    }))
    .filter((entry) => entry.count >= MIN_INSIGHT_SAMPLE)
    .sort((left, right) => right.count - left.count);

  const leader = ranked[0];
  if (!leader) {
    return null;
  }

  const share = leader.count / totalResponses;
  const implication =
    ARCHETYPE_IMPLICATIONS[leader.value] ??
    `${leader.label} is the clearest tendency in the mapped sample, so use it as the first lens for proposition framing.`;

  return {
    tone: "representation",
    title: `Largest tendency: ${leader.label}`,
    body: implication,
    evidence: `${leader.count} of ${totalResponses} mapped respondents (${formatShare(share)})`,
  };
}

function buildLargestContrastInsight(input: {
  rows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
  profileFields: SurveyAnalyticsFieldDefinition[];
  tone: "country" | "archetype";
  titlePrefix: string;
}): SemanticInsight | null {
  if (!input.segmentField || input.rows.length < 2) {
    return null;
  }

  const candidates = input.profileFields
    .map((field) => {
      const entries = getSegmentEntries(input.rows, input.segmentField, field).filter(
        (entry) => entry.sampleSize >= MIN_INSIGHT_SAMPLE,
      );
      const high = entries[0];
      const low = entries[entries.length - 1];

      if (!high || !low || high.label === low.label) {
        return null;
      }

      return {
        field,
        high,
        low,
        delta: high.value - low.value,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .filter((entry) => entry.delta >= MIN_MEANINGFUL_DELTA)
    .sort((left, right) => right.delta - left.delta);

  const strongest = candidates[0];
  if (!strongest) {
    return null;
  }

  const concept = getConceptTitle(strongest.field);
  const highLabel = getDisplayLabel(strongest.high.label, input.tone);
  const lowLabel = getDisplayLabel(strongest.low.label, input.tone);
  const comparisonBody =
    input.tone === "country"
      ? `Based on these survey respondents, ${highLabel} might be a stronger candidate for testing ${concept.toLowerCase()}-led flexibility programmes than ${lowLabel}.`
      : `${concept} is the clearest behavioural separation between ${highLabel} and ${lowLabel}. To move lower-readiness respondents toward more trusting automation or flexibility adoption, tailored offers, stronger controls and specific messaging might be useful.`;

  return {
    tone: input.tone,
    title: `${input.titlePrefix}: ${concept}`,
    body: comparisonBody,
    evidence: `${highLabel} ${formatPlainValue(strongest.high.value)}/5 (n=${strongest.high.sampleSize}) vs ${lowLabel} ${formatPlainValue(strongest.low.value)}/5 (n=${strongest.low.sampleSize}); delta ${formatPlainValue(strongest.delta)}`,
  };
}

function buildMainstreamInsight(
  baselineRow: SurveyAnalyticsQueryRow | null,
  profileFields: SurveyAnalyticsFieldDefinition[],
): SemanticInsight | null {
  const totalResponses = getRowResponseCount(baselineRow);
  if (!baselineRow || totalResponses < MIN_INSIGHT_SAMPLE) {
    return null;
  }

  const averages = profileFields
    .map((field) => ({
      field,
      value: getMetricValue(baselineRow, metricKeyFor("avg", field)),
    }))
    .filter(
      (entry): entry is { field: SurveyAnalyticsFieldDefinition; value: number } =>
        entry.value != null,
    )
    .sort((left, right) => right.value - left.value);

  const high = averages[0];
  const low = averages[averages.length - 1];
  if (!high || !low) {
    return null;
  }

  const spread = high.value - low.value;
  const allModerate = averages.every((entry) => entry.value > 2.75 && entry.value < 3.75);

  return {
    tone: "mainstream",
    title: allModerate ? "Neutral position" : `Mainstream tilt: ${getConceptTitle(high.field)}`,
    body: allModerate
      ? "The full mapped population is not strongly pulled toward one behavioural axis. For flexibility and automation adoption, the useful product move is to work through country-level and archetype-specific messages instead of one generic campaign."
      : `${getConceptTitle(high.field)} is the strongest whole-sample signal and ${getConceptTitle(low.field)} is the weakest. Lead with the stronger axis, but use segmentation where the spread is large.`,
    evidence: `Baseline n=${totalResponses}; high ${formatPlainValue(high.value)}/5, low ${formatPlainValue(low.value)}/5, spread ${formatPlainValue(spread)}`,
  };
}

export function buildSurveyInsights(input: {
  baselineRow: SurveyAnalyticsQueryRow | null;
  profileFields: SurveyAnalyticsFieldDefinition[];
  countryRows: SurveyAnalyticsQueryRow[];
  countryField: SurveyAnalyticsFieldDefinition | null;
  audienceRows: SurveyAnalyticsQueryRow[];
  audienceField: SurveyAnalyticsFieldDefinition | null;
}) {
  const representationInsight = buildRepresentationInsight(
    input.audienceRows,
    input.audienceField,
    getRowResponseCount(input.baselineRow),
  );
  const mainstreamInsight = buildMainstreamInsight(input.baselineRow, input.profileFields);
  const shouldHideMainstreamAsDuplicate =
    representationInsight?.title === "Largest tendency: Neutral Position" &&
    mainstreamInsight?.title === "Neutral position";

  return [
    representationInsight,
    buildLargestContrastInsight({
      rows: input.countryRows,
      segmentField: input.countryField,
      profileFields: input.profileFields,
      tone: "country",
      titlePrefix: "Largest country contrast",
    }),
    buildLargestContrastInsight({
      rows: input.audienceRows,
      segmentField: input.audienceField,
      profileFields: input.profileFields,
      tone: "archetype",
      titlePrefix: "Largest behavioural separation",
    }),
    shouldHideMainstreamAsDuplicate ? null : mainstreamInsight,
  ].filter((insight): insight is SemanticInsight => Boolean(insight));
}
