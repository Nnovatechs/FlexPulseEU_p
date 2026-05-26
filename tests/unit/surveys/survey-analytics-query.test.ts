import { describe, expect, it } from "vitest";
import { parseSurveyAnalyticsQueryInput } from "@/features/surveys/survey-analytics";

describe("parseSurveyAnalyticsQueryInput", () => {
  it("accepts a valid analytics query", () => {
    expect(
      parseSurveyAnalyticsQueryInput({
        metrics: [{ key: "responses", kind: "count" }],
      }),
    ).toEqual({
      metrics: [{ key: "responses", kind: "count" }],
    });
  });

  it("rejects non-object bodies", () => {
    expect(() => parseSurveyAnalyticsQueryInput(null)).toThrow(
      "Analytics query requires a JSON object.",
    );
  });

  it("rejects queries without metrics", () => {
    expect(() => parseSurveyAnalyticsQueryInput({})).toThrow(
      "Analytics query requires at least one metric.",
    );
  });
});
