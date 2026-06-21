import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { generateSurveyDraftProposal } from "@/features/surveys/survey-generation-flow";
import {
  buildGeneratorEvalInput,
  generatorEvalFixtures,
} from "../../../fixtures/surveys/generator/generator-eval-fixtures";
import { evaluateGeneratedSurveyMethodology } from "./methodology-rubric";
import { scoreGeneratedSurvey } from "./scoring";

// Generator evals depend on a real model. They measure product behaviour, not
// just deterministic code wiring, so they are kept outside normal unit tests.
const describeWithOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;

// Optional fixture filter for fast iteration:
// GENERATOR_EVAL_FIXTURE_IDS=core-behavioural-axes npm run eval:generator
const selectedFixtureIds = new Set(
  (process.env.GENERATOR_EVAL_FIXTURE_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const activeFixtures =
  selectedFixtureIds.size > 0
    ? generatorEvalFixtures.filter((fixture) => selectedFixtureIds.has(fixture.id))
    : generatorEvalFixtures;
const strictMode = process.env.GENERATOR_EVAL_STRICT === "true";

// Baseline mode records pass/warning/fail/error in the JSON report without
// failing the suite. Strict mode turns those same findings into test failures.
// This lets us collect evidence first, then later decide what becomes a gate.
const reportRows: Array<{
  fixture_id: string;
  purpose: string;
  status: "pass" | "warning" | "fail" | "error";
  deterministic_score?: ReturnType<typeof scoreGeneratedSurvey>;
  methodology_score?: Awaited<ReturnType<typeof evaluateGeneratedSurveyMethodology>>;
  execution_error?: string;
  question_count?: number;
  concepts: string[];
  questions?: Array<{
    question_key: string;
    type: string;
    title: string;
    mapped_target: string | undefined;
  }>;
}> = [];

function summarizeQuestions(
  proposal: Awaited<ReturnType<typeof generateSurveyDraftProposal>>,
) {
  const defaultLanguage = proposal.definition.survey_meta.default_language;
  const translations = proposal.definition.translations[defaultLanguage];

  return proposal.definition.questions.map((question) => ({
    question_key: question.question_key,
    type: question.type,
    title: translations?.questions[question.question_key]?.title ?? "",
    mapped_target: proposal.mappingContract.mappings.find(
      (mapping) => mapping.question_key === question.question_key,
    )?.ontology_target,
  }));
}

describeWithOpenAI("survey generator product evals", () => {
  // The report is the main artifact of the eval run. It preserves the scores,
  // methodology judgement, generated questions, and any execution errors in a
  // single local file that can be inspected after the run.
  afterAll(async () => {
    if (reportRows.length === 0) {
      return;
    }

    const outputDir = path.join(
      process.cwd(),
      ".tmp",
      "evals",
      "survey-generator",
      "latest",
    );
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      path.join(outputDir, "report.json"),
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          strict_mode: strictMode,
          fixture_count: reportRows.length,
          rows: reportRows,
        },
        null,
        2,
      )}\n`,
    );
  });

  it("runs only when an OpenAI key is available", () => {
    expect(Boolean(process.env.OPENAI_API_KEY)).toBe(true);
    expect(activeFixtures.length).toBeGreaterThan(0);
  });

  it.each(activeFixtures)(
    "$id",
    async (fixture) => {
      let proposal: Awaited<ReturnType<typeof generateSurveyDraftProposal>>;

      try {
        // This executes the real product flow: planner -> writer -> compiler ->
        // validation. The eval does not mock the survey generator.
        proposal = await generateSurveyDraftProposal(buildGeneratorEvalInput(fixture));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown survey generation error.";

        reportRows.push({
          fixture_id: fixture.id,
          purpose: fixture.purpose,
          status: "error",
          execution_error: message,
          concepts: fixture.behaviouralConceptKeys,
        });

        console.info(
          [
            `\n[generator eval] ${fixture.id}`,
            "execution: error",
            message,
            "report: .tmp/evals/survey-generator/latest/report.json",
          ].join(" | "),
        );

        if (strictMode) {
          throw error;
        }

        expect(message.length).toBeGreaterThan(0);
        return;
      }

      const score = scoreGeneratedSurvey(fixture, proposal);
      // Deterministic score: structural and pipeline readiness.
      // Methodology score: qualitative survey quality for profiling.
      const methodologyScore = await evaluateGeneratedSurveyMethodology({
        fixture,
        proposal,
      });
      const questionSummary = summarizeQuestions(proposal);
      const status =
        score.status === "fail" || methodologyScore.verdict === "fail"
          ? "fail"
          : score.status === "warning" || methodologyScore.verdict === "warning"
            ? "warning"
            : "pass";

      reportRows.push({
        fixture_id: fixture.id,
        purpose: fixture.purpose,
        status,
        deterministic_score: score,
        methodology_score: methodologyScore,
        question_count: proposal.definition.questions.length,
        concepts: fixture.behaviouralConceptKeys,
        questions: questionSummary,
      });

      console.info(
        [
          `\n[generator eval] ${fixture.id}`,
          `deterministic: ${score.status} (${score.overallScore}/100)`,
          `methodology: ${methodologyScore.verdict} (${methodologyScore.overall}/5)`,
          `questions: ${proposal.definition.questions.length}`,
          `report: .tmp/evals/survey-generator/latest/report.json`,
        ].join(" | "),
      );

      if (strictMode) {
        // Strict mode is for future gating. Today we mostly use baseline mode
        // because we expect the evals to reveal weaknesses while the generator
        // is still being improved.
        expect(
          {
            purpose: fixture.purpose,
            score,
            methodologyScore,
            questionCount: proposal.definition.questions.length,
            measurementPlan: proposal.measurementPlan,
            questions: questionSummary,
          },
          fixture.purpose,
        ).toMatchObject({
          score: {
            status: expect.not.stringMatching(/^fail$/),
            conceptCoverageScore: 100,
            mappingReadinessScore: 100,
          },
          methodologyScore: {
            verdict: expect.not.stringMatching(/^fail$/),
          },
        });

        expect(score.overallScore, fixture.purpose).toBeGreaterThanOrEqual(
          fixture.minimumScore,
        );
        expect(methodologyScore.overall, fixture.purpose).toBeGreaterThanOrEqual(
          fixture.minimumMethodologyScore,
        );
      } else {
        // Baseline mode only asserts that the eval produced measurable output.
        // The actual quality signal lives in the JSON report.
        expect(score.overallScore).toBeGreaterThanOrEqual(0);
        expect(methodologyScore.overall).toBeGreaterThanOrEqual(1);
      }
    },
    180_000,
  );
});
