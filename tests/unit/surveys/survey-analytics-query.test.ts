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

  it("accepts filters, group_by, and typed metrics", () => {
    expect(
      parseSurveyAnalyticsQueryInput({
        filters: [{ field: "country", op: "equals", value: "ES" }],
        group_by: ["audience_token"],
        metrics: [
          { key: "responses", kind: "count" },
          { key: "avg_age", kind: "average", field: "age" },
          { key: "share_es", kind: "share_equals", field: "country", value: "ES" },
          { key: "share_tag", kind: "share_contains", field: "tags", value: "beta" },
        ],
      }),
    ).toEqual({
      filters: [{ field: "country", op: "equals", value: "ES" }],
      group_by: ["audience_token"],
      metrics: [
        { key: "responses", kind: "count" },
        { key: "avg_age", kind: "average", field: "age" },
        { key: "share_es", kind: "share_equals", field: "country", value: "ES" },
        { key: "share_tag", kind: "share_contains", field: "tags", value: "beta" },
      ],
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

  it("rejects non-array filters", () => {
    expect(() =>
      parseSurveyAnalyticsQueryInput({
        filters: { field: "country", op: "equals", value: "ES" },
        metrics: [{ key: "responses", kind: "count" }],
      }),
    ).toThrow("Analytics query filters must be an array when provided.");
  });

  it("rejects non-array group_by", () => {
    expect(() =>
      parseSurveyAnalyticsQueryInput({
        group_by: "audience_token",
        metrics: [{ key: "responses", kind: "count" }],
      }),
    ).toThrow("Analytics query group_by must be an array when provided.");
  });

  it("rejects malformed filter entries", () => {
    expect(() =>
      parseSurveyAnalyticsQueryInput({
        filters: [{ op: "equals", value: "ES" }],
        metrics: [{ key: "responses", kind: "count" }],
      }),
    ).toThrow("Analytics query filter field must be a non-empty string.");
  });

  it("rejects malformed group_by entries", () => {
    expect(() =>
      parseSurveyAnalyticsQueryInput({
        group_by: [""],
        metrics: [{ key: "responses", kind: "count" }],
      }),
    ).toThrow("Analytics query group_by entries must be non-empty strings.");
  });

  it("rejects unsupported metric kinds", () => {
    expect(() =>
      parseSurveyAnalyticsQueryInput({
        metrics: [{ key: "bad", kind: "median" }],
      }),
    ).toThrow('Analytics metric kind "median" is not supported.');
  });

  it("rejects average metrics without a field", () => {
    expect(() =>
      parseSurveyAnalyticsQueryInput({
        metrics: [{ key: "avg_age", kind: "average" }],
      }),
    ).toThrow('Analytics metric "average" requires a field.');
  });

  it("rejects share metrics without required fields", () => {
    expect(() =>
      parseSurveyAnalyticsQueryInput({
        metrics: [{ key: "share_es", kind: "share_equals", field: "country" }],
      }),
    ).toThrow('Analytics metric "share_equals" requires a scalar value.');
  });
});
