import { describe, expect, it } from "vitest";
import { deriveSchemaTargetsFromBehaviouralConceptKeys } from "@/features/ontology/flexpulse-behavioural-schema";
import { getGeneratorTargetConfigs } from "@/features/surveys/generator-config";
import { generateMeasurementPlanWithLLM } from "@/features/surveys/generator-service";
import {
  applyMeasurementPlannerOutput,
  createMeasurementPlanBlueprint,
} from "@/features/surveys/measurement-plan";
import {
  validateMeasurementPlannerConceptCoverage,
  validateMeasurementPlanBlueprint,
} from "@/features/surveys/generator-validation";
import {
  plannerEvalFixtures,
  type PlannerEvalFixture,
} from "../../../fixtures/surveys/planner/planner-eval-fixtures";

const describeWithOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;

function assertFixtureExpectations(
  fixture: PlannerEvalFixture,
  plannedBlueprint: ReturnType<typeof applyMeasurementPlannerOutput>,
) {
  for (const [conceptKey, minimum] of Object.entries(
    fixture.minQuestionSlotsByConcept ?? {},
  )) {
    const concept = plannedBlueprint.concepts.find(
      (entry) => entry.concept_key === conceptKey,
    );
    expect(concept, `Missing concept ${conceptKey}`).toBeDefined();
    expect(
      concept?.question_slots.length,
      `Concept ${conceptKey} should keep at least ${minimum} planned slots`,
    ).toBeGreaterThanOrEqual(minimum);
  }

  for (const conceptKey of fixture.zeroSlotConcepts ?? []) {
    const concept = plannedBlueprint.concepts.find(
      (entry) => entry.concept_key === conceptKey,
    );
    expect(concept, `Missing concept ${conceptKey}`).toBeDefined();
    expect(
      concept?.question_slots,
      `Concept ${conceptKey} should stay outside respondent-facing question planning`,
    ).toEqual([]);
  }
}

describeWithOpenAI("survey planner product evals", () => {
  it("runs only when an OpenAI key is available", () => {
    expect(Boolean(process.env.OPENAI_API_KEY)).toBe(true);
  });

  it.each(plannerEvalFixtures)(
    "$id",
    async (fixture) => {
      const schemaTargets = deriveSchemaTargetsFromBehaviouralConceptKeys(
        fixture.behaviouralConceptKeys,
      );
      const configs = getGeneratorTargetConfigs(schemaTargets);
      const baseMeasurementPlanBlueprint = createMeasurementPlanBlueprint(
        fixture.behaviouralConceptKeys,
      );

      const plannerOutput = await generateMeasurementPlanWithLLM({
        surveyName: fixture.surveyName,
        surveyDescription: fixture.surveyDescription,
        defaultLanguage: fixture.defaultLanguage,
        supportedLanguages: fixture.supportedLanguages,
        behaviouralConceptKeys: fixture.behaviouralConceptKeys,
        schemaTargets,
        configs,
        baseMeasurementPlanBlueprint,
      });

      const coverageIssues = validateMeasurementPlannerConceptCoverage(
        fixture.behaviouralConceptKeys,
        plannerOutput.concepts.map((concept) => concept.concept_key),
      );
      expect(
        {
          purpose: fixture.purpose,
          coverageIssues,
        },
        fixture.purpose,
      ).toMatchObject({
        coverageIssues: [],
      });

      const plannedBlueprint = applyMeasurementPlannerOutput(
        baseMeasurementPlanBlueprint,
        plannerOutput,
      );
      const blueprintIssues = validateMeasurementPlanBlueprint(plannedBlueprint);

      expect(
        {
          purpose: fixture.purpose,
          blueprintIssues,
        },
        fixture.purpose,
      ).toMatchObject({
        blueprintIssues: [],
      });

      assertFixtureExpectations(fixture, plannedBlueprint);
    },
    120_000,
  );
});
