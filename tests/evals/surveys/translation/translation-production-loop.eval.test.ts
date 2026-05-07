import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { generateAndValidateTranslatedLanguage } from "@/features/surveys/translation-loop";
import {
  productionTranslationLoopFixtures,
} from "../../../fixtures/surveys/translation/production-loop-fixtures";
import { summarizeProductionTranslationLoopRows } from "./production-loop-scoring";

const describeWithOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;
const strictMode = process.env.TRANSLATION_LOOP_EVAL_STRICT === "true";

const reportRows: Array<{
  fixture_id: string;
  purpose: string;
  source_language: string;
  target_language: string;
  expected_final_pass: boolean;
  initial_passed: boolean;
  final_passed: boolean;
  attempts: number;
  retry_used: boolean;
  recovered_after_retry: boolean;
  initial_issue_types: string[];
  final_issue_types: string[];
  initial_issues: Array<{ language: string; question_key?: string; type: string; message: string }>;
  final_issues: Array<{ language: string; question_key?: string; type: string; message: string }>;
}> = [];

function flattenCases() {
  return productionTranslationLoopFixtures.flatMap((fixture) =>
    fixture.targetLanguages.map((targetLanguage) => ({
      fixture,
      targetLanguage,
      id: `${fixture.id}__${targetLanguage.toLowerCase()}`,
    })),
  );
}

describeWithOpenAI("survey multicultural pipeline evals", () => {
  afterAll(async () => {
    if (reportRows.length === 0) {
      return;
    }

    const summary = summarizeProductionTranslationLoopRows(reportRows);
    const outputDir = path.join(
      process.cwd(),
      ".tmp",
      "evals",
      "multicultural-pipeline",
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
    expect(Boolean(process.env.OPENAI_API_KEY)).toBe(true);
  });

  it.each(flattenCases())(
    "$id",
    async ({ fixture, targetLanguage }) => {
      const result = await generateAndValidateTranslatedLanguage({
        surveyName: fixture.surveyName,
        sourceLanguage: fixture.sourceLanguage,
        targetLanguage,
        sourceTranslations: fixture.sourceTranslations,
        questions: fixture.questions,
        mappings: fixture.mappings,
      });

      const initialIssueTypes = [...new Set(result.initialIssues.map((issue) => issue.type))];
      const finalIssueTypes = [...new Set(result.issues.map((issue) => issue.type))];
      const initialPassed = result.initialIssues.length === 0;
      const finalPassed = result.issues.length === 0;
      const retryUsed = result.attempts > 1;
      const recoveredAfterRetry = retryUsed && initialPassed === false && finalPassed === true;
      const status =
        finalPassed === fixture.expectedFinalPass
          ? "pass"
          : "fail";

      reportRows.push({
        fixture_id: fixture.id,
        purpose: fixture.purpose,
        source_language: fixture.sourceLanguage,
        target_language: targetLanguage,
        expected_final_pass: fixture.expectedFinalPass,
        initial_passed: initialPassed,
        final_passed: finalPassed,
        attempts: result.attempts,
        retry_used: retryUsed,
        recovered_after_retry: recoveredAfterRetry,
        initial_issue_types: initialIssueTypes,
        final_issue_types: finalIssueTypes,
        initial_issues: result.initialIssues,
        final_issues: result.issues,
      });

      console.info(
        [
          `\n[multicultural pipeline] ${fixture.id} -> ${targetLanguage}`,
          `status: ${status}`,
          `initial_passed: ${initialPassed}`,
          `final_passed: ${finalPassed}`,
          `attempts: ${result.attempts}`,
          `initial_issues: ${initialIssueTypes.join(", ") || "none"}`,
          `final_issues: ${finalIssueTypes.join(", ") || "none"}`,
          "report: .tmp/evals/multicultural-pipeline/latest/report.json",
        ].join(" | "),
      );

      if (strictMode) {
        expect(
          {
            purpose: fixture.purpose,
            targetLanguage,
            finalPassed,
            issues: result.issues,
          },
          fixture.purpose,
        ).toMatchObject({
          finalPassed: fixture.expectedFinalPass,
        });
      } else {
        expect(result.attempts).toBeGreaterThanOrEqual(1);
      }
    },
    180_000,
  );
});
