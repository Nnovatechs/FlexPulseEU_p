import { describe, expect, it } from "vitest";
import {
  isRecommendedSurveyLanguage,
  recommendedSurveyLanguages,
  supportedSurveyLanguages,
} from "@/features/surveys/languages";

describe("recommended survey languages", () => {
  it("keeps the supported language tuple unchanged", () => {
    expect(supportedSurveyLanguages).toEqual([
      "English",
      "French",
      "Spanish",
      "Croatian",
    ]);
  });

  it("marks English, Spanish and French as recommended", () => {
    expect(recommendedSurveyLanguages).toEqual(["English", "Spanish", "French"]);
    expect(isRecommendedSurveyLanguage("English")).toBe(true);
    expect(isRecommendedSurveyLanguage("Spanish")).toBe(true);
    expect(isRecommendedSurveyLanguage("French")).toBe(true);
    expect(isRecommendedSurveyLanguage("Croatian")).toBe(false);
  });
});
