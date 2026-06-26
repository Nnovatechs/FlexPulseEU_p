import type {
  SurveyAnalyticsFieldDefinition,
  SurveyAnalyticsQueryRow,
} from "@/features/surveys/survey-analytics";
import {
  formatPlainValue,
  getConceptTitle,
  getGroupLabel,
  getMetric,
  getMetricValue,
  getSegmentEntries,
  metricKeyFor,
  TAG_VALUES,
} from "./profile-explorer-utils";

// ---------------------------------------------------------------------------
// Insight flags, thresholds and copy — review and tune here.
// ---------------------------------------------------------------------------

export const MIN_INSIGHT_SAMPLE = 20;
/** Minimum average-score gap (1–5 scale) for country value contrasts. */
export const MIN_MEANINGFUL_DELTA = 0.35;

export const INSIGHT_THRESHOLDS = {
  /** Minimum share (0–1) for a single high or low band to count as dominant. */
  dominantBandShare: 0.38,
  /** Minimum matched respondents inside the dominant band. */
  dominantBandCount: MIN_INSIGHT_SAMPLE,
  /** Minimum high-vs-low share gap (percentage points, 0–1) on one axis. */
  polarityGapPp: 0.22,
  /** Minimum respondents in both high and low bands when reporting polarity. */
  polarityBandCount: MIN_INSIGHT_SAMPLE,
  /** Minimum joint share for a two-band combination (e.g. trust-high AND flex-high). */
  jointBandShare: 0.12,
  /** Minimum respondents in the joint band slice. */
  jointBandCount: MIN_INSIGHT_SAMPLE,
  /** Joint share must exceed independence (marginal A × marginal B) by this factor. */
  jointBandLift: 1.25,
  /** Minimum band-share gap (percentage points) between two countries on one axis. */
  countryBandDeltaPp: 0.18,
  /** Whole-sample average spread below which we label the sample "neutral". */
  moderateAvgLow: 2.75,
  moderateAvgHigh: 3.75,
} as const;

type ConceptFamily = "trust" | "flexibility" | "comfort" | "tariff" | "generic";

function inferConceptFamily(conceptKey?: string): ConceptFamily {
  if (!conceptKey) {
    return "generic";
  }

  if (conceptKey.includes("trust")) {
    return "trust";
  }

  if (conceptKey.includes("flex")) {
    return "flexibility";
  }

  if (conceptKey.includes("comfort") || conceptKey.includes("thermal")) {
    return "comfort";
  }

  if (conceptKey.includes("tariff")) {
    return "tariff";
  }

  return "generic";
}

function inferConceptFamilyFromTitle(concept: string): ConceptFamily {
  const normalized = concept.toLowerCase();
  if (normalized.includes("trust")) {
    return "trust";
  }
  if (normalized.includes("flex")) {
    return "flexibility";
  }
  if (normalized.includes("comfort") || normalized.includes("thermal")) {
    return "comfort";
  }
  if (normalized.includes("tariff")) {
    return "tariff";
  }
  return "generic";
}

