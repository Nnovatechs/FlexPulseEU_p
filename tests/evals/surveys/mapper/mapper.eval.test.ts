import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { MapperOutput } from "@/features/surveys/generator-types";
import {
  buildMapperProfilingSurveyFixture,
  mapSyntheticPersona,
  syntheticPersonas,
  type SyntheticPersona,
} from "../../../fixtures/surveys/mapper-profiling/factory";
import { summarizeMapperEvalRows } from "./mapper-scoring";

type MapperEvalRow = {
  persona_id: string;
  purpose: string;
  value_checks: number;
  value_matches: number;
  tag_checks: number;
  tag_matches: number;
  facet_checks: number;
  facet_matches: number;
  failures: string[];
  status: "pass" | "fail";
};

const reportRows: MapperEvalRow[] = [];

function valuesMatch(left: unknown, right: unknown) {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 0.000001;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

function scoreMappedProfile(persona: SyntheticPersona, output: MapperOutput): MapperEvalRow {
  const row: MapperEvalRow = {
    persona_id: persona.id,
    purpose: persona.purpose,
    value_checks: 0,
    value_matches: 0,
    tag_checks: 0,
    tag_matches: 0,
    facet_checks: 0,
    facet_matches: 0,
    failures: [],
    status: "pass",
  };

  for (const [conceptKey, expected] of Object.entries(persona.expectedProfile)) {
    const actual = output.profile[conceptKey];
    row.value_checks += 1;
    if (valuesMatch(actual?.value ?? null, expected.value)) {
      row.value_matches += 1;
    } else {
      row.failures.push(
        `${conceptKey}.value expected ${JSON.stringify(expected.value)} got ${JSON.stringify(
          actual?.value ?? null,
        )}`,
      );
    }

    if (expected.tag) {
      row.tag_checks += 1;
      if (actual?.tag === expected.tag) {
        row.tag_matches += 1;
      } else {
        row.failures.push(`${conceptKey}.tag expected ${expected.tag} got ${actual?.tag}`);
      }
    }

    for (const [facet, expectedFacet] of Object.entries(expected.facets ?? {})) {
      const actualFacet = actual?.facets?.[facet];
      row.facet_checks += 3;

      if (valuesMatch(actualFacet?.value, expectedFacet.value)) {
        row.facet_matches += 1;
      } else {
        row.failures.push(
          `${conceptKey}.${facet}.value expected ${expectedFacet.value} got ${actualFacet?.value}`,
        );
      }

      if (actualFacet?.evidence_count === expectedFacet.evidence_count) {
        row.facet_matches += 1;
      } else {
        row.failures.push(
          `${conceptKey}.${facet}.evidence_count expected ${expectedFacet.evidence_count} got ${actualFacet?.evidence_count}`,
        );
      }

      if (actualFacet?.evidence_level === expectedFacet.evidence_level) {
        row.facet_matches += 1;
      } else {
        row.failures.push(
          `${conceptKey}.${facet}.evidence_level expected ${expectedFacet.evidence_level} got ${actualFacet?.evidence_level}`,
        );
      }
    }
  }

  row.status = row.failures.length === 0 ? "pass" : "fail";
  return row;
}

describe("survey mapper evals", () => {
  const survey = buildMapperProfilingSurveyFixture();

  afterAll(async () => {
    const outputDir = path.join(process.cwd(), ".tmp", "evals", "mapper", "latest");
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      path.join(outputDir, "report.json"),
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          ...summarizeMapperEvalRows(reportRows),
          rows: reportRows,
        },
        null,
        2,
      )}\n`,
    );
  });

  it.each(syntheticPersonas)("maps $id to the expected canonical profile", (persona) => {
    const output = mapSyntheticPersona(survey, persona);
    const row = scoreMappedProfile(persona, output);

    reportRows.push(row);

    expect(output.mapping_metadata.mapper_version).toBe("v1");
    expect(output.mapping_metadata.mapping_hash).toBe("mapper_eval_mapping_hash_v1");
    expect(output.mapping_metadata.measurement_hash).toBe("mapper_eval_measurement_hash_v1");
    expect(output.context_metadata.country_code).toBe(persona.countryCode);
    expect(row.failures, persona.purpose).toEqual([]);
  });
});
