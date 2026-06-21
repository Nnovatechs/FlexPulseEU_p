import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildSurveyAnalyticsSchema,
  runSurveyAnalyticsQuery,
  type SurveyAnalyticsQueryResult,
} from "@/features/surveys/survey-analytics";
import {
  buildSyntheticCohortDataset,
  syntheticCohortArchetypes,
} from "../../../fixtures/surveys/mapper-profiling/synthetic-cohorts";
import { summarizeProfilingEvalRows } from "./profiling-scoring";

type SyntheticCohortEvalRow = {
  check_id: string;
  purpose: string;
  checks: number;
  matches: number;
  failures: string[];
  status: "pass" | "fail";
};

const reportRows: SyntheticCohortEvalRow[] = [];

function metricValue(
  result: SurveyAnalyticsQueryResult,
  archetypeKey: string,
  metricKey: string,
) {
  const group = result.groups.find(
    (candidate) => candidate.group["response.audience_token"] === archetypeKey,
  );
  return group?.metrics[metricKey]?.value ?? null;
}

function metricSampleSize(
  result: SurveyAnalyticsQueryResult,
  archetypeKey: string,
  metricKey: string,
) {
  const group = result.groups.find(
    (candidate) => candidate.group["response.audience_token"] === archetypeKey,
  );
  return group?.metrics[metricKey]?.sample_size ?? 0;
}

function responseCount(result: SurveyAnalyticsQueryResult, archetypeKey: string) {
  return (
    result.groups.find(
      (candidate) => candidate.group["response.audience_token"] === archetypeKey,
    )?.response_count ?? 0
  );
}

function bandForAverage(value: number | null) {
  if (value == null) {
    return "missing";
  }
  if (value <= 2.25) {
    return "low";
  }
  if (value >= 3.75) {
    return "high";
  }
  return "medium";
}