export const INSIGHT_COPY = {
  dominantBand: {
    titleHigh: (concept: string) => `Dominant high band: ${concept}`,
    titleLow: (concept: string) => `Dominant low band: ${concept}`,
    bodyHigh: (concept: string, shareLabel: string, conceptKey?: string) => {
      const family = inferConceptFamily(conceptKey);
      const lead = `${shareLabel} of mapped respondents sit in the high ${concept.toLowerCase()} band — the clearest single-band concentration in this sample.`;

      switch (family) {
        case "flexibility":
          return `${lead} That might signal broad openness to time-shifting, automation-led flexibility or demand-response pilots without needing to persuade the whole population at once.`;
        case "trust":
          return `${lead} That might indicate a sizeable group already comfortable with automated household energy management — a natural starting point for deeper flexibility offers.`;
        case "comfort":
          return `${lead} That might mean comfort expectations will shape how far flexibility programmes can go before uptake drops.`;
        case "tariff":
          return `${lead} That might reflect tariff-sensitive households who could respond to well-framed price or savings signals.`;
        default:
          return `${lead} That might be a useful anchor when prioritising where to test programme design or messaging first.`;
      }
    },
    bodyLow: (concept: string, shareLabel: string, conceptKey?: string) => {
      const family = inferConceptFamily(conceptKey);
      const lead = `${shareLabel} of mapped respondents sit in the low ${concept.toLowerCase()} band — the clearest single-band concentration in this sample.`;

      switch (family) {
        case "flexibility":
          return `${lead} That might point to a large group needing simpler entry paths, stronger incentives or lower-friction automation before flexibility programmes scale.`;
        case "trust":
          return `${lead} That might highlight a trust gap to address before automation-heavy flexibility propositions land at scale.`;
        case "comfort":
          return `${lead} That might suggest strict comfort expectations could limit how aggressively flexibility can be marketed in this sample.`;
        case "tariff":
          return `${lead} That might indicate weak price-led motivation — savings alone may not be enough to move this group.`;
        default:
          return `${lead} That might be the main constraint to design around in early pilots or comms.`;
      }
    },
  },
  polarityContrast: {
    title: (concept: string) => `Band polarity: ${concept}`,
    body: (concept: string, highLabel: string, lowLabel: string, conceptKey?: string) => {
      const family = inferConceptFamily(conceptKey);
      const lead = `Within ${concept.toLowerCase()}, high and low bands are unevenly populated (${highLabel} high vs ${lowLabel} low), so the sample looks split rather than centred on medium.`;

      switch (family) {
        case "flexibility":
          return `${lead} That might mean a two-speed market — early adopters and sceptics in the same base — so one generic flexibility campaign may underperform.`;
        case "trust":
          return `${lead} That might suggest trust-building and reassurance need different treatment for each band rather than one automation message for all.`;
        default:
          return `${lead} That might be a cue to segment pilots and messaging by band instead of treating the sample as homogeneous.`;
      }
    },
  },
  crossAxisAlignment: {
    title: (conceptA: string, conceptB: string, tag: "high" | "low") =>
      tag === "high"
        ? `Aligned high bands: ${conceptA} × ${conceptB}`
        : `Aligned low bands: ${conceptA} × ${conceptB}`,
    body: (
      conceptA: string,
      conceptB: string,
      tag: "high" | "low",
      shareLabel: string,
      liftLabel: string,
      conceptKeyA?: string,
      conceptKeyB?: string,
    ) => {
      const families = new Set([
        inferConceptFamily(conceptKeyA),
        inferConceptFamily(conceptKeyB),
        inferConceptFamilyFromTitle(conceptA),
        inferConceptFamilyFromTitle(conceptB),
      ]);
      const lead = `${shareLabel} of respondents fall in both the ${tag} ${conceptA.toLowerCase()} band and the ${tag} ${conceptB.toLowerCase()} band (${liftLabel} vs independence).`;

      if (tag === "high") {
        if (families.has("trust") && families.has("flexibility")) {
          return `${lead} That might mark a readiness cluster where automation-supported flexibility or demand-response programmes could find early traction.`;
        }
        return `${lead} That might indicate these two dimensions move together in this sample — respondents open on both fronts may be the easiest place to test integrated offers.`;
      }

      if (families.has("trust") && families.has("flexibility")) {
        return `${lead} That might suggest scepticism stacks across trust and flexibility — shifting one lever alone may not be enough until both concerns are addressed.`;
      }
      return `${lead} That might point to a shared resistance pattern where programmes need to tackle both dimensions together rather than in isolation.`;
    },
  },
  countryBandContrast: {
    title: (concept: string, tag: "high" | "low") =>
      `Country band contrast: ${concept} (${tag})`,
    body: (
      concept: string,
      tag: "high" | "low",
      highCountry: string,
      lowCountry: string,
      conceptKey?: string,
    ) => {
      const family = inferConceptFamily(conceptKey);
      const lead = `The ${tag} ${concept.toLowerCase()} band share differs most between ${highCountry} and ${lowCountry}.`;

      switch (family) {
        case "flexibility":
          return `${lead} ${highCountry} might be the better place to pilot flexibility or demand-response offers, while ${lowCountry} may need a different entry proposition or incentive mix.`;
        case "trust":
          return `${lead} ${highCountry} might tolerate more automation in flexibility programmes, whereas ${lowCountry} may need stronger trust-building first.`;
        case "comfort":
          return `${lead} ${highCountry} might allow more aggressive flexibility framing, while ${lowCountry} may need comfort-led positioning.`;
        default:
          return `${lead} ${highCountry} might be worth prioritising for local pilots on this axis, with ${lowCountry} as the contrast market to learn from.`;
      }
    },
  },
  countryValueContrast: {
    titlePrefix: "Largest country contrast",
    body: (concept: string, highCountry: string, lowCountry: string, conceptKey?: string) => {
      const family = inferConceptFamily(conceptKey);

      switch (family) {
        case "flexibility":
          return `${highCountry} might be a stronger candidate for testing flexibility-led or demand-response programmes than ${lowCountry} on this axis.`;
        case "trust":
          return `${highCountry} might be a stronger candidate for testing automation-led energy offers than ${lowCountry} on this axis.`;
        case "comfort":
          return `${highCountry} might respond better to comfort-aware flexibility positioning than ${lowCountry} on this axis.`;
        default:
          return `${highCountry} might be a stronger candidate for testing ${concept.toLowerCase()}-led programmes than ${lowCountry} on this axis.`;
      }
    },
  },
  mainstreamTilt: {
    titleNeutral: "Neutral position",
    titleTilt: (concept: string) => `Mainstream tilt: ${concept}`,
    bodyNeutral:
      "Average scores sit in the middle across behavioural axes, so no single dimension dominates the whole sample. Band-level cuts and country splits might reveal clearer pockets to act on than one blanket campaign.",
    bodyTilt: (highConcept: string, lowConcept: string) =>
      `${highConcept} leads on whole-sample averages and ${lowConcept} lags — that might mean ${highConcept.toLowerCase()} should headline early programme design, with ${lowConcept.toLowerCase()} treated as the main design constraint.`,
  },
} as const;

