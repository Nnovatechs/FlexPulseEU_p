import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  redirect,
  getPublicSurveyFeedbackPageData,
  createPublicSurveyResponseFeedback,
  getPublicSurveyFeedbackCompletionUrl,
} = vi.hoisted(() => ({
  redirect: vi.fn(),
  getPublicSurveyFeedbackPageData: vi.fn(),
  createPublicSurveyResponseFeedback: vi.fn(),
  getPublicSurveyFeedbackCompletionUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/features/surveys/feedback-repository", () => ({
  getPublicSurveyFeedbackPageData,
  createPublicSurveyResponseFeedback,
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

    expect(createPublicSurveyResponseFeedback).toHaveBeenCalledWith({
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

  it("rejects overlong free-text feedback before writing", async () => {
    const { submitPublicSurveyFeedbackAction } = await import(
      "@/features/surveys/feedback-actions"
    );
    const formData = new FormData();
    formData.set("linkToken", "public-token");
    formData.set("responseId", "response-1");
    formData.set("easeRating", "4");
    formData.set("unclearQuestionsText", "x".repeat(2001));
    formData.set("energyFlexibilityProgrammeText", "A programme for shifting demand.");
    formData.set("automatedControlText", "A home automation system.");
    formData.set("leadingQuestionsText", "None");
    formData.set("overlapOrTechnicalText", "None");

    await expect(submitPublicSurveyFeedbackAction(formData)).rejects.toThrow(
      "Unclear questions feedback must be at most 2000 characters.",
    );
    expect(createPublicSurveyResponseFeedback).not.toHaveBeenCalled();
  });
});
