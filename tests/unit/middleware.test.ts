import { describe, expect, it } from "vitest";
import { isPublicSurveyRoute } from "../../middleware";

describe("middleware public survey route matching", () => {
  it("treats feedback pages as public survey routes", () => {
    expect(isPublicSurveyRoute("/s/public-token")).toBe(true);
    expect(isPublicSurveyRoute("/s/public-token/privacy")).toBe(true);
    expect(isPublicSurveyRoute("/s/public-token/thank-you")).toBe(true);
    expect(isPublicSurveyRoute("/s/public-token/feedback")).toBe(true);
  });

  it("does not overmatch unrelated survey paths", () => {
    expect(isPublicSurveyRoute("/s/public-token/feedback/extra")).toBe(false);
    expect(isPublicSurveyRoute("/surveys/123")).toBe(false);
  });
});