const COUNTRY_LABELS: Record<string, string> = {
  DE: "Germany (DE)",
  ES: "Spain (ES)",
  FR: "France (FR)",
  HR: "Croatia (HR)",
  IE: "Ireland (IE)",
};

export type InsightTone = "mainstream" | "band" | "alignment" | "country";

export type SemanticInsight = {
  kind: InsightKind;
  conceptKey?: string;
  title: string;
  body: string;
  evidence: string;
  tone: InsightTone;
  priority: number;
};

export type InsightKind =
  | "mainstream_tilt"
  | "dominant_band"
  | "polarity_contrast"
  | "cross_axis_alignment"
  | "country_band_contrast"
  | "country_value_contrast";

export type BandShareSnapshot = {
  tag: (typeof TAG_VALUES)[number];
  share: number;
  matchedCount: number;
  sampleSize: number;
};

export type JointBandShare = {
  fieldA: SurveyAnalyticsFieldDefinition;
  tagA: "high" | "low";
  fieldB: SurveyAnalyticsFieldDefinition;
  tagB: "high" | "low";
  share: number;
  matchedCount: number;
  sampleSize: number;
};

function formatShareLabel(share: number) {
  return `${Math.round(share * 100)}%`;
}

function formatPpLabel(gap: number) {
  return `${Math.round(gap * 100)}pp`;
}

function getRowResponseCount(row: SurveyAnalyticsQueryRow | null | undefined) {
  return getMetricValue(row, "responses") ?? row?.response_count ?? 0;
}

function getDisplayLabel(label: string) {
  return COUNTRY_LABELS[label] ?? label;
}

function getBandShare(
  row: SurveyAnalyticsQueryRow | null | undefined,
  tagField: SurveyAnalyticsFieldDefinition,
  tag: (typeof TAG_VALUES)[number],
): BandShareSnapshot | null {
  if (!row) {
    return null;
  }

  const key = `${metricKeyFor("share", tagField)}_${tag}`;
  const metric = getMetric(row, key);
  if (metric?.value == null) {
    return null;
  }

  return {
    tag,
    share: metric.value,
    matchedCount: metric.matched_count ?? 0,
    sampleSize: metric.sample_size ?? row.response_count,
  };
}

export function getPrimaryTagFields(
  tagFields: SurveyAnalyticsFieldDefinition[],
  profileFields: SurveyAnalyticsFieldDefinition[],
) {
  const primaryConceptKeys = new Set(
    profileFields.map((field) => field.concept_key).filter(Boolean) as string[],
  );
  const primary = tagFields.filter(
    (field) => field.concept_key && primaryConceptKeys.has(field.concept_key),
  );

  return primary.length > 0 ? primary : tagFields;
}

