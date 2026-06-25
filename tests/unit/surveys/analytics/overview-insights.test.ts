import { describe, expect, it } from "vitest";
import {
  buildSurveyInsights,
  INSIGHT_THRESHOLDS,
  MIN_INSIGHT_SAMPLE,
} from "@/features/surveys/analytics/overview-insights";
import type {
  SurveyAnalyticsFieldDefinition,
  SurveyAnalyticsQueryRow,
} from "@/features/surveys/survey-analytics";

const usableEvidence = (responseCount: number) => ({
  label: "usable" as const,
  response_count: responseCount,
  suppress_detail: false,
  description: "Usable descriptive segment within the collected sample.",
});

function metric(value: number, sampleSize = MIN_INSIGHT_SAMPLE) {
  return {
    kind: "average" as const,
    value,
    sample_size: sampleSize,
  };
}

function countMetric(value: number) {
  return {
    kind: "count" as const,
    value,
    sample_size: value,
  };
}

function shareMetric(value: number, matchedCount: number, sampleSize = 100) {
  return {
    kind: "share_equals" as const,
    value,
    sample_size: sampleSize,
    matched_count: matchedCount,
  };
}

function row(input: {
  group?: Record<string, string>;
  responses: number;
  trust?: number;
  flexibility?: number;
  trustTagShares?: { high: number; low: number; medium?: number };
  flexibilityTagShares?: { high: number; low: number; medium?: number };
}): SurveyAnalyticsQueryRow {
  const trustHigh = input.trustTagShares?.high ?? 0.33;
  const trustLow = input.trustTagShares?.low ?? 0.33;
  const trustMedium = input.trustTagShares?.medium ?? 1 - trustHigh - trustLow;
  const flexHigh = input.flexibilityTagShares?.high ?? 0.33;
  const flexLow = input.flexibilityTagShares?.low ?? 0.33;
  const flexMedium = input.flexibilityTagShares?.medium ?? 1 - flexHigh - flexLow;

  return {
    group: input.group ?? {},
    response_count: input.responses,
    evidence: usableEvidence(input.responses),
    metrics: {
      responses: countMetric(input.responses),
      avg_profile_trust_in_automation_value: metric(input.trust ?? 3, input.responses),
      avg_profile_flexibility_willingness_value: metric(input.flexibility ?? 3, input.responses),
      share_profile_trust_in_automation_tag_high: shareMetric(
        trustHigh,
        Math.round(trustHigh * input.responses),
        input.responses,
      ),
      share_profile_trust_in_automation_tag_medium: shareMetric(
        trustMedium,
        Math.round(trustMedium * input.responses),
        input.responses,
      ),
      share_profile_trust_in_automation_tag_low: shareMetric(
        trustLow,
        Math.round(trustLow * input.responses),
        input.responses,
      ),
      share_profile_flexibility_willingness_tag_high: shareMetric(
        flexHigh,
        Math.round(flexHigh * input.responses),
        input.responses,
      ),
      share_profile_flexibility_willingness_tag_medium: shareMetric(
        flexMedium,
        Math.round(flexMedium * input.responses),
        input.responses,
      ),
      share_profile_flexibility_willingness_tag_low: shareMetric(
        flexLow,
        Math.round(flexLow * input.responses),
        input.responses,
      ),
    },
  };
}

const trustField: SurveyAnalyticsFieldDefinition = {
  key: "profile.trust_in_automation.value",
  label: "Trust in automation",
  description: "Trust score",
  source: "profile",
  value_type: "number",
  groupable: false,
  filter_operators: ["eq"],
  metric_kinds: ["average"],
  concept_key: "trust_in_automation",
};

const flexibilityField: SurveyAnalyticsFieldDefinition = {
  key: "profile.flexibility_willingness.value",
  label: "Flexibility willingness",
  description: "Flexibility score",
  source: "profile",
  value_type: "number",
  groupable: false,
  filter_operators: ["eq"],
  metric_kinds: ["average"],
  concept_key: "flexibility_willingness",
};

