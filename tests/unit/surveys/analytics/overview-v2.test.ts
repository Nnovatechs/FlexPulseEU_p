import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeLinearQuantile } from "@/features/surveys/analytics/descriptive-stats";
import {
  findDominantPatternRecipe,
  findOpportunityDistributionRecipe,
  findRelationshipInsightRecipe,
} from "@/features/surveys/analytics/overview-insight-recipes";
import { getOverviewBandFromScore } from "@/features/surveys/analytics/overview-semantics";
import { OVERVIEW_SEMANTIC_INSIGHT_MIN_N } from "@/features/surveys/analytics/overview-v2-policy";
import { buildSurveyOverviewData } from "@/features/surveys/analytics/overview-v2";
import type { PersistedSurvey } from "@/features/surveys/generator-types";
import type {
  SurveyAnalyticsFieldDefinition,
  SurveyAnalyticsRecord,
  SurveyAnalyticsSchema,
} from "@/features/surveys/survey-analytics";

function buildSurvey() {
  return {
    id: "survey-1",
    status: "published",
  } as PersistedSurvey;
}

function buildField(
  key: string,
  label: string,
  conceptKey: string,
  extra: Partial<SurveyAnalyticsFieldDefinition> = {},
): SurveyAnalyticsFieldDefinition {
  return {
    key,
    label,
    description: label,
    source: "profile",
    value_type: "number",
    groupable: false,
    filter_operators: ["eq"],
    metric_kinds: ["average"],
    concept_key: conceptKey,
    concept_role: "primary_profile_axis",
    ...extra,
  };
}

function buildSchema(fields: SurveyAnalyticsFieldDefinition[]): SurveyAnalyticsSchema {
  return {
    survey_id: "survey-1",
    schema_namespace: "flexpulse_behavioural_schema",
    measurement_hash: "hash",
    ready_response_count: 0,
    excluded_unmapped_count: 0,
    ready_pipeline_count: 0,
    supported_geo_levels: ["country", "region", "city", "district", "neighbourhood", "place", "postal_area"],
    fields,
  };
}

function buildRow(input: {
  id: string;
  respondedAt?: string;
  country?: string | null;
  willingness?: number | null;
  willingnessTag?: "low" | "medium" | "high";
  dfc?: number | null;
  dfcTag?: "low" | "medium" | "high";
  dfcFacets?: Record<string, number | null>;
  thermal?: number | null;
  thermalTag?: "low" | "medium" | "high";
  tariff?: number | null;
  tariffTag?: "low" | "medium" | "high";
  trust?: number | null;
  awareness?: number | null;
  der?: number | null;
  extraProfile?: Record<string, { value: number | null; tag?: "low" | "medium" | "high" }>;
}): SurveyAnalyticsRecord {
  const profile: Record<string, unknown> = { ...(input.extraProfile ?? {}) };

  if (input.willingness !== undefined || input.willingnessTag) {
    profile.flexibility_willingness = {
      value: input.willingness ?? null,
      ...(input.willingnessTag ? { tag: input.willingnessTag } : {}),
    };
  }

  if (input.dfc !== undefined || input.dfcTag || input.dfcFacets) {
    profile.declared_flexibility_capability = {
      value: input.dfc ?? null,
      ...(input.dfcTag ? { tag: input.dfcTag } : {}),
      ...(input.dfcFacets
        ? {
            facets: Object.fromEntries(
              Object.entries(input.dfcFacets).map(([facetKey, value]) => [
                facetKey,
                {
                  value,
                  evidence_count: 4,
                  evidence_level: "facet_subscore",
                },
              ]),
            ),
          }
        : {}),
    };
  }

  if (input.thermal !== undefined || input.thermalTag) {
    profile.thermal_comfort_norms = {
      value: input.thermal ?? null,
      ...(input.thermalTag ? { tag: input.thermalTag } : {}),
    };
  }

  if (input.tariff !== undefined || input.tariffTag) {
    profile.tariff_preference_orientation = {
      value: input.tariff ?? null,
      ...(input.tariffTag ? { tag: input.tariffTag } : {}),
    };
  }

  if (input.trust != null) {
    profile.trust_in_automation = { value: input.trust };
  }

  if (input.awareness != null) {
    profile.awareness_of_energy_systems = { value: input.awareness };
  }

  if (input.der != null) {
    profile.der_engagement = { value: input.der };
  }

  return {
    response_id: input.id,
    responded_at: input.respondedAt ?? "2026-08-10T10:00:00.000Z",
    audience_token: null,
    audience_label: null,
    mapper_output: {
      profile,
      context_metadata: {
        country_code: input.country ?? null,
        survey_language: "en",
        location: null,
        climate: null,
      },
      mapping_metadata: {
        measurement_hash: null,
        mapping_hash: null,
        mapper_version: "test",
      },
    } as SurveyAnalyticsRecord["mapper_output"],
    location_levels: [],
  };
}