export function buildJointBandShareCandidates(
  tagFields: SurveyAnalyticsFieldDefinition[],
  profileFields: SurveyAnalyticsFieldDefinition[],
) {
  const fields = getPrimaryTagFields(tagFields, profileFields);
  const candidates: Array<{
    fieldA: SurveyAnalyticsFieldDefinition;
    tagA: "high" | "low";
    fieldB: SurveyAnalyticsFieldDefinition;
    tagB: "high" | "low";
  }> = [];

  for (let indexA = 0; indexA < fields.length; indexA += 1) {
    for (let indexB = indexA + 1; indexB < fields.length; indexB += 1) {
      candidates.push({
        fieldA: fields[indexA],
        tagA: "high",
        fieldB: fields[indexB],
        tagB: "high",
      });
      candidates.push({
        fieldA: fields[indexA],
        tagA: "low",
        fieldB: fields[indexB],
        tagB: "low",
      });
    }
  }

  return candidates;
}

function buildDominantBandInsight(
  baselineRow: SurveyAnalyticsQueryRow | null,
  tagFields: SurveyAnalyticsFieldDefinition[],
  profileFields: SurveyAnalyticsFieldDefinition[],
): SemanticInsight | null {
  const totalResponses = getRowResponseCount(baselineRow);
  if (!baselineRow || totalResponses < MIN_INSIGHT_SAMPLE || tagFields.length === 0) {
    return null;
  }

  const candidates = getPrimaryTagFields(tagFields, profileFields)
    .flatMap((field) => {
      const high = getBandShare(baselineRow, field, "high");
      const low = getBandShare(baselineRow, field, "low");
      const entries = [high, low].filter(
        (entry): entry is BandShareSnapshot => entry != null,
      );

      return entries.map((entry) => ({
        field,
        entry,
      }));
    })
    .filter(
      (candidate) =>
        candidate.entry.share >= INSIGHT_THRESHOLDS.dominantBandShare &&
        candidate.entry.matchedCount >= INSIGHT_THRESHOLDS.dominantBandCount,
    )
    .sort((left, right) => right.entry.share - left.entry.share);

  const strongest = candidates[0];
  if (!strongest) {
    return null;
  }

  const concept = getConceptTitle(strongest.field);
  const isHigh = strongest.entry.tag === "high";

  return {
    kind: "dominant_band",
    conceptKey: strongest.field.concept_key,
    tone: "band",
    priority: 80 + strongest.entry.share * 40,
    title: isHigh
      ? INSIGHT_COPY.dominantBand.titleHigh(concept)
      : INSIGHT_COPY.dominantBand.titleLow(concept),
    body: isHigh
      ? INSIGHT_COPY.dominantBand.bodyHigh(
          concept,
          formatShareLabel(strongest.entry.share),
          strongest.field.concept_key,
        )
      : INSIGHT_COPY.dominantBand.bodyLow(
          concept,
          formatShareLabel(strongest.entry.share),
          strongest.field.concept_key,
        ),
    evidence: `${concept} ${strongest.entry.tag} band ${formatShareLabel(strongest.entry.share)} (n=${strongest.entry.matchedCount}); baseline n=${totalResponses}`,
  };
}

