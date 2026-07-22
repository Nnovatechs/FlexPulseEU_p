import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  createDeclaredFlexibilityCapabilityDefinitionArtifacts,
  DFC_INVENTORY_QUESTION_KEY,
} from "@/features/surveys/declared-flexibility-capability-module";
import {
  resolveQuestionApplicability,
  validateQuestionVisibilityRules,
} from "@/features/surveys/question-visibility";
import {
  buildSurveyAnalyticsSchema,
  runSurveyAnalyticsQuery,
} from "@/features/surveys/survey-analytics";
import {
  buildDfcEvalSurveyFixture,
  DFC_TRUST_QUESTION_KEY,
  DFC_WILLINGNESS_QUESTION_KEY,
} from "../../../fixtures/surveys/dfc/survey";
import {
  buildDfcSyntheticCohortDataset,
  buildDfcSyntheticCohortPersonas,
  DFC_REPLICATES_PER_CELL,
  DFC_SYNTHETIC_COHORT_SIZE,
  dfcCapabilityArchetypes,
  mapDfcSyntheticPersona,
} from "../../../fixtures/surveys/dfc/synthetic-cohort";

const dataset = buildDfcSyntheticCohortDataset();
const schema = buildSurveyAnalyticsSchema({
  survey: dataset.survey,
  readyResponseCount: dataset.rows.length,
});

function metric(key: string) {
  const result = runSurveyAnalyticsQuery({
    schema,
    rows: dataset.rows,
    query: {
      metrics: [
        { key: "responses", kind: "count" },
        { key, kind: "average", field: key },
      ],
    },
  });
  return result.groups[0]?.metrics[key];
}

function pearson(left: number[], right: number[]) {
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const numerator = left.reduce(
    (sum, value, index) =>
      sum + (value - leftMean) * (right[index] - rightMean),
    0,
  );
  const leftSquares = left.reduce(
    (sum, value) => sum + (value - leftMean) ** 2,
    0,
  );
  const rightSquares = right.reduce(
    (sum, value) => sum + (value - rightMean) ** 2,
    0,
  );
  return numerator / Math.sqrt(leftSquares * rightSquares);
}

