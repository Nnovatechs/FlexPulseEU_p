import type { GeneratedSurveyDraftProposal } from "@/features/surveys/survey-generation-flow";
import type { GeneratorEvalFixture } from "../../../fixtures/surveys/generator/generator-eval-fixtures";

// Deterministic scoring checks the hard product contract of a generated survey.
// It does not judge whether the wording is methodologically excellent; that is
// handled by methodology-rubric.ts. This file answers: "Did the generator
// produce a structurally usable instrument that can be mapped and profiled?"
type GeneratorEvalSeverity = "fail" | "warning";

export type GeneratorEvalIssue = {
  severity: GeneratorEvalSeverity;
  code: string;
  message: string;
};

export type GeneratorEvalScore = {
  conceptCoverageScore: number;
  measurementDepthScore: number;
  mappingReadinessScore: number;
  responseFormatScore: number;
  surveyBurdenScore: number;
  overallScore: number;
  status: "pass" | "warning" | "fail";
  issues: GeneratorEvalIssue[];
};

function addIssue(
  issues: GeneratorEvalIssue[],
  severity: GeneratorEvalSeverity,
  code: string,
  message: string,
) {
  issues.push({ severity, code, message });
}

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length;
}

function getQuestionKeysByConcept(proposal: GeneratedSurveyDraftProposal) {
  return new Map(
    proposal.measurementPlan.concepts.map((concept) => [
      concept.concept_key,
      concept.question_keys,
    ]),
  );
}

// Concept coverage asks whether every selected ontology concept survived the
// planner + writer + compiler flow and appears in the final measurement plan.
function scoreConceptCoverage(
  fixture: GeneratorEvalFixture,
  proposal: GeneratedSurveyDraftProposal,
  issues: GeneratorEvalIssue[],
) {
  const measuredConceptKeys = new Set(
    proposal.measurementPlan.concepts.map((concept) => concept.concept_key),
  );
  const expectedCount = fixture.behaviouralConceptKeys.length;
  const coveredCount = fixture.behaviouralConceptKeys.filter((conceptKey) =>
    measuredConceptKeys.has(conceptKey),
  ).length;

  for (const conceptKey of fixture.behaviouralConceptKeys) {
    if (!measuredConceptKeys.has(conceptKey)) {
      addIssue(
        issues,
        "fail",
        "missing_concept",
        `Missing concept "${conceptKey}" in measurement_plan_json.`,
      );
    }
  }

  return expectedCount === 0 ? 100 : Math.round((coveredCount / expectedCount) * 100);
}

