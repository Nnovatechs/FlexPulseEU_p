import { describe, expect, it } from "vitest";
import type { SurveyQuestionDefinition } from "@/features/surveys/generator-types";
import {
  getVisibleQuestions,
  isQuestionVisible,
  orderSurveyQuestions,
  pruneHiddenQuestionAnswers,
  resolveQuestionApplicability,
  toggleExclusiveMultipleChoiceOption,
  validateQuestionVisibilityRules,
} from "@/features/surveys/question-visibility";

function buildQuestions(): SurveyQuestionDefinition[] {
  return [
    {
      question_key: "Q_EV",
      type: "rating_scale",
      required: true,
      order: 2,
      scale: { min: 1, max: 5 },
      visibility_rule: {
        source_question_key: "Q_ASSETS",
        operator: "contains_any",
        values: ["ev"],
      },
    },
    {
      question_key: "Q_ASSETS",
      type: "multiple_choice",
      required: true,
      order: 1,
      exclusive_option_keys: ["none", "unknown"],
      options: [
        { option_key: "ev", value: "ev" },
        { option_key: "battery", value: "battery" },
        { option_key: "none", value: "none" },
        { option_key: "unknown", value: "unknown" },
      ],
    },
    {
      question_key: "Q_BATTERY",
      type: "rating_scale",
      required: false,
      order: 3,
      scale: { min: 1, max: 5 },
      visibility_rule: {
        source_question_key: "Q_ASSETS",
        operator: "contains_any",
        values: ["battery"],
      },
    },
    {
      question_key: "Q_LEGACY",
      type: "boolean",
      required: true,
      order: 4,
    },
  ];
}

describe("question visibility", () => {
  it("orders stably and keeps legacy questions visible without answers", () => {
    const questions = buildQuestions();
    expect(orderSurveyQuestions(questions).map((question) => question.question_key))
      .toEqual(["Q_ASSETS", "Q_EV", "Q_BATTERY", "Q_LEGACY"]);
    expect(isQuestionVisible(questions[3], {})).toBe(true);
  });

  it("resolves contains_any from raw option keys", () => {
    const visible = getVisibleQuestions(buildQuestions(), {
      Q_ASSETS: ["battery", "ev"],
    });
    expect(visible.map((question) => question.question_key)).toEqual([
      "Q_ASSETS",
      "Q_EV",
      "Q_BATTERY",
      "Q_LEGACY",
    ]);

    const noAssets = resolveQuestionApplicability(buildQuestions(), {
      Q_ASSETS: ["none"],
    });
    expect([...noAssets.questionKeys]).toEqual(["Q_ASSETS", "Q_LEGACY"]);
    expect([...noAssets.requiredQuestionKeys]).toEqual(["Q_ASSETS", "Q_LEGACY"]);
  });

  it("prunes newly hidden known answers and preserves unrelated state", () => {
    expect(
      pruneHiddenQuestionAnswers(buildQuestions(), {
        Q_ASSETS: ["battery"],
        Q_EV: 5,
        Q_BATTERY: 4,
        context: "keep",
      }),
    ).toEqual({
      Q_ASSETS: ["battery"],
      Q_BATTERY: 4,
      context: "keep",
    });
  });

  it("enforces mutually exclusive sentinels during toggles", () => {
    const exclusive = ["none", "unknown"];
    expect(
      toggleExclusiveMultipleChoiceOption(["ev", "battery"], "none", exclusive),
    ).toEqual(["none"]);
    expect(
      toggleExclusiveMultipleChoiceOption(["none"], "ev", exclusive),
    ).toEqual(["ev"]);
    expect(
      toggleExclusiveMultipleChoiceOption(["unknown"], "none", exclusive),
    ).toEqual(["none"]);
    expect(
      toggleExclusiveMultipleChoiceOption(["ev"], "ev", exclusive),
    ).toEqual([]);
  });

  it("accepts a structurally valid rule", () => {
    expect(validateQuestionVisibilityRules(buildQuestions())).toEqual([]);
  });

  it.each([
    [
      "unknown_visibility_source",
      (questions: SurveyQuestionDefinition[]) => {
        questions[0].visibility_rule!.source_question_key = "Q_MISSING";
      },
    ],
    [
      "visibility_source_not_prior",
      (questions: SurveyQuestionDefinition[]) => {
        questions[1].order = 2;
      },
    ],
    [
      "invalid_visibility_source_type",
      (questions: SurveyQuestionDefinition[]) => {
        questions[1].type = "single_choice";
      },
    ],
    [
      "empty_visibility_values",
      (questions: SurveyQuestionDefinition[]) => {
        questions[0].visibility_rule!.values = [];
      },
    ],
    [
      "invalid_visibility_trigger_value",
      (questions: SurveyQuestionDefinition[]) => {
        questions[0].visibility_rule!.values = ["mapped_ev_value"];
      },
    ],
  ])("reports %s", (expectedCode, mutate) => {
    const questions = buildQuestions();
    mutate(questions);
    expect(validateQuestionVisibilityRules(questions)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: expectedCode })]),
    );
  });
});
