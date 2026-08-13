import { describe, expect, it } from "vitest";
import { getOverviewBandFromScore } from "@/features/surveys/analytics/overview-semantics";
import {
  buildSurveyOverviewData,
  computeLinearQuantile,
  OVERVIEW_PRIVACY_MIN_N,
} from "@/features/surveys/analytics/overview-v2";
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
}): SurveyAnalyticsRecord {
  const profile: Record<string, unknown> = {};

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
    const rows = Array.from({ length: OVERVIEW_PRIVACY_MIN_N }, (_, index) =>
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

    expect(overview.opportunity.defaultDfcKey).toBe("overall");
    expect(overview.opportunity.dfcOptions.map((option) => option.key)).toEqual([
      "overall",
      "ev_charging",
      "washing_machine_scheduling",
    ]);
    expect(overview.opportunity.viewsByDfcKey.overall.quadrants.find((entry) => entry.key === "high_willingness_limited_capability")?.count).toBe(rows.length);
    expect(overview.opportunity.viewsByDfcKey.ev_charging.quadrants.find((entry) => entry.key === "high_willingness_high_capability")?.count).toBe(rows.length);
    expect(overview.opportunity.viewsByDfcKey.washing_machine_scheduling.detailAvailable).toBe(false);
  });

  it("handles all four opportunity quadrants with exact 4.00 boundaries", () => {
    const repeated = (idPrefix: string, willingness: number, dfc: number) =>
      Array.from({ length: OVERVIEW_PRIVACY_MIN_N }, (_, index) =>
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
      collectedResponseCount: OVERVIEW_PRIVACY_MIN_N * 4,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });

    const counts = Object.fromEntries(
      overview.opportunity.viewsByDfcKey.overall.quadrants.map((entry) => [entry.key, entry.count]),
    );

    expect(counts.high_willingness_high_capability).toBe(OVERVIEW_PRIVACY_MIN_N);
    expect(counts.high_willingness_limited_capability).toBe(OVERVIEW_PRIVACY_MIN_N);
    expect(counts.lower_willingness_high_capability).toBe(OVERVIEW_PRIVACY_MIN_N);
    expect(counts.lower_immediate_fit).toBe(OVERVIEW_PRIVACY_MIN_N);
  });

  it("keeps near-exact opportunity coordinates instead of coarse quarter-bin rounding", () => {
    const rows = Array.from({ length: OVERVIEW_PRIVACY_MIN_N }, (_, index) =>
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

    expect(overview.opportunity.viewsByDfcKey.overall.distributionCells).toEqual([
      expect.objectContaining({
        x: 4.13,
        y: 3.87,
        count: OVERVIEW_PRIVACY_MIN_N,
      }),
    ]);
  });

  it("applies construct-specific semantics for thermal norms", () => {
    const rows = Array.from({ length: OVERVIEW_PRIVACY_MIN_N }, (_, index) =>
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
      rows: Array.from({ length: OVERVIEW_PRIVACY_MIN_N }, (_, index) =>
        buildRow({
          id: `ie-${index}`,
          country: "IE",
          willingness: 4,
          willingnessTag: "high",
        }),
      ),
      collectedResponseCount: OVERVIEW_PRIVACY_MIN_N,
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
        ...Array.from({ length: OVERVIEW_PRIVACY_MIN_N }, (_, index) =>
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
      collectedResponseCount: OVERVIEW_PRIVACY_MIN_N + 3,
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
      rows: Array.from({ length: OVERVIEW_PRIVACY_MIN_N }, (_, index) =>
        buildRow({
          id: `r-${index}`,
          country: "IE",
          willingness: 4,
          willingnessTag: "high",
          tariff: 2,
          tariffTag: "low",
        }),
      ),
      collectedResponseCount: OVERVIEW_PRIVACY_MIN_N + 2,
      collectedResponseWindow: {
        firstRespondedAt: "2026-08-10T10:00:00.000Z",
        lastRespondedAt: "2026-08-10T11:00:00.000Z",
      },
    });

    expect(overview.state.hasMappingGap).toBe(true);
    expect(JSON.stringify(overview)).not.toContain("response_id");
  });
});
