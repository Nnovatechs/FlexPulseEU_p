import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { validateTranslatedSurveyLanguage } from "@/features/surveys/translation-validation";
import { buildTranslationSurveyFixture } from "../../../fixtures/surveys/translation/factory";
import {
  translationEvalFixtures,
  type TranslationEvalFixture,
} from "../../../fixtures/surveys/translation/llm-eval-fixtures";
import { summarizeTranslationEvalRows } from "./scoring";

// These evals check the translation validator in isolation with a real LLM.
// They are meant to answer:
// 1. Do natural publishable translations pass?
// 2. Do semantic drifts, polarity flips, awkward wording, and added PII fail?
// 3. Which languages or issue families are improving or regressing over time?
// This suite does not exercise the translation generation loop itself.
const describeWithOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;
const strictMode = process.env.TRANSLATION_EVAL_STRICT === "true";

const reportRows: Array<{
  fixture_id: string;
  purpose: string;
  source_language: string;
  target_language: string;
  expected_overall: TranslationEvalFixture["expectedOverall"];
  actual_passed: boolean;
  status: "pass" | "fail";
  expected_issue_types?: TranslationEvalFixture["expectedIssueTypes"];
  actual_issue_types: string[];
  issues: Array<{ language: string; question_key?: string; type: string; message: string }>;
}> = [];

function buildEvalCase(fixture: TranslationEvalFixture) {
  return buildTranslationSurveyFixture({
    sourceLanguage: fixture.sourceLanguage,
    targetLanguage: fixture.targetLanguage,
    sourceTitle: fixture.sourceTitle,
    targetTitle: fixture.targetTitle,
    sourceDescription: fixture.sourceDescription,
    targetDescription: fixture.targetDescription,
    optionLabels: fixture.optionLabels,
    translatedOptionLabels: fixture.translatedOptionLabels,
  });
}

function expectedIssueTypesMatched(
  expectedIssueTypes: TranslationEvalFixture["expectedIssueTypes"],
  actualIssueTypes: string[],
) {
  if (!expectedIssueTypes?.length) {
    return true;
  }

  return expectedIssueTypes.every((type) => actualIssueTypes.includes(type));
}

describeWithOpenAI("survey translation product evals", () => {
  afterAll(async () => {
    if (reportRows.length === 0) {
      return;
    }

    // The JSON report is designed to act like a lightweight KPI board for the
    // multilingual validator. It should tell us whether changes improved real
    // pass/fail behaviour, not just whether the suite stayed green.
    const summary = summarizeTranslationEvalRows(reportRows);

    const outputDir = path.join(
      process.cwd(),
      ".tmp",
      "evals",
      "translation-validator",
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

  it.each(translationEvalFixtures)(
    "$id",
    async (fixture) => {
      const surveyFixture = buildEvalCase(fixture);

      const issues = await validateTranslatedSurveyLanguage({
        sourceLanguage: surveyFixture.sourceLanguage,
        targetLanguage: surveyFixture.targetLanguage,
        sourceTranslations: surveyFixture.sourceTranslations,
        targetTranslations: surveyFixture.targetTranslations,
        questions: surveyFixture.questions,
        mappings: surveyFixture.mappings,
      });
      const actualIssueTypes = [...new Set(issues.map((issue) => issue.type))];
      const status =
        (issues.length === 0) === (fixture.expectedOverall === "pass") &&
        expectedIssueTypesMatched(fixture.expectedIssueTypes, actualIssueTypes)
          ? "pass"
          : "fail";

      reportRows.push({
        fixture_id: fixture.id,
        purpose: fixture.purpose,
        source_language: fixture.sourceLanguage,
        target_language: fixture.targetLanguage,
        expected_overall: fixture.expectedOverall,
        actual_passed: issues.length === 0,
        status,
        expected_issue_types: fixture.expectedIssueTypes,
        actual_issue_types: actualIssueTypes,
        issues,
      });

      console.info(
        [
          `\n[translation eval] ${fixture.id}`,
          `status: ${status}`,
          `passed: ${issues.length === 0}`,
          `issues: ${actualIssueTypes.join(", ") || "none"}`,
          "report: .tmp/evals/translation-validator/latest/report.json",
        ].join(" | "),
      );

      if (strictMode) {
        expect(
          {
            purpose: fixture.purpose,
            passed: issues.length === 0,
            issues,
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
        expect(issues.length).toBeGreaterThanOrEqual(0);
      }
    },
    120_000,
  );
});