const baseFields = [
  buildField(
    "profile.flexibility_willingness.value",
    "Flexibility willingness",
    "flexibility_willingness",
  ),
  buildField(
    "profile.declared_flexibility_capability.value",
    "Declared flexibility capability",
    "declared_flexibility_capability",
  ),
  buildField(
    "profile.thermal_comfort_norms.value",
    "Thermal comfort norms",
    "thermal_comfort_norms",
  ),
  buildField(
    "profile.tariff_preference_orientation.value",
    "Tariff preference orientation",
    "tariff_preference_orientation",
  ),
  buildField(
    "profile.declared_flexibility_capability.facets.ev_charging.value",
    "Declared flexibility capability: ev_charging",
    "declared_flexibility_capability",
    {
      key: "profile.declared_flexibility_capability.facets.ev_charging.value",
      facet: "ev_charging",
      evidence_level: "facet_subscore",
    },
  ),
  buildField(
    "profile.declared_flexibility_capability.facets.washing_machine_scheduling.value",
    "Declared flexibility capability: washing_machine_scheduling",
    "declared_flexibility_capability",
    {
      key: "profile.declared_flexibility_capability.facets.washing_machine_scheduling.value",
      facet: "washing_machine_scheduling",
      evidence_level: "facet_subscore",
    },
  ),
];

describe("overview semantics", () => {
  it("uses exact semantic band cutoffs", () => {
    expect(getOverviewBandFromScore(2)).toBe("low");
    expect(getOverviewBandFromScore(2.01)).toBe("medium");
    expect(getOverviewBandFromScore(3.99)).toBe("medium");
    expect(getOverviewBandFromScore(4)).toBe("high");
  });
});

describe("computeLinearQuantile", () => {
  it("supports odd and even samples with documented interpolation", () => {
    expect(computeLinearQuantile([1, 2, 5], 0.5)).toBe(2);
    expect(computeLinearQuantile([1, 2, 4, 8], 0.5)).toBe(3);
    expect(computeLinearQuantile([1, 2, 4, 8], 0.25)).toBe(1.75);
    expect(computeLinearQuantile([1, 2, 4, 8], 0.75)).toBe(5);
  });
});

