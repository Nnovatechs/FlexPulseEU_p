import { describe, expect, it } from "vitest";
import {
  createInitialSurveyDefinition,
} from "@/features/surveys/generator-types";
import type { GeneratedSurveyDraftProposal } from "@/features/surveys/survey-generation-flow";
import { scoreGeneratedSurvey } from "../../evals/surveys/generator/scoring";
import type { GeneratorEvalFixture } from "../../fixtures/surveys/generator/generator-eval-fixtures";

// Unit tests protect the deterministic scorer without calling OpenAI. The eval
// runner itself is model-dependent, but the scoring rules should remain stable
// and easy to debug in normal CI.
const fixture: GeneratorEvalFixture = {
  id: "unit-score-fixture",
  purpose: "Score a deterministic generated survey artifact.",
  surveyName: "Unit score survey",
  surveyDescription: "Test deterministic scoring.",
  defaultLanguage: "English",
  supportedLanguages: ["English"],
  behaviouralConceptKeys: ["trust_in_automation", "flexibility_willingness"],
  minQuestionsByConcept: {
    trust_in_automation: 2,
    flexibility_willingness: 2,
  },
  minTotalQuestions: 4,
  maxTotalQuestions: 8,
  minimumScore: 85,
  minimumMethodologyScore: 4,
};

// This proposal is a minimal "golden" generated artifact: two concepts, two
// questions each, complete mapping, valid response formats, and all questions
// required. It should score 100/100 deterministically.
function buildProposal(): GeneratedSurveyDraftProposal {
  const definition = createInitialSurveyDefinition("English", ["English"]);
  definition.questions = [
    {
      question_key: "Q_TRUST_01",
      type: "rating_scale",
      required: true,
      order: 1,
      scale: { min: 1, max: 5, min_label: "Do not trust", max_label: "Fully trust" },
    },
    {
      question_key: "Q_TRUST_02",
      type: "rating_scale",
      required: true,
      order: 2,
      scale: { min: 1, max: 5, min_label: "Uncomfortable", max_label: "Comfortable" },
    },
    {
      question_key: "Q_FLEX_01",
      type: "rating_scale",
      required: true,
      order: 3,
      scale: { min: 1, max: 5, min_label: "Unwilling", max_label: "Very willing" },
    },
    {
      question_key: "Q_FLEX_02",
      type: "rating_scale",
      required: true,
      order: 4,
      scale: { min: 1, max: 5, min_label: "Never", max_label: "Very often" },
    },
  ];
  definition.survey_meta.measurement_plan_json = {
    schema_version: 1,
    schema_namespace: "flexpulse_behavioural_schema",
    concepts: [
      {
        concept_key: "trust_in_automation",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_mean",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: ["Q_TRUST_01", "Q_TRUST_02"],
        required_question_keys: ["Q_TRUST_01", "Q_TRUST_02"],
      },
      {
        concept_key: "flexibility_willingness",
        evidence_source: "survey_questions",
        measurement_type: "multi_item_likert_mean",
        output_type: "number",
        aggregation_rule: "mean",
        threshold_profile: "likert_1_5_low_mid_high",
        minimum_answer_count: 2,
        question_keys: ["Q_FLEX_01", "Q_FLEX_02"],
        required_question_keys: ["Q_FLEX_01", "Q_FLEX_02"],
      },
    ],
  };

  return {
    definition,
    measurementPlan: definition.survey_meta.measurement_plan_json,
    mappingContract: {
      schema_version: 1,
      mappings: definition.questions.map((question) => ({
        question_key: question.question_key,
        ontology_target: question.question_key.startsWith("Q_TRUST")
          ? "flexpulse_behavioural_schema.trust_in_automation"
          : "flexpulse_behavioural_schema.flexibility_willingness",
        expected_type: "number",
        required_for_mapping: true,
        transform_strategy: {
          kind: "numeric_range",
          min: 1,
          max: 5,
        },
      })),
    },
    configs: [],
  };
}

describe("scoreGeneratedSurvey", () => {
  it("passes a structurally coherent generated survey", () => {
    const score = scoreGeneratedSurvey(fixture, buildProposal());

    expect(score).toMatchObject({
      status: "pass",
      conceptCoverageScore: 100,
      measurementDepthScore: 100,
      mappingReadinessScore: 100,
      responseFormatScore: 100,
      surveyBurdenScore: 100,
      overallScore: 100,
      issues: [],
    });
  });

  it("fails when a respondent-facing question is not mapped", () => {
    // This simulates the most important downstream failure mode: a visible
    // question exists, but the mapper would not know how to turn its answer into
    // the canonical profile output.
    const proposal = buildProposal();
    proposal.mappingContract.mappings = proposal.mappingContract.mappings.filter(
      (mapping) => mapping.question_key !== "Q_FLEX_02",
    );

    const score = scoreGeneratedSurvey(fixture, proposal);

    expect(score.status).toBe("fail");
    expect(score.mappingReadinessScore).toBeLessThan(100);
    expect(score.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_mapping",
          severity: "fail",
        }),
      ]),
    );
  });
});
