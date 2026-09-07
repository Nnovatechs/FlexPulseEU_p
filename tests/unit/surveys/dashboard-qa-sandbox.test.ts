import { describe, expect, it } from "vitest";
import {
  DASHBOARD_QA_ARCHETYPE_KEYS,
  buildDashboardQaSyntheticDataset,
} from "@/features/surveys/dashboard-qa/dashboard-qa-synthetic-dataset";
import {
  DASHBOARD_QA_COUNTRIES,
  DASHBOARD_QA_COUNTRY_RESPONSE_COUNT,
  DASHBOARD_QA_RESPONSE_COUNT,
  DASHBOARD_QA_SURVEY_NAME,
} from "@/features/surveys/dashboard-qa/constants";
import { isDashboardQaSandboxSurvey } from "@/features/surveys/dashboard-qa/survey-fixture";
import { DFC_SET_KEYS } from "@/features/surveys/declared-flexibility-capability-module";

const PRIMARY_CONSTRUCTS = [
  "awareness_of_energy_systems",
  "flexibility_willingness",
  "declared_flexibility_capability",
  "thermal_comfort_norms",
  "tariff_preference_orientation",
  "trust_in_automation",
  "der_engagement",
] as const;

const MODULATORS = [
  "manual_override_need",
  "explainability_need",
  "bill_stability_need",
  "event_frequency_tolerance",
  "savings_motivation",
  "routine_dependency",
] as const;

describe("dashboard QA synthetic dataset", () => {
  const dataset = buildDashboardQaSyntheticDataset({
    surveyId: "11111111-1111-4111-a111-111111111111",
    ownerUserId: "22222222-2222-4222-a222-222222222222",
  });

  it("builds an archived fixture with a complete product instrument", () => {
    expect(dataset.survey.name).toBe(DASHBOARD_QA_SURVEY_NAME);
    expect(dataset.survey.status).toBe("archived");
    expect(isDashboardQaSandboxSurvey(dataset.survey)).toBe(true);
    expect(dataset.records).toHaveLength(DASHBOARD_QA_RESPONSE_COUNT);
    expect(DASHBOARD_QA_ARCHETYPE_KEYS).toHaveLength(10);
  });

  it("keeps a balanced IE / ES / FR split", () => {
    for (const country of DASHBOARD_QA_COUNTRIES) {
      expect(dataset.records.filter((record) => record.countryCode === country)).toHaveLength(
        DASHBOARD_QA_COUNTRY_RESPONSE_COUNT,
      );
    }
  });

  it("persists mapper outputs for every primary construct and modulator", () => {
    const withValues = dataset.records.filter((record) =>
      PRIMARY_CONSTRUCTS.every((key) => key in record.mapperOutput.profile)
      && MODULATORS.every((key) => key in record.mapperOutput.profile),
    );
    expect(withValues).toHaveLength(DASHBOARD_QA_RESPONSE_COUNT);

    for (const key of [...PRIMARY_CONSTRUCTS, ...MODULATORS]) {
      if (key === "declared_flexibility_capability") {
        continue;
      }
      const values = new Set(
        dataset.records
          .map((record) => record.mapperOutput.profile[key]?.value)
          .filter((value): value is number => typeof value === "number"),
      );
      expect(values.size).toBeGreaterThan(1);
    }
  });

  it("covers applicable and non-applicable DFC device modules", () => {
    const applicableBySet = new Map<string, number>(DFC_SET_KEYS.map((key) => [key, 0]));
    let nonApplicable = 0;

    for (const record of dataset.records) {
      const entry = record.mapperOutput.profile.declared_flexibility_capability;
      if (entry?.value == null) {
        nonApplicable += 1;
        continue;
      }
      for (const setKey of DFC_SET_KEYS) {
        if (entry.facets?.[setKey] && typeof entry.facets[setKey].value === "number") {
          applicableBySet.set(setKey, (applicableBySet.get(setKey) ?? 0) + 1);
        }
      }
    }

    expect(nonApplicable).toBeGreaterThan(0);
    for (const setKey of DFC_SET_KEYS) {
      expect(applicableBySet.get(setKey)).toBeGreaterThan(0);
    }
  });

  it("reproduces the same mapper values on rebuild", () => {
    const again = buildDashboardQaSyntheticDataset({
      surveyId: "11111111-1111-4111-a111-111111111111",
      ownerUserId: "22222222-2222-4222-a222-222222222222",
    });
    expect(again.records.map((record) => record.id)).toEqual(dataset.records.map((record) => record.id));
    expect(again.records[0]?.mapperOutput.profile.trust_in_automation?.value).toBe(
      dataset.records[0]?.mapperOutput.profile.trust_in_automation?.value,
    );
  });

  it("maps household applicability factors without mixing interested assets into owned inventory", () => {
    const keys = dataset.survey.definition_json.survey_meta.behavioural_concept_keys ?? [];
    expect(keys).toEqual(expect.arrayContaining([
      "owned_der_assets",
      "interested_der_assets",
      "winter_comfort_setpoint_c",
      "summer_comfort_setpoint_c",
      "preferred_tariff_model",
    ]));

    const mapped = dataset.records.filter((record) => {
      const profile = record.mapperOutput.profile;
      return (
        Array.isArray(profile.owned_der_assets?.value) &&
        Array.isArray(profile.interested_der_assets?.value) &&
        typeof profile.winter_comfort_setpoint_c?.value === "number" &&
        typeof profile.summer_comfort_setpoint_c?.value === "number" &&
        typeof profile.preferred_tariff_model?.value === "string"
      );
    });
    expect(mapped).toHaveLength(DASHBOARD_QA_RESPONSE_COUNT);

    const limited = dataset.records.filter((record) => record.archetypeKey === "willing_asset_limited");
    expect(limited.length).toBeGreaterThan(0);
    expect(limited.every((record) => {
      const owned = record.mapperOutput.profile.owned_der_assets?.value;
      const interested = record.mapperOutput.profile.interested_der_assets?.value;
      return Array.isArray(owned) && owned.length === 0 && Array.isArray(interested) && interested.some((item) => item === "ev");
    })).toBe(true);
  });
});
