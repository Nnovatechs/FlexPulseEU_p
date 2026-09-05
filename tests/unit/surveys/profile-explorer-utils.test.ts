import { describe, expect, it } from "vitest";
import type { SurveyAnalyticsFieldDefinition } from "@/features/surveys/survey-analytics";
import {
  buildBaselineMetrics,
  buildCapabilityFacetMetrics,
  buildSelectedFilters,
  getCapabilityFacetFields,
  getPrimaryProfileFields,
  MAX_PROFILE_CONCEPTS,
  MAX_RADAR_AXES,
  shouldSuppressCapabilityFacet,
} from "@/features/surveys/analytics/profile-explorer-utils";
import { FLEXPULSE_DER_ASSET_VALUES } from "@/features/ontology/flexpulse-behavioural-schema";

function numberField(
  key: string,
  conceptKey: string,
  overrides: Partial<SurveyAnalyticsFieldDefinition> = {},
): SurveyAnalyticsFieldDefinition {
  return {
    key,
    label: conceptKey,
    description: conceptKey,
    source: "profile",
    value_type: "number",
    groupable: false,
    filter_operators: ["eq"],
    metric_kinds: ["average"],
    concept_key: conceptKey,
    concept_role: "primary_profile_axis",
    ...overrides,
  };
}

describe("profile explorer DFC structure", () => {
  it("keeps all seven primary axes visible", () => {
    const fields = Array.from({ length: 7 }, (_, index) =>
      numberField(`profile.axis_${index + 1}.value`, `axis_${index + 1}`),
    );

    expect(MAX_PROFILE_CONCEPTS).toBe(7);
    expect(MAX_RADAR_AXES).toBe(7);
    expect(getPrimaryProfileFields(fields)).toHaveLength(7);
  });

  it("discovers DFC facet subscores and builds applicable-sample metrics", () => {
    const facet = numberField(
      "profile.declared_flexibility_capability.facets.ev_charging.value",
      "declared_flexibility_capability",
      {
        concept_role: "primary_profile_axis",
        facet: "ev_charging",
        evidence_level: "facet_subscore",
      },
    );
    const unrelated = numberField(
      "profile.trust_in_automation.facets.reliability.value",
      "trust_in_automation",
      { facet: "reliability", evidence_level: "interpretive_signal" },
    );

    expect(getCapabilityFacetFields([unrelated, facet])).toEqual([facet]);
    expect(buildCapabilityFacetMetrics([unrelated, facet])).toEqual([
      {
        key: "avg_profile_declared_flexibility_capability_facets_ev_charging_value",
        kind: "average",
        field: facet.key,
      },
    ]);
  });

  it("suppresses an individual facet whose applicable sample is below five", () => {
    expect(
      shouldSuppressCapabilityFacet({
        kind: "average",
        value: 4.5,
        sample_size: 4,
      }),
    ).toBe(true);
    expect(
      shouldSuppressCapabilityFacet({
        kind: "average",
        value: 4.5,
        sample_size: 5,
      }),
    ).toBe(false);
  });

  it("includes every DFC asset in baseline metrics", () => {
    const assetField = numberField("profile.assets.value", "owned_der_assets", {
      value_type: "string[]",
      metric_kinds: ["share_contains"],
    });
    const metrics = buildBaselineMetrics([], [], assetField);

    expect(metrics.filter((metric) => metric.kind === "share_contains")).toHaveLength(
      FLEXPULSE_DER_ASSET_VALUES.length,
    );
    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "asset_washing_machine" }),
        expect.objectContaining({ key: "asset_air_conditioning" }),
      ]),
    );
  });

  it("builds DFC applicable and not-applicable filters", () => {
    const facet = numberField(
      "profile.declared_flexibility_capability.facets.ev_charging.value",
      "declared_flexibility_capability",
      { facet: "ev_charging", evidence_level: "facet_subscore" },
    );
    const baseInput = {
      countryField: null,
      audienceField: null,
      languageField: null,
      tagField: null,
      tagFields: [],
      assetField: null,
      selectedCountry: null,
      selectedAudience: null,
      selectedLanguage: null,
      selectedTag: null,
      selectedAsset: null,
      capabilityFacetFields: [facet],
      profileConditions: [],
    };

    expect(
      buildSelectedFilters({
        ...baseInput,
        selectedCapabilityApplicability: `${facet.key}:not_null`,
      }),
    ).toEqual([{ field: facet.key, op: "not_null", value: null }]);
    expect(
      buildSelectedFilters({
        ...baseInput,
        selectedCapabilityApplicability: `${facet.key}:is_null`,
      }),
    ).toEqual([{ field: facet.key, op: "is_null", value: null }]);
  });
});