afterAll(async () => {
  const outputDir = path.join(process.cwd(), ".tmp", "evals", "dfc", "latest");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "report.json"),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        module_version: "v1",
        respondent_count: dataset.rows.length,
        capability_archetype_count: dfcCapabilityArchetypes.length,
        trust_band_count: 3,
        willingness_band_count: 3,
        replicates_per_cell: DFC_REPLICATES_PER_CELL,
        applicable_count: dataset.rows.filter(
          (row) =>
            row.mapper_output.profile.declared_flexibility_capability?.value !=
            null,
        ).length,
      },
      null,
      2,
    )}\n`,
  );
});

describe("DFC v1 compatibility evals", () => {
  it("keeps module, survey and cohort generation deterministic", () => {
    const firstArtifacts =
      createDeclaredFlexibilityCapabilityDefinitionArtifacts(3);
    const secondArtifacts =
      createDeclaredFlexibilityCapabilityDefinitionArtifacts(3);
    const firstSurvey = buildDfcEvalSurveyFixture();
    const secondSurvey = buildDfcEvalSurveyFixture();
    const firstCohort = buildDfcSyntheticCohortPersonas();
    const secondCohort = buildDfcSyntheticCohortPersonas();

    expect(firstArtifacts).toEqual(secondArtifacts);
    expect(firstSurvey).toEqual(secondSurvey);
    expect(firstCohort).toEqual(secondCohort);
    expect(firstSurvey.definition_json.survey_meta.capability_module_version).toBe(
      "v1",
    );
    expect(firstCohort).toHaveLength(DFC_SYNTHETIC_COHORT_SIZE);
  });

  it("resolves sentinel, single-asset and multi-asset branching", () => {
    expect(
      validateQuestionVisibilityRules(dataset.survey.definition_json.questions),
    ).toEqual([]);

    const expectedVisibleCounts = {
      none_declared: 3,
      not_sure_declared: 3,
      single_ev_high: 7,
      single_washer_low: 7,
      multi_asset_medium: 11,
    } as const;

    for (const archetype of dfcCapabilityArchetypes) {
      const persona = dataset.personas.find(
        (candidate) => candidate.capabilityArchetype === archetype.key,
      );
      expect(persona).toBeDefined();
      const applicability = resolveQuestionApplicability(
        dataset.survey.definition_json.questions,
        persona?.answers ?? {},
      );

      expect(applicability.questions).toHaveLength(
        expectedVisibleCounts[archetype.key],
      );
      expect(applicability.questionKeys.has(DFC_INVENTORY_QUESTION_KEY)).toBe(
        true,
      );
      expect(applicability.requiredQuestionKeys).toEqual(
        applicability.questionKeys,
      );
    }
  });

  it("maps null, set subscores, overall means and bands correctly", () => {
    for (const archetype of dfcCapabilityArchetypes) {
      const persona = dataset.personas.find(
        (candidate) => candidate.capabilityArchetype === archetype.key,
      );
      if (!persona) {
        throw new Error(`Missing persona for ${archetype.key}.`);
      }
      const output = mapDfcSyntheticPersona(persona);
      const capability =
        output.profile.declared_flexibility_capability;

      expect(capability?.value).toBe(archetype.expectedValue);
      expect(capability?.tag).toBe(archetype.expectedBand ?? undefined);
      if (archetype.expectedValue == null) {
        expect(capability?.facets).toBeUndefined();
        continue;
      }

      expect(Object.keys(capability?.facets ?? {}).sort()).toEqual(
        Object.keys(archetype.setScores).sort(),
      );
      for (const [setKey, setScore] of Object.entries(archetype.setScores)) {
        expect(capability?.facets?.[setKey]).toEqual({
          value: setScore,
          evidence_count: 4,
          evidence_level: "facet_subscore",
        });
      }
    }
  });

  it("exposes DFC analytics fields, tags, filters, facets and sample sizes", () => {
    const fieldsByKey = new Map(
      schema.fields.map((field) => [field.key, field]),
    );
    const capabilityValueKey =
      "profile.declared_flexibility_capability.value";
    const capabilityTagKey = "profile.declared_flexibility_capability.tag";
    const facetKeys = [
      "washing_machine_scheduling",
      "ev_charging",
      "space_conditioning",
      "water_heating",
      "battery_operation",
    ].map(
      (facet) =>
        `profile.declared_flexibility_capability.facets.${facet}.value`,
    );

    expect(fieldsByKey.get(capabilityValueKey)).toMatchObject({
      value_type: "number",
      filter_operators: expect.arrayContaining(["gte", "lte", "between"]),
      metric_kinds: expect.arrayContaining(["average"]),
    });
    expect(fieldsByKey.get(capabilityTagKey)).toMatchObject({
      value_type: "tag",
      filter_operators: expect.arrayContaining(["eq", "in"]),
      metric_kinds: expect.arrayContaining(["share_equals"]),
    });
    for (const key of facetKeys) {
      expect(fieldsByKey.get(key)).toMatchObject({
        facet: expect.any(String),
        evidence_level: "facet_subscore",
        metric_kinds: expect.arrayContaining(["average"]),
      });
    }

    const aggregate = runSurveyAnalyticsQuery({
      schema,
      rows: dataset.rows,
      query: {
        metrics: [
          { key: "responses", kind: "count" },
          { key: "avg_dfc", kind: "average", field: capabilityValueKey },
          {
            key: "low_share",
            kind: "share_equals",
            field: capabilityTagKey,
            value: "low",
          },
          {
            key: "medium_share",
            kind: "share_equals",
            field: capabilityTagKey,
            value: "medium",
          },
          {
            key: "high_share",
            kind: "share_equals",
            field: capabilityTagKey,
            value: "high",
          },
          {
            key: "avg_ev",
            kind: "average",
            field:
              "profile.declared_flexibility_capability.facets.ev_charging.value",
          },
          {
            key: "avg_washer",
            kind: "average",
            field:
              "profile.declared_flexibility_capability.facets.washing_machine_scheduling.value",
          },
          {
            key: "avg_space",
            kind: "average",
            field:
              "profile.declared_flexibility_capability.facets.space_conditioning.value",
          },
        ],
      },
    }).groups[0];

    expect(aggregate?.metrics.responses.value).toBe(270);
    expect(aggregate?.metrics.avg_dfc).toMatchObject({
      value: 3,
      sample_size: 162,
    });
    for (const key of ["low_share", "medium_share", "high_share"]) {
      expect(aggregate?.metrics[key]).toMatchObject({
        value: 1 / 3,
        sample_size: 162,
        matched_count: 54,
      });
    }
    expect(aggregate?.metrics.avg_ev).toMatchObject({
      value: 3.5,
      sample_size: 108,
    });
    expect(aggregate?.metrics.avg_washer).toMatchObject({
      value: 1,
      sample_size: 54,
    });
    expect(aggregate?.metrics.avg_space).toMatchObject({
      value: 4,
      sample_size: 54,
    });

    const highCapability = runSurveyAnalyticsQuery({
      schema,
      rows: dataset.rows,
      query: {
        filters: [{ field: capabilityTagKey, op: "eq", value: "high" }],
        metrics: [{ key: "responses", kind: "count" }],
      },
    });
    const evOwners = runSurveyAnalyticsQuery({
      schema,
      rows: dataset.rows,
      query: {
        filters: [
          {
            field: "profile.owned_der_assets.value",
            op: "contains",
            value: "ev",
          },
        ],
        metrics: [{ key: "responses", kind: "count" }],
      },
    });
    expect(highCapability.matched_response_count).toBe(54);
    expect(evOwners.matched_response_count).toBe(108);
  });

  it("keeps capability constructively independent of willingness and trust", () => {
    const cellCounts = new Map<string, number>();
    for (const persona of dataset.personas) {
      const key = [
        persona.capabilityArchetype,
        persona.trustBand,
        persona.willingnessBand,
      ].join("|");
      cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
    }
    expect(cellCounts).toHaveLength(45);
    expect(new Set(cellCounts.values())).toEqual(
      new Set([DFC_REPLICATES_PER_CELL]),
    );

    for (const groupingField of [
      "profile.trust_in_automation.tag",
      "profile.flexibility_willingness.tag",
    ]) {
      const grouped = runSurveyAnalyticsQuery({
        schema,
        rows: dataset.rows,
        query: {
          group_by: [groupingField],
          metrics: [
            {
              key: "avg_dfc",
              kind: "average",
              field: "profile.declared_flexibility_capability.value",
            },
          ],
        },
      });
      expect(grouped.groups).toHaveLength(3);
      for (const group of grouped.groups) {
        expect(group.metrics.avg_dfc).toMatchObject({
          value: 3,
          sample_size: 54,
        });
      }
    }

    const applicableRows = dataset.rows.filter(
      (row) =>
        typeof row.mapper_output.profile.declared_flexibility_capability
          ?.value === "number",
    );
    const capabilityValues = applicableRows.map(
      (row) =>
        row.mapper_output.profile.declared_flexibility_capability
          ?.value as number,
    );
    const trustValues = applicableRows.map(
      (row) => row.mapper_output.profile.trust_in_automation?.value as number,
    );
    const willingnessValues = applicableRows.map(
      (row) =>
        row.mapper_output.profile.flexibility_willingness?.value as number,
    );

    expect(pearson(capabilityValues, trustValues)).toBeCloseTo(0, 12);
    expect(pearson(capabilityValues, willingnessValues)).toBeCloseTo(0, 12);
    expect(
      dataset.personas.every(
        (persona) =>
          persona.answers[DFC_TRUST_QUESTION_KEY] != null &&
          persona.answers[DFC_WILLINGNESS_QUESTION_KEY] != null,
      ),
    ).toBe(true);
  });

  it("reports zero-sample facets as null without treating them as low", () => {
    const water = metric(
      "profile.declared_flexibility_capability.facets.water_heating.value",
    );
    const battery = metric(
      "profile.declared_flexibility_capability.facets.battery_operation.value",
    );

    expect(water).toMatchObject({ value: null, sample_size: 0 });
    expect(battery).toMatchObject({ value: null, sample_size: 0 });
  });
});