const trustTagField: SurveyAnalyticsFieldDefinition = {
  key: "profile.trust_in_automation.tag",
  label: "Trust in automation tag",
  description: "Trust band",
  source: "profile",
  value_type: "tag",
  groupable: false,
  filter_operators: ["eq"],
  metric_kinds: ["share_equals"],
  concept_key: "trust_in_automation",
};

const flexibilityTagField: SurveyAnalyticsFieldDefinition = {
  key: "profile.flexibility_willingness.tag",
  label: "Flexibility willingness tag",
  description: "Flexibility band",
  source: "profile",
  value_type: "tag",
  groupable: false,
  filter_operators: ["eq"],
  metric_kinds: ["share_equals"],
  concept_key: "flexibility_willingness",
};

const countryField: SurveyAnalyticsFieldDefinition = {
  key: "context.country_code",
  label: "Country code",
  description: "Country",
  source: "context",
  value_type: "string",
  groupable: true,
  filter_operators: ["eq"],
  metric_kinds: [],
};

describe("buildSurveyInsights", () => {
  it("surfaces a neutral profile-axis reading with an actionable implication", () => {
    const insights = buildSurveyInsights({
      baselineRow: row({ responses: 100, trust: 3.2, flexibility: 3.1 }),
      profileFields: [trustField, flexibilityField],
      tagFields: [trustTagField, flexibilityTagField],
      jointBandShares: [],
      countryRows: [],
      countryBandRows: [],
      countryField,
    });

    const mainstream = insights.find((insight) => insight.kind === "mainstream_tilt");

    expect(mainstream).toMatchObject({
      title: "Neutral position",
      tone: "mainstream",
    });
    expect(mainstream?.body).toContain("Band-level cuts and country splits might reveal");
    expect(insights.every((insight) => !/not causality|not a correlation test|remains descriptive until validated|Average scores are shown/i.test(insight.body))).toBe(true);
  });

  it("flags a dominant high band when share crosses the threshold", () => {
    const insights = buildSurveyInsights({
      baselineRow: row({
        responses: 100,
        trustTagShares: { high: 0.45, low: 0.15, medium: 0.4 },
        flexibilityTagShares: { high: 0.2, low: 0.2, medium: 0.6 },
      }),
      profileFields: [trustField, flexibilityField],
      tagFields: [trustTagField, flexibilityTagField],
      jointBandShares: [],
      countryRows: [],
      countryBandRows: [],
      countryField,
    });

    const dominant = insights.find((insight) => insight.kind === "dominant_band");

    expect(dominant?.title).toBe("Dominant high band: Trust in automation");
    expect(dominant?.body).toContain("That might");
    expect(dominant?.body).toContain("automated household energy management");
    expect(dominant?.evidence).toContain("45%");
  });

  it("surfaces cross-axis alignment when joint share beats independence", () => {
    const insights = buildSurveyInsights({
      baselineRow: row({
        responses: 100,
        trustTagShares: { high: 0.4, low: 0.2, medium: 0.4 },
        flexibilityTagShares: { high: 0.4, low: 0.2, medium: 0.4 },
      }),
      profileFields: [trustField, flexibilityField],
      tagFields: [trustTagField, flexibilityTagField],
      jointBandShares: [
        {
          fieldA: trustTagField,
          tagA: "high",
          fieldB: flexibilityTagField,
          tagB: "high",
          share: 0.22,
          matchedCount: 22,
          sampleSize: 100,
        },
      ],
      countryRows: [],
      countryBandRows: [],
      countryField,
    });

    const alignment = insights.find((insight) => insight.kind === "cross_axis_alignment");

    expect(alignment?.title).toBe("Aligned high bands: Trust in automation × Flexibility willingness");
    expect(alignment?.body).toContain("readiness cluster");
    expect(alignment?.evidence).toContain("lift");
  });

  it("interprets aligned low bands as stacked resistance", () => {
    const insights = buildSurveyInsights({
      baselineRow: row({
        responses: 100,
        trustTagShares: { high: 0.2, low: 0.4, medium: 0.4 },
        flexibilityTagShares: { high: 0.2, low: 0.4, medium: 0.4 },
      }),
      profileFields: [trustField, flexibilityField],
      tagFields: [trustTagField, flexibilityTagField],
      jointBandShares: [
        {
          fieldA: trustTagField,
          tagA: "low",
          fieldB: flexibilityTagField,
          tagB: "low",
          share: 0.22,
          matchedCount: 22,
          sampleSize: 100,
        },
      ],
      countryRows: [],
      countryBandRows: [],
      countryField,
    });

    const alignment = insights.find((insight) => insight.kind === "cross_axis_alignment");

    expect(alignment?.title).toBe("Aligned low bands: Trust in automation × Flexibility willingness");
    expect(alignment?.body).toContain("scepticism stacks across trust and flexibility");
  });

  it("uses country band deltas when they exceed the guardrail", () => {
    const insights = buildSurveyInsights({
      baselineRow: row({ responses: 100 }),
      profileFields: [trustField, flexibilityField],
      tagFields: [trustTagField, flexibilityTagField],
      jointBandShares: [],
      countryRows: [],
      countryBandRows: [
        row({
          group: { "context.country_code": "ES" },
          responses: 80,
          trustTagShares: { high: 0.58, low: 0.1, medium: 0.32 },
        }),
        row({
          group: { "context.country_code": "IE" },
          responses: 80,
          trustTagShares: { high: 0.25, low: 0.35, medium: 0.4 },
        }),
      ],
      countryField,
    });

    const countryBand = insights.find((insight) => insight.kind === "country_band_contrast");

    expect(countryBand?.title).toBe("Country band contrast: Trust in automation (high)");
    expect(countryBand?.body).toContain("Spain (ES)");
    expect(countryBand?.body).toContain("Ireland (IE)");
    expect(countryBand?.evidence).toContain("33pp");
  });

  it("uses country value deltas as a fallback descriptive contrast", () => {
    const insights = buildSurveyInsights({
      baselineRow: row({ responses: 100, trust: 3.2, flexibility: 3.1 }),
      profileFields: [trustField, flexibilityField],
      tagFields: [trustTagField, flexibilityTagField],
      jointBandShares: [],
      countryRows: [
        row({ group: { "context.country_code": "ES" }, responses: 50, flexibility: 4.1 }),
        row({ group: { "context.country_code": "IE" }, responses: 50, flexibility: 3.2 }),
      ],
      countryBandRows: [],
      countryField,
    });

    const countryInsight = insights.find((insight) => insight.kind === "country_value_contrast");

    expect(countryInsight?.title).toBe("Largest country contrast: Flexibility willingness");
    expect(countryInsight?.body).toContain("might be a stronger candidate for testing");
    expect(countryInsight?.evidence).toContain("delta 0.90");
  });

  it("does not report contrasts below the sample guardrail", () => {
    const insights = buildSurveyInsights({
      baselineRow: row({ responses: 30, trust: 3.2, flexibility: 3.1 }),
      profileFields: [flexibilityField],
      tagFields: [flexibilityTagField],
      jointBandShares: [],
      countryRows: [
        row({ group: { "context.country_code": "ES" }, responses: 19, flexibility: 4.5 }),
        row({ group: { "context.country_code": "IE" }, responses: 11, flexibility: 2.5 }),
      ],
      countryBandRows: [],
      countryField,
    });

    expect(insights.some((insight) => insight.kind === "country_value_contrast")).toBe(false);
    expect(insights.some((insight) => insight.kind === "country_band_contrast")).toBe(false);
  });

  it("keeps threshold constants explicit for review", () => {
    expect(INSIGHT_THRESHOLDS.dominantBandShare).toBeGreaterThan(0.3);
    expect(INSIGHT_THRESHOLDS.jointBandLift).toBeGreaterThan(1);
  });
});
