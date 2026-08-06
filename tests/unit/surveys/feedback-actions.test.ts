import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  redirect,
  getPublicSurveyFeedbackPageData,
  upsertPublicSurveyResponseFeedback,
  getPublicSurveyFeedbackCompletionUrl,
} = vi.hoisted(() => ({
  redirect: vi.fn(),
  getPublicSurveyFeedbackPageData: vi.fn(),
  upsertPublicSurveyResponseFeedback: vi.fn(),
  getPublicSurveyFeedbackCompletionUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/features/surveys/feedback-repository", () => ({
  getPublicSurveyFeedbackPageData,
  upsertPublicSurveyResponseFeedback,
  getPublicSurveyFeedbackCompletionUrl,
}));

describe("survey feedback actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicSurveyFeedbackPageData.mockResolvedValue({
      response: { submitted_language: "English" },
    });
    getPublicSurveyFeedbackCompletionUrl.mockResolvedValue(null);
  });

  it("stores feedback and redirects to thank-you when no external completion URL exists", async () => {
    const { submitPublicSurveyFeedbackAction } = await import(
      "@/features/surveys/feedback-actions"
    );
    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("responseId", "response-1");
    formData.set("easeRating", "4");
    formData.set("unclearQuestionsText", "None");
    formData.set("energyFlexibilityProgrammeText", "A programme for shifting demand.");
    formData.set("automatedControlText", "A home automation system.");
    formData.set("leadingQuestionsText", "None");
    formData.set("overlapOrTechnicalText", "None");

    await submitPublicSurveyFeedbackAction(formData);

    expect(upsertPublicSurveyResponseFeedback).toHaveBeenCalledWith({
      responseId: "response-1",
      easeRating: 4,
      unclearQuestionsText: "None",
      energyFlexibilityProgrammeText: "A programme for shifting demand.",
      automatedControlText: "A home automation system.",
      leadingQuestionsText: "None",
      overlapOrTechnicalText: "None",
    });
    expect(redirect).toHaveBeenCalledWith("/s/public-token/thank-you?lang=English");
  });

  it("redirects to external completion when linked recruitment is present", async () => {
    getPublicSurveyFeedbackCompletionUrl.mockResolvedValue(
      "https://app.prolific.com/submissions/complete?cc=ABC123",
    );

    const { submitPublicSurveyFeedbackAction } = await import(
      "@/features/surveys/feedback-actions"
    );
    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("responseId", "response-1");
    formData.set("easeRating", "5");
    formData.set("unclearQuestionsText", "None");
    formData.set("energyFlexibilityProgrammeText", "It means flexible household energy use.");
    formData.set("automatedControlText", "The system or supplier.");
    formData.set("leadingQuestionsText", "None");
    formData.set("overlapOrTechnicalText", "None");

    await submitPublicSurveyFeedbackAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      "https://app.prolific.com/submissions/complete?cc=ABC123",
    );
  });
});