function buildPolarityContrastInsight(
  baselineRow: SurveyAnalyticsQueryRow | null,
  tagFields: SurveyAnalyticsFieldDefinition[],
  profileFields: SurveyAnalyticsFieldDefinition[],
  excludeConceptKey?: string,
): SemanticInsight | null {
  if (!baselineRow || tagFields.length === 0) {
    return null;
  }

  const candidates = getPrimaryTagFields(tagFields, profileFields)
    .map((field) => {
      const high = getBandShare(baselineRow, field, "high");
      const low = getBandShare(baselineRow, field, "low");
      if (!high || !low) {
        return null;
      }

      const gap = Math.abs(high.share - low.share);
      if (
        gap < INSIGHT_THRESHOLDS.polarityGapPp ||
        high.matchedCount < INSIGHT_THRESHOLDS.polarityBandCount ||
        low.matchedCount < INSIGHT_THRESHOLDS.polarityBandCount
      ) {
        return null;
      }

      return { field, high, low, gap };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .filter((entry) => entry.field.concept_key !== excludeConceptKey)
    .sort((left, right) => right.gap - left.gap);

  const strongest = candidates[0];
  if (!strongest) {
    return null;
  }

  const concept = getConceptTitle(strongest.field);

  return {
    kind: "polarity_contrast",
    conceptKey: strongest.field.concept_key,
    tone: "band",
    priority: 60 + strongest.gap * 80,
    title: INSIGHT_COPY.polarityContrast.title(concept),
    body: INSIGHT_COPY.polarityContrast.body(
      concept,
      formatShareLabel(strongest.high.share),
      formatShareLabel(strongest.low.share),
      strongest.field.concept_key,
    ),
    evidence: `${concept} high ${formatShareLabel(strongest.high.share)} (n=${strongest.high.matchedCount}) vs low ${formatShareLabel(strongest.low.share)} (n=${strongest.low.matchedCount}); gap ${formatPpLabel(strongest.gap)}`,
  };
}

function buildCrossAxisAlignmentInsight(
  baselineRow: SurveyAnalyticsQueryRow | null,
  jointBandShares: JointBandShare[],
): SemanticInsight | null {
  if (!baselineRow || jointBandShares.length === 0) {
    return null;
  }

  const candidates = jointBandShares
    .map((entry) => {
      const marginalA = getBandShare(baselineRow, entry.fieldA, entry.tagA)?.share ?? null;
      const marginalB = getBandShare(baselineRow, entry.fieldB, entry.tagB)?.share ?? null;
      const expected =
        marginalA != null && marginalB != null ? marginalA * marginalB : null;
      const lift = expected != null && expected > 0 ? entry.share / expected : null;

      return {
        entry,
        expected,
        lift,
      };
    })
    .filter(
      ({ entry, lift }) =>
        entry.share >= INSIGHT_THRESHOLDS.jointBandShare &&
        entry.matchedCount >= INSIGHT_THRESHOLDS.jointBandCount &&
        lift != null &&
        lift >= INSIGHT_THRESHOLDS.jointBandLift,
    )
    .sort((left, right) => {
      const liftDelta = (right.lift ?? 0) - (left.lift ?? 0);
      if (liftDelta !== 0) {
        return liftDelta;
      }
      return right.entry.share - left.entry.share;
    });

  const strongest = candidates[0];
  if (!strongest) {
    return null;
  }

  const conceptA = getConceptTitle(strongest.entry.fieldA);
  const conceptB = getConceptTitle(strongest.entry.fieldB);
  const tag = strongest.entry.tagA;
  const liftLabel =
    strongest.lift != null ? `${strongest.lift.toFixed(2)}×` : "n/a";

  return {
    kind: "cross_axis_alignment",
    tone: "alignment",
    priority: 100 + (strongest.lift ?? 0) * 20 + strongest.entry.share * 30,
    title: INSIGHT_COPY.crossAxisAlignment.title(conceptA, conceptB, tag),
    body: INSIGHT_COPY.crossAxisAlignment.body(
      conceptA,
      conceptB,
      tag,
      formatShareLabel(strongest.entry.share),
      liftLabel,
      strongest.entry.fieldA.concept_key,
      strongest.entry.fieldB.concept_key,
    ),
    evidence: `Joint ${tag} share ${formatShareLabel(strongest.entry.share)} (n=${strongest.entry.matchedCount}); expected under independence ${formatShareLabel(strongest.expected ?? 0)}; lift ${liftLabel}; baseline n=${strongest.entry.sampleSize}`,
  };
}

function buildCountryBandContrastInsight(input: {
  countryRows: SurveyAnalyticsQueryRow[];
  countryField: SurveyAnalyticsFieldDefinition | null;
  tagFields: SurveyAnalyticsFieldDefinition[];
  profileFields: SurveyAnalyticsFieldDefinition[];
}): SemanticInsight | null {
  if (!input.countryField || input.countryRows.length < 2 || input.tagFields.length === 0) {
    return null;
  }

  const candidates = getPrimaryTagFields(input.tagFields, input.profileFields).flatMap((field) =>
    (["high", "low"] as const).flatMap((tag) => {
      const entries = input.countryRows
        .map((row) => {
          const band = getBandShare(row, field, tag);
          if (!band || band.matchedCount < MIN_INSIGHT_SAMPLE) {
            return null;
          }

          return {
            label: getDisplayLabel(getGroupLabel(row, input.countryField!.key)),
            band,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((left, right) => right.band.share - left.band.share);

      const high = entries[0];
      const low = entries[entries.length - 1];
      if (!high || !low || high.label === low.label) {
        return null;
      }

      const delta = high.band.share - low.band.share;
      if (delta < INSIGHT_THRESHOLDS.countryBandDeltaPp) {
        return null;
      }

      return {
        field,
        tag,
        high,
        low,
        delta,
      };
    }),
  ).filter((entry): entry is NonNullable<typeof entry> => entry != null);

  const strongest = candidates.sort((left, right) => right.delta - left.delta)[0];
  if (!strongest) {
    return null;
  }

  const concept = getConceptTitle(strongest.field);

  return {
    kind: "country_band_contrast",
    tone: "country",
    priority: 75 + strongest.delta * 90,
    title: INSIGHT_COPY.countryBandContrast.title(concept, strongest.tag),
    body: INSIGHT_COPY.countryBandContrast.body(
      concept,
      strongest.tag,
      strongest.high.label,
      strongest.low.label,
      strongest.field.concept_key,
    ),
    evidence: `${strongest.high.label} ${formatShareLabel(strongest.high.band.share)} (n=${strongest.high.band.matchedCount}) vs ${strongest.low.label} ${formatShareLabel(strongest.low.band.share)} (n=${strongest.low.band.matchedCount}); delta ${formatPpLabel(strongest.delta)}`,
  };
}

function buildCountryValueContrastInsight(input: {
  rows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
  profileFields: SurveyAnalyticsFieldDefinition[];
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
  const highLabel = getDisplayLabel(strongest.high.label);
  const lowLabel = getDisplayLabel(strongest.low.label);

  return {
    kind: "country_value_contrast",
    tone: "country",
    priority: 50 + strongest.delta * 70,
    title: `${INSIGHT_COPY.countryValueContrast.titlePrefix}: ${concept}`,
    body: INSIGHT_COPY.countryValueContrast.body(
      concept,
      highLabel,
      lowLabel,
      strongest.field.concept_key,
    ),
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
  const allModerate = averages.every(
    (entry) =>
      entry.value > INSIGHT_THRESHOLDS.moderateAvgLow &&
      entry.value < INSIGHT_THRESHOLDS.moderateAvgHigh,
  );

  return {
    kind: "mainstream_tilt",
    tone: "mainstream",
    priority: allModerate ? 20 : 30 + spread * 10,
    title: allModerate
      ? INSIGHT_COPY.mainstreamTilt.titleNeutral
      : INSIGHT_COPY.mainstreamTilt.titleTilt(getConceptTitle(high.field)),
    body: allModerate
      ? INSIGHT_COPY.mainstreamTilt.bodyNeutral
      : INSIGHT_COPY.mainstreamTilt.bodyTilt(
          getConceptTitle(high.field),
          getConceptTitle(low.field),
        ),
    evidence: `Baseline n=${totalResponses}; high ${formatPlainValue(high.value)}/5, low ${formatPlainValue(low.value)}/5, spread ${formatPlainValue(spread)}`,
  };
}

function dedupeInsights(insights: SemanticInsight[]) {
  const chosen: SemanticInsight[] = [];
  const dominantConceptKeys = new Set<string>();

  for (const insight of insights.sort((left, right) => right.priority - left.priority)) {
    if (
      insight.kind === "polarity_contrast" &&
      insight.conceptKey &&
      dominantConceptKeys.has(insight.conceptKey)
    ) {
      continue;
    }

    chosen.push(insight);

    if (insight.kind === "dominant_band" && insight.conceptKey) {
      dominantConceptKeys.add(insight.conceptKey);
    }
  }

  return chosen;
}

export function buildSurveyInsights(input: {
  baselineRow: SurveyAnalyticsQueryRow | null;
  profileFields: SurveyAnalyticsFieldDefinition[];
  tagFields: SurveyAnalyticsFieldDefinition[];
  jointBandShares: JointBandShare[];
  countryRows: SurveyAnalyticsQueryRow[];
  countryBandRows: SurveyAnalyticsQueryRow[];
  countryField: SurveyAnalyticsFieldDefinition | null;
}) {
  const dominantBand = buildDominantBandInsight(
    input.baselineRow,
    input.tagFields,
    input.profileFields,
  );

  const insights = dedupeInsights(
    [
      buildCrossAxisAlignmentInsight(input.baselineRow, input.jointBandShares),
      dominantBand,
      buildPolarityContrastInsight(
        input.baselineRow,
        input.tagFields,
        input.profileFields,
        dominantBand?.conceptKey,
      ),
      buildCountryBandContrastInsight({
        countryRows: input.countryBandRows,
        countryField: input.countryField,
        tagFields: input.tagFields,
        profileFields: input.profileFields,
      }),
      buildCountryValueContrastInsight({
        rows: input.countryRows,
        segmentField: input.countryField,
        profileFields: input.profileFields,
      }),
      buildMainstreamInsight(input.baselineRow, input.profileFields),
    ].filter((insight): insight is SemanticInsight => Boolean(insight)),
  );

  return insights;
}
