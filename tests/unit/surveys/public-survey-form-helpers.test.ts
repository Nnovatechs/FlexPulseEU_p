import { describe, expect, it } from "vitest";
import type { SurveyQuestionDefinition } from "@/features/surveys/generator-types";
import {
  getFirstVisibleTrustAutomationQuestionKey,
  getResponseGuidanceNotice,
  getTrustAutomationNotice,
} from "@/components/surveys/public-survey-form-helpers";

function buildQuestion(question_key: string): SurveyQuestionDefinition {
  return {
    question_key,
    type: "rating_scale",
    required: true,
    order: 1,
    scale: { min: 1, max: 5 },
  };
}

describe("public survey form helpers", () => {
  it("returns the first visible trust automation question in visible order", () => {
    const visibleQuestions = [
      buildQuestion("Q_OTHER_01"),
      buildQuestion("Q_TRUST_IN_AUTOMATION_02"),
      buildQuestion("Q_TRUST_IN_AUTOMATION_01"),
    ];

    expect(
      getFirstVisibleTrustAutomationQuestionKey(visibleQuestions, [
        "Q_TRUST_IN_AUTOMATION_01",
        "Q_TRUST_IN_AUTOMATION_02",
      ]),
    ).toBe("Q_TRUST_IN_AUTOMATION_02");
  });

  it("returns null when no visible trust automation question exists", () => {
    expect(
      getFirstVisibleTrustAutomationQuestionKey(
        [buildQuestion("Q_OTHER_01"), buildQuestion("Q_OTHER_02")],
        ["Q_TRUST_IN_AUTOMATION_01"],
      ),
    ).toBeNull();
  });

  it("provides localized respondent guidance and trust notices", () => {
    expect(getResponseGuidanceNotice("Spanish")).toContain("útiles");
    expect(getResponseGuidanceNotice("French")).toContain("réponses");
    expect(getTrustAutomationNotice("English")).toContain("for example by changing");
    expect(getTrustAutomationNotice("Spanish")).toContain("flexibilidad energética");
    expect(getTrustAutomationNotice("French")).toContain("flexibilité énergétique");
  });
});
