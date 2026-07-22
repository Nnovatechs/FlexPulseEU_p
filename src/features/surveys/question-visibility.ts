import type {
  SurveyQuestionDefinition,
} from "./generator-types";

export type QuestionVisibilityAnswers = Record<string, unknown>;

export type QuestionVisibilityValidationIssue = {
  code:
    | "unknown_visibility_source"
    | "visibility_source_not_prior"
    | "invalid_visibility_source_type"
    | "empty_visibility_values"
    | "invalid_visibility_trigger_value";
  question_key: string;
  source_question_key: string;
  value?: string;
};

export type ResolvedQuestionApplicability = {
  questions: SurveyQuestionDefinition[];
  questionKeys: Set<string>;
  requiredQuestionKeys: Set<string>;
};

/**
 * Returns questions in deterministic display order without mutating the definition.
 * Equal order values retain their original definition order.
 */
export function orderSurveyQuestions(
  questions: SurveyQuestionDefinition[],
): SurveyQuestionDefinition[] {
  return questions
    .map((question, index) => ({ question, index }))
    .sort(
      (left, right) =>
        left.question.order - right.question.order || left.index - right.index,
    )
    .map(({ question }) => question);
}

function answerContainsAny(answer: unknown, triggerValues: string[]): boolean {
  const selectedValues = Array.isArray(answer) ? answer : [answer];
  return selectedValues.some(
    (value) => typeof value === "string" && triggerValues.includes(value),
  );
}

/**
 * Resolves whether one question applies to the current raw answers.
 * Questions without a visibility rule are always visible for legacy compatibility.
 */
export function isQuestionVisible(
  question: SurveyQuestionDefinition,
  answers: QuestionVisibilityAnswers,
): boolean {
  const rule = question.visibility_rule;
  if (!rule) {
    return true;
  }

  switch (rule.operator) {
    case "contains_any":
      return answerContainsAny(answers[rule.source_question_key], rule.values);
  }
}

/**
 * Returns all currently applicable questions in deterministic display order.
 */
export function getVisibleQuestions(
  questions: SurveyQuestionDefinition[],
  answers: QuestionVisibilityAnswers,
): SurveyQuestionDefinition[] {
  return orderSurveyQuestions(questions).filter((question) =>
    isQuestionVisible(question, answers),
  );
}

/**
 * Resolves the shared visible and required question sets used by validation and mapping.
 */
export function resolveQuestionApplicability(
  questions: SurveyQuestionDefinition[],
  answers: QuestionVisibilityAnswers,
): ResolvedQuestionApplicability {
  const visibleQuestions = getVisibleQuestions(questions, answers);

  return {
    questions: visibleQuestions,
    questionKeys: new Set(
      visibleQuestions.map((question) => question.question_key),
    ),
    requiredQuestionKeys: new Set(
      visibleQuestions
        .filter((question) => question.required)
        .map((question) => question.question_key),
    ),
  };
}

/**
 * Removes answers for known questions that are not currently visible.
 * Unknown keys are preserved so callers can use this with wider state objects.
 */
export function pruneHiddenQuestionAnswers<T extends QuestionVisibilityAnswers>(
  questions: SurveyQuestionDefinition[],
  answers: T,
): T {
  const knownQuestionKeys = new Set(
    questions.map((question) => question.question_key),
  );
  const visibleQuestionKeys = resolveQuestionApplicability(
    questions,
    answers,
  ).questionKeys;

  return Object.fromEntries(
    Object.entries(answers).filter(
      ([key]) => !knownQuestionKeys.has(key) || visibleQuestionKeys.has(key),
    ),
  ) as T;
}

/**
 * Applies one multiple-choice toggle while enforcing configured sentinel exclusivity.
 */
export function toggleExclusiveMultipleChoiceOption(
  selectedValues: string[],
  optionKey: string,
  exclusiveOptionKeys: string[] = [],
): string[] {
  if (selectedValues.includes(optionKey)) {
    return selectedValues.filter((value) => value !== optionKey);
  }

  const exclusiveKeys = new Set(exclusiveOptionKeys);
  if (exclusiveKeys.has(optionKey)) {
    return [optionKey];
  }

  return [
    ...selectedValues.filter((value) => !exclusiveKeys.has(value)),
    optionKey,
  ];
}

/**
 * Validates visibility references against the frozen survey structure.
 * Sources must exist, precede dependants, be multiple choice, and expose every trigger.
 */
export function validateQuestionVisibilityRules(
  questions: SurveyQuestionDefinition[],
): QuestionVisibilityValidationIssue[] {
  const orderedQuestions = orderSurveyQuestions(questions);
  const questionIndex = new Map(
    orderedQuestions.map((question, index) => [
      question.question_key,
      { question, index },
    ]),
  );
  const issues: QuestionVisibilityValidationIssue[] = [];

  for (const [dependentIndex, question] of orderedQuestions.entries()) {
    const rule = question.visibility_rule;
    if (!rule) {
      continue;
    }

    const source = questionIndex.get(rule.source_question_key);
    if (!source) {
      issues.push({
        code: "unknown_visibility_source",
        question_key: question.question_key,
        source_question_key: rule.source_question_key,
      });
      continue;
    }

    if (
      source.index >= dependentIndex ||
      source.question.order >= question.order
    ) {
      issues.push({
        code: "visibility_source_not_prior",
        question_key: question.question_key,
        source_question_key: rule.source_question_key,
      });
    }

    if (source.question.type !== "multiple_choice") {
      issues.push({
        code: "invalid_visibility_source_type",
        question_key: question.question_key,
        source_question_key: rule.source_question_key,
      });
      continue;
    }

    if (rule.values.length === 0) {
      issues.push({
        code: "empty_visibility_values",
        question_key: question.question_key,
        source_question_key: rule.source_question_key,
      });
    }

    const sourceOptionKeys = new Set(
      source.question.options?.map((option) => option.option_key) ?? [],
    );
    for (const value of rule.values) {
      if (!sourceOptionKeys.has(value)) {
        issues.push({
          code: "invalid_visibility_trigger_value",
          question_key: question.question_key,
          source_question_key: rule.source_question_key,
          value,
        });
      }
    }
  }

  return issues;
}