function addCheck(
  row: SyntheticCohortEvalRow,
  label: string,
  passed: boolean,
  detail: string,
) {
  row.checks += 1;
  if (passed) {
    row.matches += 1;
    return;
  }

  row.failures.push(`${label}: ${detail}`);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function directAverageByArchetype(
  rows: ReturnType<typeof buildSyntheticCohortDataset>["rows"],
  archetypeKey: string,
  conceptKey: string,
) {
  return average(
    rows
      .filter((row) => row.audience_token === archetypeKey)
      .map((row) => row.mapper_output.profile[conceptKey]?.value)
      .filter((value): value is number => typeof value === "number"),
  );
}

function directFacetAverageByArchetype(
  rows: ReturnType<typeof buildSyntheticCohortDataset>["rows"],
  archetypeKey: string,
  conceptKey: string,
  facet: string,
) {
  return average(
    rows
      .filter((row) => row.audience_token === archetypeKey)
      .map((row) => row.mapper_output.profile[conceptKey]?.facets?.[facet]?.value)
      .filter((value): value is number => typeof value === "number"),
  );
}

function finalizeRow(row: SyntheticCohortEvalRow) {
  row.status = row.failures.length === 0 ? "pass" : "fail";
  reportRows.push(row);
  expect(row.failures, row.purpose).toEqual([]);
}

describe("survey synthetic cohort profiling evals", () => {
  const dataset = buildSyntheticCohortDataset();
  const schema = buildSurveyAnalyticsSchema({
    survey: dataset.survey,
    readyResponseCount: dataset.rows.length,
  });
  const cohortQueryResult = runSurveyAnalyticsQuery({
    schema,
    rows: dataset.rows,
    query: {
      group_by: ["response.audience_token"],
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
          key: "avg_comfort",
          kind: "average",
          field: "profile.thermal_comfort_norms.value",
        },
        {
          key: "avg_reliability_facet",
          kind: "average",
          field: "profile.trust_in_automation.facets.reliability.value",
        },
        {
          key: "avg_control_concern_facet",
          kind: "average",
          field: "profile.trust_in_automation.facets.control_concern.value",
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

  afterAll(async () => {
    const outputDir = path.join(
      process.cwd(),
      ".tmp",
      "evals",
      "synthetic-cohorts",
      "latest",
    );
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      path.join(outputDir, "report.json"),
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          respondent_count: dataset.rows.length,
          archetype_count: syntheticCohortArchetypes.length,
          ...summarizeProfilingEvalRows(reportRows),
          rows: reportRows,
        },
        null,
        2,
      )}\n`,
    );
  });

  it("recovers expected profile bands for each synthetic archetype", () => {
    const row: SyntheticCohortEvalRow = {
      check_id: "archetype_band_recovery",
      purpose: "Verify seeded archetypes recover the expected low/medium/high bands.",
      checks: 0,
      matches: 0,
      failures: [],
      status: "fail",
    };

    for (const archetype of syntheticCohortArchetypes) {
      const trust = metricValue(cohortQueryResult, archetype.key, "avg_trust");
      const flexibility = metricValue(cohortQueryResult, archetype.key, "avg_flexibility");
      const comfort = metricValue(cohortQueryResult, archetype.key, "avg_comfort");

      addCheck(
        row,
        `${archetype.key} trust band`,
        bandForAverage(trust) === archetype.expectedBands.trust,
        `expected ${archetype.expectedBands.trust}, got ${bandForAverage(trust)} from ${trust}`,
      );
      addCheck(
        row,
        `${archetype.key} flexibility band`,
        bandForAverage(flexibility) === archetype.expectedBands.flexibility,
        `expected ${archetype.expectedBands.flexibility}, got ${bandForAverage(
          flexibility,
        )} from ${flexibility}`,
      );
      addCheck(
        row,
        `${archetype.key} comfort band`,
        bandForAverage(comfort) === archetype.expectedBands.comfort,
        `expected ${archetype.expectedBands.comfort}, got ${bandForAverage(comfort)} from ${comfort}`,
      );
    }

    finalizeRow(row);
  });

  it("matches analytics aggregates against independent mapper-output aggregation", () => {
    const row: SyntheticCohortEvalRow = {
      check_id: "aggregate_consistency",
      purpose: "Verify analytics averages match independently aggregated mapper outputs.",
      checks: 0,
      matches: 0,
      failures: [],
      status: "fail",
    };

    for (const archetype of syntheticCohortArchetypes) {
      for (const [metricKey, conceptKey] of [
        ["avg_trust", "trust_in_automation"],
        ["avg_flexibility", "flexibility_willingness"],
        ["avg_comfort", "thermal_comfort_norms"],
      ] as const) {
        const analyticsValue = metricValue(cohortQueryResult, archetype.key, metricKey);
        const directValue = directAverageByArchetype(
          dataset.rows,
          archetype.key,
          conceptKey,
        );

        addCheck(
          row,
          `${archetype.key} ${metricKey}`,
          analyticsValue != null &&
            directValue != null &&
            Math.abs(analyticsValue - directValue) < 0.000001,
          `analytics ${analyticsValue}, direct ${directValue}`,
        );
      }
    }

    finalizeRow(row);
  });

  it("recovers seeded ranking and contradictory facet signals", () => {
    const row: SyntheticCohortEvalRow = {
      check_id: "ranking_and_contradiction_recovery",
      purpose: "Verify strong cohort ordering and contradictory profile facets are visible.",
      checks: 0,
      matches: 0,
      failures: [],
      status: "fail",
    };
    const automationTrust = metricValue(cohortQueryResult, "automation_ready", "avg_trust");
    const controlTrust = metricValue(cohortQueryResult, "control_protective", "avg_trust");
    const derEvShare = metricValue(cohortQueryResult, "der_engaged", "ev_asset_share");
    const neutralEvShare = metricValue(cohortQueryResult, "neutral_mainstream", "ev_asset_share");
    const contradictoryReliability = directFacetAverageByArchetype(
      dataset.rows,
      "contradictory",
      "trust_in_automation",
      "reliability",
    );
    const contradictoryControl = directFacetAverageByArchetype(
      dataset.rows,
      "contradictory",
      "trust_in_automation",
      "control_concern",
    );

    addCheck(
      row,
      "automation trust above control-protective trust",
      automationTrust != null && controlTrust != null && automationTrust - controlTrust >= 2,
      `automation ${automationTrust}, control ${controlTrust}`,
    );
    addCheck(
      row,
      "DER engaged EV share above neutral mainstream",
      derEvShare != null && neutralEvShare != null && derEvShare - neutralEvShare >= 0.5,
      `der ${derEvShare}, neutral ${neutralEvShare}`,
    );
    addCheck(
      row,
      "contradictory reliability facet remains high",
      contradictoryReliability != null && contradictoryReliability >= 4.5,
      `reliability ${contradictoryReliability}`,
    );
    addCheck(
      row,
      "contradictory control-concern facet remains low after reverse coding",
      contradictoryControl != null && contradictoryControl <= 1.5,
      `control ${contradictoryControl}`,
    );

    finalizeRow(row);
  });

  it("keeps sparse cohorts visible while reducing valid metric sample sizes", () => {
    const row: SyntheticCohortEvalRow = {
      check_id: "sparse_response_handling",
      purpose: "Verify partial responses remain countable while null metrics reduce sample size.",
      checks: 0,
      matches: 0,
      failures: [],
      status: "fail",
    };
    const sparseResponses = responseCount(cohortQueryResult, "partial_sparse");
    const sparseTrustSampleSize = metricSampleSize(
      cohortQueryResult,
      "partial_sparse",
      "avg_trust",
    );

    addCheck(
      row,
      "partial sparse response count",
      sparseResponses === 28,
      `responses ${sparseResponses}`,
    );
    addCheck(
      row,
      "partial sparse sample size is lower than response count",
      sparseTrustSampleSize > 0 && sparseTrustSampleSize < sparseResponses,
      `sample ${sparseTrustSampleSize}, responses ${sparseResponses}`,
    );

    finalizeRow(row);
  });
});