describe("buildSurveyOverviewData", () => {
  it("keeps nulls out of denominators and never turns them into zero", () => {
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows: [
        buildRow({ id: "r1", country: "IE", willingness: 4, willingnessTag: "high" }),
        buildRow({ id: "r2", country: "IE", willingness: null }),
      ],
      collectedResponseCount: 2,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });

    expect(overview.constructs.find((entry) => entry.conceptKey === "flexibility_willingness")?.applicableN).toBe(1);
    expect(overview.context.analysedResponseCount).toBe(2);
  });

  it("derives DFC options dynamically and uses the canonical overall DFC score", () => {
    const rows = Array.from({ length: OVERVIEW_SEMANTIC_INSIGHT_MIN_N }, (_, index) =>
      buildRow({
        id: `r${index}`,
        country: "IE",
        willingness: 4,
        willingnessTag: "high",
        dfc: 2.5,
        dfcTag: "medium",
        dfcFacets: {
          ev_charging: 5,
          washing_machine_scheduling: null,
        },
      }),
    );

    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });

    expect(overview.opportunity?.defaultOptionKey).toBe("overall");
    expect(overview.opportunity?.options.map((option) => option.key)).toEqual([
      "overall",
      "ev_charging",
      "washing_machine_scheduling",
    ]);
    expect(overview.opportunity?.viewsByOptionKey.overall.quadrants.find((entry) => entry.key === "high_willingness_limited_capability")?.count).toBe(rows.length);
    expect(overview.opportunity?.viewsByOptionKey.ev_charging.quadrants.find((entry) => entry.key === "high_willingness_high_capability")?.count).toBe(rows.length);
    expect(overview.opportunity?.viewsByOptionKey.washing_machine_scheduling.applicableN).toBe(0);
    expect(overview.opportunity?.viewsByOptionKey.washing_machine_scheduling.detailAvailable).toBe(false);
  });

  it("shows Flexibility Opportunity counts from n=1 and withholds semantic insights and radar", () => {
    const fields = [
      ...baseFields,
      buildField("profile.trust_in_automation.value", "Trust in automation", "trust_in_automation"),
      buildField("profile.awareness_of_energy_systems.value", "Awareness of energy systems", "awareness_of_energy_systems"),
      buildField("profile.der_engagement.value", "DER engagement", "der_engagement"),
    ];
    const rows = [
      buildRow({
        id: "small-1",
        willingness: 5,
        dfc: 2,
        trust: 5,
        awareness: 4.5,
        thermal: 4.8,
        tariff: 4,
        der: 4.2,
      }),
    ];
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(fields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });
    const view = overview.opportunity?.viewsByOptionKey.overall;
    expect(view?.detailAvailable).toBe(true);
    expect(view?.applicableN).toBe(1);
    expect(view?.quadrants.find((entry) => entry.key === "high_willingness_limited_capability")?.count).toBe(1);
    expect(view?.distributionCells).toEqual([
      expect.objectContaining({ x: 2, y: 5, count: 1 }),
    ]);
    expect(overview.insights).toEqual([]);
    const comparison = view?.groupProfiles.high_willingness_limited_capability;
    expect(comparison?.n).toBe(1);
    expect(comparison?.detailAvailable).toBe(false);
    expect(comparison?.axes).toEqual([]);
  });

  it("handles all four opportunity quadrants with exact 4.00 boundaries", () => {
    const repeated = (idPrefix: string, willingness: number, dfc: number) =>
      Array.from({ length: OVERVIEW_SEMANTIC_INSIGHT_MIN_N }, (_, index) =>
        buildRow({
          id: `${idPrefix}-${index}`,
          country: "IE",
          willingness,
          willingnessTag: willingness >= 4 ? "high" : willingness <= 2 ? "low" : "medium",
          dfc,
          dfcTag: dfc >= 4 ? "high" : dfc <= 2 ? "low" : "medium",
        }),
      );

    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows: [
        ...repeated("hh", 4, 4),
        ...repeated("hl", 4, 3.99),
        ...repeated("lh", 3.99, 4),
        ...repeated("ll", 3.99, 3.99),
      ],
      collectedResponseCount: OVERVIEW_SEMANTIC_INSIGHT_MIN_N * 4,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });

    const counts = Object.fromEntries(
      overview.opportunity?.viewsByOptionKey.overall.quadrants.map((entry) => [entry.key, entry.count]) ?? [],
    );

    expect(counts.high_willingness_high_capability).toBe(OVERVIEW_SEMANTIC_INSIGHT_MIN_N);
    expect(counts.high_willingness_limited_capability).toBe(OVERVIEW_SEMANTIC_INSIGHT_MIN_N);
    expect(counts.lower_willingness_high_capability).toBe(OVERVIEW_SEMANTIC_INSIGHT_MIN_N);
    expect(counts.lower_immediate_fit).toBe(OVERVIEW_SEMANTIC_INSIGHT_MIN_N);
  });

  it("keeps near-exact opportunity coordinates instead of coarse quarter-bin rounding", () => {
    const rows = Array.from({ length: OVERVIEW_SEMANTIC_INSIGHT_MIN_N }, (_, index) =>
      buildRow({
        id: `exact-${index}`,
        country: "IE",
        willingness: 3.87,
        willingnessTag: "medium",
        dfc: 4.13,
        dfcTag: "high",
      }),
    );

    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });

    expect(overview.opportunity?.viewsByOptionKey.overall.distributionCells).toEqual([
      expect.objectContaining({
        x: 4.13,
        y: 3.87,
        count: OVERVIEW_SEMANTIC_INSIGHT_MIN_N,
      }),
    ]);
  });

  it("applies construct-specific semantics for thermal norms", () => {
    const rows = Array.from({ length: OVERVIEW_SEMANTIC_INSIGHT_MIN_N }, (_, index) =>
      buildRow({
        id: `thermal-${index}`,
        country: "IE",
        thermal: index < 3 ? 4.5 : index === 3 ? 3 : 1.5,
        thermalTag: index < 3 ? "high" : index === 3 ? "medium" : "low",
      }),
    );

    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });

    expect(overview.constructs.find((entry) => entry.conceptKey === "thermal_comfort_norms")?.bands.map((band) => band.label)).toEqual([
      "stricter",
      "intermediate",
      "more permissive thermal norms",
    ]);
  });

  it("hides country pulse for a single analysed country and suppresses small-country metrics", () => {
    const singleCountryOverview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows: Array.from({ length: OVERVIEW_SEMANTIC_INSIGHT_MIN_N }, (_, index) =>
        buildRow({
          id: `ie-${index}`,
          country: "IE",
          willingness: 4,
          willingnessTag: "high",
        }),
      ),
      collectedResponseCount: OVERVIEW_SEMANTIC_INSIGHT_MIN_N,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });

    expect(singleCountryOverview.countryPulse).toBeNull();

    const mixedCountryOverview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows: [
        ...Array.from({ length: OVERVIEW_SEMANTIC_INSIGHT_MIN_N }, (_, index) =>
          buildRow({
            id: `ie-${index}`,
            country: "IE",
            willingness: 4,
            willingnessTag: "high",
          }),
        ),
        ...Array.from({ length: 3 }, (_, index) =>
          buildRow({
            id: `es-${index}`,
            country: "ES",
            willingness: 3,
            willingnessTag: "medium",
          }),
        ),
      ],
      collectedResponseCount: OVERVIEW_SEMANTIC_INSIGHT_MIN_N + 3,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });

    expect(mixedCountryOverview.countryPulse?.countries).toHaveLength(2);
    expect(
      mixedCountryOverview.countryPulse?.constructs[0].countries.find((entry) => entry.code === "ES")?.metric,
    ).toBeNull();
  });

  it("returns aggregated DTOs without response ids and reflects mapping gaps", () => {
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows: Array.from({ length: OVERVIEW_SEMANTIC_INSIGHT_MIN_N }, (_, index) =>
        buildRow({
          id: `r-${index}`,
          country: "IE",
          willingness: 4,
          willingnessTag: "high",
          tariff: 2,
          tariffTag: "low",
        }),
      ),
      collectedResponseCount: OVERVIEW_SEMANTIC_INSIGHT_MIN_N + 2,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });

    expect(overview.state.hasMappingGap).toBe(true);
    expect(JSON.stringify(overview)).not.toContain("response_id");
  });

  it("uses the score cutoffs even when the mapper tag contradicts them", () => {
    const rows = Array.from({ length: OVERVIEW_SEMANTIC_INSIGHT_MIN_N }, (_, index) =>
      buildRow({
        id: `tag-${index}`,
        willingness: 4.2,
        willingnessTag: "low",
      }),
    );
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });
    const willingness = overview.constructs.find((entry) => entry.conceptKey === "flexibility_willingness");
    expect(willingness?.bands.find((band) => band.key === "high")?.count).toBe(rows.length);
    expect(willingness?.bands.find((band) => band.key === "low")?.count).toBe(0);
  });

  it("computes Spearman relationships on matched responses and keeps four insight layers", () => {
    const fields = [
      ...baseFields,
      buildField("profile.trust_in_automation.value", "Trust in automation", "trust_in_automation"),
    ];
    const rows = Array.from({ length: 12 }, (_, index) =>
      buildRow({
        id: `rel-${index}`,
        willingness: 1 + (index % 5),
        trust: 1 + (index % 5),
        dfc: 3,
      }),
    );
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(fields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });
    const relationship = overview.insights.find((insight) => insight.family === "construct_relationship");
    expect(relationship?.statisticalSignal).toMatch(/Spearman’s ρ/);
    expect(relationship?.statisticalSignal).toMatch(/matched n=12/);
    expect(relationship?.statisticalSignal).not.toMatch(/lift|co-occurrence/i);
    expect(relationship?.meaning).toBeTruthy();
    expect(relationship?.decisionHypothesis).toBeTruthy();
    expect(relationship?.alternativeExplanation).toBeTruthy();
    expect(relationship?.title).toBe("Trust and willingness move together");
  });

  it("keeps statistics for an unknown concept without inventing semantics", () => {
    const fields = [
      ...baseFields,
      buildField("profile.novel_numeric_axis.value", "Novel numeric axis", "novel_numeric_axis"),
    ];
    const rows = Array.from({ length: 12 }, (_, index) =>
      buildRow({
        id: `unk-${index}`,
        willingness: 1 + (index % 5),
        extraProfile: { novel_numeric_axis: { value: 1 + (index % 5) } },
      }),
    );
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(fields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });
    const novel = overview.insights.find((insight) => insight.conceptKeys.includes("novel_numeric_axis"));
    if (novel) {
      expect(novel.statisticalSignal).toMatch(/Spearman’s ρ/);
      expect(novel.meaning).toBeNull();
      expect(novel.decisionHypothesis).toBeNull();
    }
    expect(overview.constructs.find((entry) => entry.conceptKey === "novel_numeric_axis")?.applicableN).toBe(12);
  });

  it("selects at most three insights and at most one per family", () => {
    const fields = [
      ...baseFields,
      buildField("profile.trust_in_automation.value", "Trust in automation", "trust_in_automation"),
      buildField("profile.awareness_of_energy_systems.value", "Awareness of energy systems", "awareness_of_energy_systems"),
    ];
    const rows = Array.from({ length: 20 }, (_, index) =>
      buildRow({
        id: `cap-${index}`,
        willingness: index < 16 ? 5 : 2,
        dfc: index < 16 ? 2 : 5,
        trust: index < 16 ? 5 : 2,
        awareness: 5,
      }),
    );
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(fields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });
    expect(overview.insights.length).toBeLessThanOrEqual(3);
    const families = overview.insights.map((insight) => insight.family);
    expect(new Set(families).size).toBe(families.length);
    expect(overview.insights.some((insight) => insight.title === "Construct contrast")).toBe(false);
    expect(overview.insights.some((insight) => insight.title === "Most mixed construct")).toBe(false);
  });

  it("does not force weak mixed or contrast insights", () => {
    const rows = Array.from({ length: OVERVIEW_SEMANTIC_INSIGHT_MIN_N }, (_, index) =>
      buildRow({
        id: `weak-${index}`,
        willingness: 3,
        tariff: 3,
        thermal: 3,
      }),
    );
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });
    expect(overview.insights).toEqual([]);
  });

  it("builds a group profile without a rest comparison and excludes defining axes", () => {
    const fields = [
      ...baseFields,
      buildField("profile.trust_in_automation.value", "Trust in automation", "trust_in_automation"),
      buildField("profile.awareness_of_energy_systems.value", "Awareness of energy systems", "awareness_of_energy_systems"),
      buildField("profile.der_engagement.value", "DER engagement", "der_engagement"),
    ];
    const rows = [
      ...Array.from({ length: 8 }, (_, index) =>
        buildRow({
          id: `sel-${index}`,
          willingness: 5,
          dfc: 5,
          trust: 5,
          awareness: 4.5,
          thermal: 4.8,
          tariff: 4,
          der: 4.2,
        }),
      ),
      ...Array.from({ length: 8 }, (_, index) =>
        buildRow({
          id: `rest-${index}`,
          willingness: 2,
          dfc: 2,
          trust: 2,
          awareness: 2,
          thermal: 2,
          tariff: 2,
          der: 2,
        }),
      ),
    ];
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(fields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });
    const comparison = overview.opportunity?.viewsByOptionKey.overall.groupProfiles.high_willingness_high_capability;
    expect(comparison?.n).toBe(8);
    expect(comparison).not.toHaveProperty("restN");
    expect(comparison?.axes.map((axis) => axis.conceptKey)).not.toContain("flexibility_willingness");
    expect(comparison?.axes.map((axis) => axis.conceptKey)).not.toContain("declared_flexibility_capability");
    expect(comparison?.axes.length).toBeGreaterThanOrEqual(3);
    const thermal = comparison?.axes.find((axis) => axis.conceptKey === "thermal_comfort_norms");
    expect(thermal?.median).toBeGreaterThan(4);
    expect(thermal?.shortLabel).toBe("Thermal strictness");
    expect(thermal?.directionNote).toMatch(/stricter/i);
    const other = overview.opportunity?.viewsByOptionKey.overall.groupProfiles.lower_immediate_fit;
    expect(other?.n).toBe(8);
    expect(other?.axes.find((axis) => axis.conceptKey === "thermal_comfort_norms")?.median).toBeLessThan(3);
  });

  it("hides Flexibility Opportunity when the view axes are absent and keeps the rest of Overview", () => {
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema([
        buildField("profile.thermal_comfort_norms.value", "Thermal comfort norms", "thermal_comfort_norms"),
      ]),
      rows: Array.from({ length: OVERVIEW_SEMANTIC_INSIGHT_MIN_N }, (_, index) =>
        buildRow({ id: `no-fo-${index}`, thermal: 4 }),
      ),
      collectedResponseCount: OVERVIEW_SEMANTIC_INSIGHT_MIN_N,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });
    expect(overview.opportunity).toBeNull();
    expect(overview.constructs.map((entry) => entry.conceptKey)).toEqual(["thermal_comfort_norms"]);
    expect(overview.context.analysedResponseCount).toBe(OVERVIEW_SEMANTIC_INSIGHT_MIN_N);
  });

  it("uses a compact fallback when fewer than three comparison axes are available", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, index) =>
        buildRow({ id: `a-${index}`, willingness: 5, dfc: 5, thermal: 5 }),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        buildRow({ id: `b-${index}`, willingness: 2, dfc: 2, thermal: 2 }),
      ),
    ];
    const overview = buildSurveyOverviewData({
      survey: buildSurvey(),
      schema: buildSchema(baseFields),
      rows,
      collectedResponseCount: rows.length,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });
    const comparison = overview.opportunity?.viewsByOptionKey.overall.groupProfiles.high_willingness_high_capability;
    expect(comparison?.detailAvailable).toBe(true);
    expect(comparison?.axes).toEqual([]);
  });
});

