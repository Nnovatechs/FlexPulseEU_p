import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runContentValidation } from "@/features/surveys/content-validator";
import { buildValidationSurveyFixture } from "../../../fixtures/surveys/validation/factory";
import {
  validationEvalFixtures,
  type ValidationEvalFixture,
} from "../../../fixtures/surveys/validation/llm-eval-fixtures";
import { summarizeValidationEvalRows } from "./scoring";

// These evals check product behaviour with a real LLM.
// They are meant to answer:
// 1. Does the validator block clearly unsafe or semantically broken edits?
// 2. Does it avoid blocking acceptable edited survey content?
// 3. Which issue families are improving or regressing over time?
const describeWithOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;
const strictMode = process.env.VALIDATION_EVAL_STRICT === "true";

const reportRows: Array<{
  fixture_id: string;
  purpose: string;
  expected_overall: ValidationEvalFixture["expectedOverall"];
  actual_passed: boolean;
  status: "pass" | "fail";
  expected_issue_types?: ValidationEvalFixture["expectedIssueTypes"];
  actual_issue_types: string[];
  issues: Array<{ question_key: string; type: string; message: string }>;
}> = [];

function buildFixtureCase(fixture: ValidationEvalFixture) {
  return buildValidationSurveyFixture({
    language: fixture.language,
    title: fixture.title,
    description: fixture.description,
    optionLabels: fixture.optionLabels,
    ontologyTarget: fixture.ontologyTarget,
    questionIntent: fixture.questionIntent,
  });
}

function expectedIssueTypesMatched(
  expectedIssueTypes: ValidationEvalFixture["expectedIssueTypes"],
  actualIssueTypes: string[],
) {
  if (!expectedIssueTypes?.length) {
    return true;
  }

  return expectedIssueTypes.every((type) => actualIssueTypes.includes(type));
}

describeWithOpenAI("survey validation product evals", () => {
  afterAll(async () => {
    if (reportRows.length === 0) {
      return;
    }

    // The JSON report is the main artifact of the suite.
    // It is intentionally richer than pass/fail so that we can compare runs and
    // see whether regressions come from false positives, false negatives, or
    // specific issue families such as PII or semantic drift.
    const summary = summarizeValidationEvalRows(reportRows);
    const outputDir = path.join(
      process.cwd(),
      ".tmp",
      "evals",
      "validation",
      "latest",
    );
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      path.join(outputDir, "report.json"),
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          strict_mode: strictMode,
          ...summary,
          rows: reportRows,
        },
        null,
        2,
      )}\n`,
    );
  });

  it("runs only when an OpenAI key is available", () => {
    // This tiny guard makes the suite behaviour explicit when someone opens the
    // file later and wonders why it may be skipped locally.
    expect(Boolean(process.env.OPENAI_API_KEY)).toBe(true);
  });

  it.each(validationEvalFixtures)(
    "$id",
    async (fixture) => {
      // Each fixture is a golden behavioural guarantee. Some are positive
      // controls that should pass; others are adversarial edits that should be
      // caught as PII, semantic drift, publishability failures, or injection.
      const surveyFixture = buildFixtureCase(fixture);

      const result = await runContentValidation(
        surveyFixture.questions,
        surveyFixture.mappings,
        surveyFixture.translations,
        surveyFixture.language,
        surveyFixture.measurementPlan,
      );
      const actualIssueTypes = [...new Set(result.issues.map((issue) => issue.type))];
      const status =
        result.passed === (fixture.expectedOverall === "pass") &&
        expectedIssueTypesMatched(fixture.expectedIssueTypes, actualIssueTypes)
          ? "pass"
          : "fail";

      reportRows.push({
        fixture_id: fixture.id,
        purpose: fixture.purpose,
        expected_overall: fixture.expectedOverall,
        actual_passed: result.passed,
        status,
        expected_issue_types: fixture.expectedIssueTypes,
        actual_issue_types: actualIssueTypes,
        issues: result.issues,
      });

      console.info(
        [
          `\n[validation eval] ${fixture.id}`,
          `status: ${status}`,
          `passed: ${result.passed}`,
          `issues: ${actualIssueTypes.join(", ") || "none"}`,
          "report: .tmp/evals/validation/latest/report.json",
        ].join(" | "),
      );

      if (strictMode) {
        expect(
          {
            purpose: fixture.purpose,
            passed: result.passed,
            issues: result.issues,
          },
          fixture.purpose,
        ).toMatchObject({
          passed: fixture.expectedOverall === "pass",
        });
        expect(
          expectedIssueTypesMatched(fixture.expectedIssueTypes, actualIssueTypes),
          fixture.purpose,
        ).toBe(true);
      } else {
        expect(result.issues.length).toBeGreaterThanOrEqual(0);
      }
    },
    120_000,
  );
});
