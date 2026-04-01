import { describe, expect, it } from "vitest";
import { runContentValidation } from "@/features/surveys/content-validator";
import { buildValidationSurveyFixture } from "../../../fixtures/surveys/validation/factory";
import {
  validationEvalFixtures,
  type ValidationEvalFixture,
} from "../../../fixtures/surveys/validation/llm-eval-fixtures";

// Eval suites are intentionally separated from unit/integration tests because
// they depend on a real LLM and measure product behaviour, not just code wiring.
const describeWithOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;

function buildFixtureCase(fixture: ValidationEvalFixture) {
  return buildValidationSurveyFixture({
    language: fixture.language,
    title: fixture.title,
    description: fixture.description,
    optionLabels: fixture.optionLabels,
    ontologyTarget: fixture.ontologyTarget,
  });
}

describeWithOpenAI("survey validation product evals", () => {
  it("runs only when an OpenAI key is available", () => {
    // This tiny guard makes the suite behaviour explicit when someone opens the
    // file later and wonders why it may be skipped locally.
    expect(Boolean(process.env.OPENAI_API_KEY)).toBe(true);
  });

  it.each(validationEvalFixtures)(
    "$id",
    async (fixture) => {
      // Each eval fixture encodes one product expectation.
      // The purpose field explains which behavioural guarantee the validation
      // pipeline should preserve across future prompt/model changes.
      const surveyFixture = buildFixtureCase(fixture);

      const result = await runContentValidation(
        surveyFixture.questions,
        surveyFixture.mappings,
        surveyFixture.translations,
        surveyFixture.language,
      );

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
    },
    120_000,
  );
});