// Measurement depth is fixture-driven. Some concepts can be single-item facts,
// but central behavioural constructs should not silently collapse into weak
// one-item proxies when the scenario expects more evidence.
function scoreMeasurementDepth(
  fixture: GeneratorEvalFixture,
  proposal: GeneratedSurveyDraftProposal,
  issues: GeneratorEvalIssue[],
) {
  const questionKeysByConcept = getQuestionKeysByConcept(proposal);
  const checks: boolean[] = [];

  for (const [conceptKey, minimum] of Object.entries(fixture.minQuestionsByConcept)) {
    const actual = questionKeysByConcept.get(conceptKey)?.length ?? 0;
    const passed = actual >= minimum;
    checks.push(passed);

    if (!passed) {
      addIssue(
        issues,
        "fail",
        "insufficient_measurement_depth",
        `Concept "${conceptKey}" has ${actual} questions but expected at least ${minimum}.`,
      );
    }
  }

  for (const conceptKey of fixture.zeroQuestionConcepts ?? []) {
    const actual = questionKeysByConcept.get(conceptKey)?.length ?? 0;
    const passed = actual === 0;
    checks.push(passed);

    if (!passed) {
      addIssue(
        issues,
        "fail",
        "unexpected_context_questions",
        `Concept "${conceptKey}" should not create respondent-facing questions.`,
      );
    }
  }

  if (checks.length === 0) {
    return 100;
  }

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// Mapping readiness checks that each respondent-facing question can travel
// through the downstream mapper: question -> mapping contract -> measurement
// plan -> required question invariant.
function scoreMappingReadiness(
  proposal: GeneratedSurveyDraftProposal,
  issues: GeneratorEvalIssue[],
) {
  const questionKeys = proposal.definition.questions.map((question) => question.question_key);
  const mappingKeys = proposal.mappingContract.mappings.map((mapping) => mapping.question_key);
  const plannedQuestionKeys = proposal.measurementPlan.concepts.flatMap(
    (concept) => concept.question_keys,
  );
  const mappingKeySet = new Set(mappingKeys);
  const plannedQuestionKeySet = new Set(plannedQuestionKeys);
  const checks: boolean[] = [];

  checks.push(!hasDuplicates(questionKeys));
  if (hasDuplicates(questionKeys)) {
    addIssue(issues, "fail", "duplicate_question_keys", "Generated question keys must be unique.");
  }

  for (const questionKey of questionKeys) {
    const hasMapping = mappingKeySet.has(questionKey);
    const isPlanned = plannedQuestionKeySet.has(questionKey);
    checks.push(hasMapping, isPlanned);

    if (!hasMapping) {
      addIssue(
        issues,
        "fail",
        "missing_mapping",
        `Question "${questionKey}" is missing from mapping_contract_json.`,
      );
    }

    if (!isPlanned) {
      addIssue(
        issues,
        "fail",
        "question_not_in_measurement_plan",
        `Question "${questionKey}" is missing from measurement_plan_json.`,
      );
    }
  }

  for (const concept of proposal.measurementPlan.concepts) {
    const requiredMatches =
      concept.required_question_keys.length === concept.question_keys.length &&
      concept.required_question_keys.every((questionKey) =>
        concept.question_keys.includes(questionKey),
      );
    checks.push(requiredMatches);

    if (!requiredMatches) {
      addIssue(
        issues,
        "fail",
        "required_questions_mismatch",
        `Concept "${concept.concept_key}" must require every materialized question.`,
      );
    }
  }

  for (const question of proposal.definition.questions) {
    checks.push(question.required);
    if (!question.required) {
      addIssue(
        issues,
        "fail",
        "optional_profile_question",
        `Question "${question.question_key}" should be required for profiling consistency.`,
      );
    }
  }

  if (checks.length === 0) {
    return 0;
  }

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// Response format quality catches incomplete structures that would make answers
// hard to collect or analyze: rating scales without anchors, choices without
// enough options, or numeric questions without a numeric configuration.
function questionHasValidResponseFormat(
  question: GeneratedSurveyDraftProposal["definition"]["questions"][number],
) {
  if (question.type === "rating_scale") {
    return (
      typeof question.scale?.min === "number" &&
      typeof question.scale.max === "number" &&
      question.scale.min < question.scale.max &&
      Boolean(question.scale.min_label?.trim()) &&
      Boolean(question.scale.max_label?.trim())
    );
  }

  if (question.type === "single_choice" || question.type === "multiple_choice") {
    return (question.options?.length ?? 0) >= 2;
  }

  if (question.type === "numeric") {
    return question.numeric != null;
  }

  return question.type === "boolean" || question.type === "free_text";
}

function scoreResponseFormats(
  proposal: GeneratedSurveyDraftProposal,
  issues: GeneratorEvalIssue[],
) {
  if (proposal.definition.questions.length === 0) {
    addIssue(issues, "fail", "no_questions", "Generated survey has no questions.");
    return 0;
  }

  const validQuestions = proposal.definition.questions.filter(questionHasValidResponseFormat);

  for (const question of proposal.definition.questions) {
    if (!questionHasValidResponseFormat(question)) {
      addIssue(
        issues,
        "fail",
        "invalid_response_format",
        `Question "${question.question_key}" has an invalid or incomplete response format.`,
      );
    }
  }

  return Math.round((validQuestions.length / proposal.definition.questions.length) * 100);
}

// Survey burden is intentionally simple: each fixture declares an acceptable
// question-count range. This protects against both under-measurement and
// bloated surveys without pretending to estimate real completion time precisely.
function scoreSurveyBurden(
  fixture: GeneratorEvalFixture,
  proposal: GeneratedSurveyDraftProposal,
  issues: GeneratorEvalIssue[],
) {
  const questionCount = proposal.definition.questions.length;

  if (
    questionCount >= fixture.minTotalQuestions &&
    questionCount <= fixture.maxTotalQuestions
  ) {
    return 100;
  }

  addIssue(
    issues,
    "warning",
    "survey_burden_outside_expected_range",
    `Generated ${questionCount} questions; expected ${fixture.minTotalQuestions}-${fixture.maxTotalQuestions}.`,
  );

  if (questionCount === 0) {
    return 0;
  }

  if (questionCount < fixture.minTotalQuestions) {
    return Math.round((questionCount / fixture.minTotalQuestions) * 100);
  }

  return Math.max(
    0,
    Math.round((fixture.maxTotalQuestions / questionCount) * 100),
  );
}

// In baseline mode, fail/warning is recorded into the report. In strict mode,
// the runner uses this status to fail the eval suite.
function deriveStatus(input: {
  score: number;
  minimumScore: number;
  issues: GeneratorEvalIssue[];
}) {
  if (input.issues.some((issue) => issue.severity === "fail")) {
    return "fail" as const;
  }

  if (input.score < input.minimumScore) {
    return "fail" as const;
  }

  if (input.issues.some((issue) => issue.severity === "warning")) {
    return "warning" as const;
  }

  return "pass" as const;
}

// Weighted v0 score. Mapping readiness and concept coverage are weighted most
// because a survey that cannot be mapped or misses selected concepts is not
// useful for the profiling pipeline, even if the visible questions look nice.
export function scoreGeneratedSurvey(
  fixture: GeneratorEvalFixture,
  proposal: GeneratedSurveyDraftProposal,
): GeneratorEvalScore {
  const issues: GeneratorEvalIssue[] = [];
  const conceptCoverageScore = scoreConceptCoverage(fixture, proposal, issues);
  const measurementDepthScore = scoreMeasurementDepth(fixture, proposal, issues);
  const mappingReadinessScore = scoreMappingReadiness(proposal, issues);
  const responseFormatScore = scoreResponseFormats(proposal, issues);
  const surveyBurdenScore = scoreSurveyBurden(fixture, proposal, issues);
  const overallScore = Math.round(
    conceptCoverageScore * 0.25 +
      measurementDepthScore * 0.2 +
      mappingReadinessScore * 0.3 +
      responseFormatScore * 0.15 +
      surveyBurdenScore * 0.1,
  );

  return {
    conceptCoverageScore,
    measurementDepthScore,
    mappingReadinessScore,
    responseFormatScore,
    surveyBurdenScore,
    overallScore,
    status: deriveStatus({
      score: overallScore,
      minimumScore: fixture.minimumScore,
      issues,
    }),
    issues,
  };
}
