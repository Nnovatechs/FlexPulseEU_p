import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildSurveyAnalyticsSchema,
  runSurveyAnalyticsQuery,
  type SurveyAnalyticsQueryResult,
} from "@/features/surveys/survey-analytics";
import {
  buildAnalyticsRecordForPersona,
  buildMapperProfilingSurveyFixture,
  syntheticPersonas,
} from "../../../fixtures/surveys/mapper-profiling/factory";
import { summarizeProfilingEvalRows } from "./profiling-scoring";

type ProfilingEvalRow = {
  check_id: string;
  purpose: string;
  checks: number;
  matches: number;
  failures: string[];
  status: "pass" | "fail";
};

const reportRows: ProfilingEvalRow[] = [];

function metricValue(
  result: SurveyAnalyticsQueryResult,
  groupField: string,
  groupValue: string | null,
  metricKey: string,
) {
  const group = result.groups.find((candidate) => candidate.group[groupField] === groupValue);
  return group?.metrics[metricKey]?.value;
}

function metricSampleSize(
  result: SurveyAnalyticsQueryResult,
  groupField: string,
  groupValue: string | null,
  metricKey: string,
) {
  const group = result.groups.find((candidate) => candidate.group[groupField] === groupValue);
  return group?.metrics[metricKey]?.sample_size;
}

function addCheck(
  row: ProfilingEvalRow,
  label: string,
  actual: unknown,
  expected: unknown,
) {
  row.checks += 1;
  const matches =
    typeof actual === "number" && typeof expected === "number"
      ? Math.abs(actual - expected) < 0.000001
      : actual === expected;

  if (matches) {
    row.matches += 1;
    return;
  }

  row.failures.push(`${label} expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

function finalizeRow(row: ProfilingEvalRow) {
  row.status = row.failures.length === 0 ? "pass" : "fail";
  reportRows.push(row);
  expect(row.failures, row.purpose).toEqual([]);
}

describe("survey profiling evals", () => {
  const survey = buildMapperProfilingSurveyFixture();
  const rows = syntheticPersonas.map((persona) =>
    buildAnalyticsRecordForPersona(survey, persona),
  );
  const schema = buildSurveyAnalyticsSchema({
    survey,
    readyResponseCount: rows.length,
  });

  afterAll(async () => {
    const outputDir = path.join(process.cwd(), ".tmp", "evals", "profiling", "latest");
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      path.join(outputDir, "report.json"),
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          ...summarizeProfilingEvalRows(reportRows),
          rows: reportRows,
        },
        null,
        2,
      )}\n`,
    );
  });

  it("builds an analytics schema from the measurement plan and response context", () => {
    const row: ProfilingEvalRow = {
      check_id: "schema_fields",
      purpose: "Ensure profiling exposes concept, facet and context fields.",
      checks: 0,
      matches: 0,
      failures: [],
      status: "fail",
    };
    const fieldKeys = new Set(schema.fields.map((field) => field.key));

    addCheck(row, "survey id", schema.survey_id, survey.id);
    addCheck(row, "ready response count", schema.ready_response_count, rows.length);
    addCheck(row, "trust value field", fieldKeys.has("profile.trust_in_automation.value"), true);
    addCheck(row, "trust tag field", fieldKeys.has("profile.trust_in_automation.tag"), true);
    addCheck(
      row,
      "trust facet field",
      fieldKeys.has("profile.trust_in_automation.facets.reliability.value"),
      true,
    );
    addCheck(row, "country context field", fieldKeys.has("context.country_code"), true);
    addCheck(row, "geo region field", fieldKeys.has("geo.region.code"), true);

    finalizeRow(row);
  });

  it("recovers seeded cohort differences by country", () => {
    const result = runSurveyAnalyticsQuery({
      schema,
      rows,
      query: {
        group_by: ["context.country_code"],
        metrics: [
          { key: "responses", kind: "count" },
          {
            key: "avg_trust",
            kind: "average",
            field: "profile.trust_in_automation.value",
          },
          {
            key: "avg_flexibility",
            kind: "average",
            field: "profile.flexibility_willingness.value",
          },
          {
            key: "high_trust_share",
            kind: "share_equals",
            field: "profile.trust_in_automation.tag",
            value: "high",
          },
          {
            key: "ev_asset_share",
            kind: "share_contains",
            field: "profile.owned_der_assets.value",
            value: "ev",
          },
        ],
      },
    });
    const row: ProfilingEvalRow = {
      check_id: "country_cohort_recovery",
      purpose: "Ensure synthetic country cohorts preserve the seeded profile distributions.",
      checks: 0,
      matches: 0,
      failures: [],
      status: "fail",
    };

    addCheck(row, "matched response count", result.matched_response_count, 6);
    addCheck(row, "ES avg trust", metricValue(result, "context.country_code", "ES", "avg_trust"), 5);
    addCheck(
      row,
      "ES avg flexibility",
      metricValue(result, "context.country_code", "ES", "avg_flexibility"),
      4,
    );
    addCheck(
      row,
      "ES high trust share",
      metricValue(result, "context.country_code", "ES", "high_trust_share"),
      1,
    );
    addCheck(
      row,
      "ES EV share",
      metricValue(result, "context.country_code", "ES", "ev_asset_share"),
      1,
    );
    addCheck(
      row,
      "HR avg trust excludes null partial",
      metricValue(result, "context.country_code", "HR", "avg_trust"),
      1,
    );
    addCheck(
      row,
      "HR trust sample size",
      metricSampleSize(result, "context.country_code", "HR", "avg_trust"),
      1,
    );
    addCheck(
      row,
      "FR heat pump respondent avg flexibility",
      metricValue(result, "context.country_code", "FR", "avg_flexibility"),
      4,
    );

    finalizeRow(row);
  });

  it("supports filters, array membership and geo grouping", () => {
    const result = runSurveyAnalyticsQuery({
      schema,
      rows,
      query: {
        filters: [
          {
            field: "profile.owned_der_assets.value",
            op: "contains",
            value: "ev",
          },
        ],
        group_by: ["geo.region.code"],
        metrics: [
          { key: "responses", kind: "count" },
          {
            key: "avg_tariff_orientation",
            kind: "average",
            field: "profile.tariff_preference_orientation.value",
          },
        ],
      },
    });
    const row: ProfilingEvalRow = {
      check_id: "filters_and_geo_grouping",
      purpose: "Ensure profiling queries can isolate asset owners and group by normalized geography.",
      checks: 0,
      matches: 0,
      failures: [],
      status: "fail",
    };

    addCheck(row, "matched EV responses", result.matched_response_count, 2);
    addCheck(row, "single ES region group", result.groups.length, 1);
    addCheck(row, "ES region response count", result.groups[0]?.response_count, 2);
    addCheck(
      row,
      "EV owner tariff average",
      result.groups[0]?.metrics.avg_tariff_orientation.value,
      4.25,
    );

    finalizeRow(row);
  });
});