describe("overview v2 panel contracts", () => {
  it("selects quadrants in the matrix and clears them when the DFC option changes", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/app/(app)/surveys/[surveyId]/analytics-v2/overview-panel.tsx"),
      "utf8",
    );
    const engine = readFileSync(
      path.join(process.cwd(), "src/features/surveys/analytics/overview-v2.ts"),
      "utf8",
    );
    const analyticsV1 = readFileSync(
      path.join(process.cwd(), "src/features/surveys/analytics/overview-insights.ts"),
      "utf8",
    );
    const instrumentHealth = readFileSync(
      path.join(process.cwd(), "src/features/surveys/analytics/instrument-health.ts"),
      "utf8",
    );

    const instrumentHealthStats = readFileSync(
      path.join(process.cwd(), "src/features/surveys/analytics/instrument-health-stats.ts"),
      "utf8",
    );

    expect(panel).toContain("Clear selection");
    expect(panel).toContain("toggleQuadrant");
    expect(panel).toContain("selectOption");
    expect(panel).toContain("setSelectedQuadrants([])");
    expect(panel).toContain("current.includes(quadrantKey)");
    expect(panel).toContain("OVERVIEW_SECTION_INTROS");
    expect(panel).toContain("<InfoTip");
    expect(panel).not.toContain("OVERVIEW_SECTION_INTROS.whatStandsOut}</p>");
    expect(panel).toContain("What this may mean");
    expect(panel).not.toContain("selected-versus-rest");
    expect(panel).not.toContain("Farther from the centre");
    expect(panel).not.toContain("privacy threshold");
    expect(engine).toContain("Thermal strictness");
    expect(engine).toContain("groupProfiles");
    expect(engine).not.toContain("restN");
    expect(engine).not.toContain("buildConstructContrastInsight");
    expect(engine).not.toContain("buildMostMixedConstructInsight");
    expect(instrumentHealthStats).not.toContain("from \"@/features/surveys/analytics/overview-v2\"");
    expect(instrumentHealthStats).toContain("from \"@/features/surveys/analytics/descriptive-stats\"");
    expect(analyticsV1).toContain("inferConceptFamily");
    expect(instrumentHealth).toContain("getOverviewBandFromScore");
  });

  it("selects a semantic recipe by namespace, version, pair and direction", () => {
    const recipe = findRelationshipInsightRecipe({
      schemaNamespace: "flexpulse_behavioural_schema",
      schemaVersion: 1,
      leftConceptKey: "flexibility_willingness",
      rightConceptKey: "thermal_comfort_norms",
      direction: "negative",
    });
    const reversed = findRelationshipInsightRecipe({
      schemaNamespace: "flexpulse_behavioural_schema",
      schemaVersion: 1,
      leftConceptKey: "thermal_comfort_norms",
      rightConceptKey: "flexibility_willingness",
      direction: "positive",
    });
    const otherSchema = findRelationshipInsightRecipe({
      schemaNamespace: "other_schema",
      schemaVersion: 1,
      leftConceptKey: "flexibility_willingness",
      rightConceptKey: "trust_in_automation",
      direction: "positive",
    });

    expect(recipe?.title).toBe("Stricter thermal norms sit with lower willingness");
    expect(reversed).toBeNull();
    expect(otherSchema).toBeNull();
  });

  it("keeps the awareness-willingness recipe from recommending that basic messaging stop", () => {
    const relationship = findRelationshipInsightRecipe({
      schemaNamespace: "flexpulse_behavioural_schema",
      schemaVersion: 1,
      leftConceptKey: "awareness_of_energy_systems",
      rightConceptKey: "flexibility_willingness",
      direction: "positive",
    });
    const widespreadAwareness = findDominantPatternRecipe({
      schemaNamespace: "flexpulse_behavioural_schema",
      schemaVersion: 1,
      conceptKey: "awareness_of_energy_systems",
      band: "high",
    });

    expect(relationship?.decisionHypothesis).not.toMatch(/repeating basic awareness/i);
    expect(relationship?.decisionHypothesis).toMatch(/association alone/i);
    expect(widespreadAwareness?.decisionHypothesis).toMatch(/repeating basic awareness messages/i);
  });

  it("describes opportunity asymmetry as the more common one-sided gap", () => {
    const capabilityGap = findOpportunityDistributionRecipe({
      schemaNamespace: "flexpulse_behavioural_schema",
      schemaVersion: 1,
      viewKey: "flexpulse_willingness_dfc_v1",
      pattern: "asymmetric",
      asymmetricDirection: "highY_lowX",
    });
    const willingnessGap = findOpportunityDistributionRecipe({
      schemaNamespace: "flexpulse_behavioural_schema",
      schemaVersion: 1,
      viewKey: "flexpulse_willingness_dfc_v1",
      pattern: "asymmetric",
      asymmetricDirection: "lowY_highX",
    });

    expect(capabilityGap?.title).toBe("Limited capability is the more common one-sided gap");
    expect(capabilityGap?.meaning).toMatch(/most frequent unilateral imbalance/i);
    expect(capabilityGap?.meaning).not.toMatch(/households that otherwise report capability/i);
    expect(willingnessGap?.title).toBe("Lower willingness is the more common one-sided gap");
    expect(willingnessGap?.meaning).toMatch(/most frequent unilateral imbalance/i);
  });
});
