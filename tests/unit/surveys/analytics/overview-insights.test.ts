import { describe, expect, it } from "vitest";
import {
  buildSurveyInsights,
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

function row(input: {
  group?: Record<string, string>;
  responses: number;
  trust?: number;
  flexibility?: number;
}): SurveyAnalyticsQueryRow {
  return {
    group: input.group ?? {},
    response_count: input.responses,
    evidence: usableEvidence(input.responses),
    metrics: {
      responses: countMetric(input.responses),
      avg_profile_trust_value: metric(input.trust ?? 3, input.responses),
      avg_profile_flexibility_value: metric(input.flexibility ?? 3, input.responses),
    },
  };
}

const trustField: SurveyAnalyticsFieldDefinition = {
  key: "profile.trust.value",
  label: "Trust in automation value",
  description: "Trust score",
  source: "profile",
  value_type: "number",
  groupable: false,
  filter_operators: ["eq"],
  metric_kinds: ["average"],
};

const flexibilityField: SurveyAnalyticsFieldDefinition = {
  key: "profile.flexibility.value",
  label: "Flexibility willingness value",
  description: "Flexibility score",
  source: "profile",
  value_type: "number",
  groupable: false,
  filter_operators: ["eq"],
  metric_kinds: ["average"],
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

const archetypeField: SurveyAnalyticsFieldDefinition = {
  key: "response.audience_label",
  label: "Audience label",
  description: "Behavioural archetype",
  source: "response",
  value_type: "string",
  groupable: true,
  filter_operators: ["eq"],
  metric_kinds: [],
};

describe("buildSurveyInsights", () => {
  it("surfaces a neutral largest tendency with an actionable implication", () => {
    const insights = buildSurveyInsights({
      baselineRow: row({ responses: 100, trust: 3.2, flexibility: 3.1 }),
      profileFields: [trustField, flexibilityField],
      countryRows: [],
      countryField,
      audienceRows: [
        row({ group: { "response.audience_label": "neutral" }, responses: 55 }),
        row({ group: { "response.audience_label": "automation_ready" }, responses: 45 }),
      ],
      audienceField: archetypeField,
    });

    expect(insights[0]).toMatchObject({
      title: "Largest tendency: Neutral Position",
      tone: "representation",
    });
    expect(insights[0]?.body).toContain("Country-level and archetype-specific messages");
    expect(insights[0]?.body).not.toContain("causal");
    expect(insights.some((insight) => insight.title === "Neutral position")).toBe(false);
  });

  it("uses country deltas to create an actionable pilot signal", () => {
    const insights = buildSurveyInsights({
      baselineRow: row({ responses: 100, trust: 3.2, flexibility: 3.1 }),
      profileFields: [trustField, flexibilityField],
      countryRows: [
        row({ group: { "context.country_code": "ES" }, responses: 50, flexibility: 4.1 }),
        row({ group: { "context.country_code": "IE" }, responses: 50, flexibility: 3.2 }),
      ],
      countryField,
      audienceRows: [],
      audienceField: archetypeField,
    });

    const countryInsight = insights.find((insight) => insight.tone === "country");

    expect(countryInsight?.title).toBe("Largest country contrast: Flexibility willingness");
    expect(countryInsight?.body).toContain("might be a stronger candidate for testing");
    expect(countryInsight?.body).toContain("Spain (ES)");
    expect(countryInsight?.body).toContain("Ireland (IE)");
    expect(countryInsight?.evidence).toContain("delta 0.90");
  });

  it("does not report contrasts below the sample guardrail", () => {
    const insights = buildSurveyInsights({
      baselineRow: row({ responses: 30, trust: 3.2, flexibility: 3.1 }),
      profileFields: [flexibilityField],
      countryRows: [
        row({ group: { "context.country_code": "ES" }, responses: 19, flexibility: 4.5 }),
        row({ group: { "context.country_code": "IE" }, responses: 11, flexibility: 2.5 }),
      ],
      countryField,
      audienceRows: [],
      audienceField: archetypeField,
    });

    expect(insights.some((insight) => insight.tone === "country")).toBe(false);
  });
});
