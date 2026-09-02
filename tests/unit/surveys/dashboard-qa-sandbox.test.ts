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
});
