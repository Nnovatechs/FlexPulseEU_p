import { describe, expect, it } from "vitest";
import { isPublicApiRoute, isPublicSurveyRoute } from "../../middleware";

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

  it("bypasses session middleware for Interoperability API routes", () => {
    expect(isPublicApiRoute("/api/v1")).toBe(true);
    expect(isPublicApiRoute("/api/v1/openapi")).toBe(true);
    expect(isPublicApiRoute("/api/v1/surveys")).toBe(true);
    expect(isPublicApiRoute("/api/v1/surveys/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/responses")).toBe(
      true,
    );
    expect(isPublicApiRoute("/account/api")).toBe(false);
  });
});
