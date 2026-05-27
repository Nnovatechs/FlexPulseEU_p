import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentSession, getSurveyAnalyticsSchema, runSurveyAnalytics } = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getSurveyAnalyticsSchema: vi.fn(),
  runSurveyAnalytics: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: getCurrentSession,
}));

vi.mock("@/features/surveys/use-cases", () => ({
  getSurveyAnalyticsSchema,
  runSurveyAnalytics,
}));

describe("survey analytics route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    getCurrentSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/surveys/[surveyId]/analytics/route");
    const response = await GET(new Request("http://localhost/api/surveys/survey-1/analytics"), {
      params: Promise.resolve({ surveyId: "survey-1" }),
    });

    expect(response.status).toBe(401);
    expect(getSurveyAnalyticsSchema).not.toHaveBeenCalled();
  });

  it("returns the analytics schema for authenticated requests", async () => {
    getCurrentSession.mockResolvedValue({ user: { id: "user-1" } });
    getSurveyAnalyticsSchema.mockResolvedValue({
      survey_id: "survey-1",
      ready_response_count: 2,
      excluded_unmapped_count: 0,
      ready_pipeline_count: 2,
      fields: [],
    });

    const { GET } = await import("@/app/api/surveys/[surveyId]/analytics/route");
    const response = await GET(new Request("http://localhost/api/surveys/survey-1/analytics"), {
      params: Promise.resolve({ surveyId: "survey-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        survey_id: "survey-1",
        ready_response_count: 2,
      }),
    );
    expect(getSurveyAnalyticsSchema).toHaveBeenCalledWith("survey-1");
  });

  it("returns 400 for malformed analytics queries", async () => {
    getCurrentSession.mockResolvedValue({ user: { id: "user-1" } });

    const { POST } = await import("@/app/api/surveys/[surveyId]/analytics/route");
    const response = await POST(
      new Request("http://localhost/api/surveys/survey-1/analytics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      {
        params: Promise.resolve({ surveyId: "survey-1" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Analytics query requires at least one metric.",
    });
    expect(runSurveyAnalytics).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid filter shape", async () => {
    getCurrentSession.mockResolvedValue({ user: { id: "user-1" } });

    const { POST } = await import("@/app/api/surveys/[surveyId]/analytics/route");
    const response = await POST(
      new Request("http://localhost/api/surveys/survey-1/analytics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filters: "country",
          metrics: [{ key: "responses", kind: "count" }],
        }),
      }),
      {
        params: Promise.resolve({ surveyId: "survey-1" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Analytics query filters must be an array when provided.",
    });
    expect(runSurveyAnalytics).not.toHaveBeenCalled();
  });

  it("returns 404 when the survey is not owned by the current user", async () => {
    getCurrentSession.mockResolvedValue({ user: { id: "user-1" } });
    getSurveyAnalyticsSchema.mockRejectedValue(new Error("Survey not found."));

    const { GET } = await import("@/app/api/surveys/[surveyId]/analytics/route");
    const response = await GET(new Request("http://localhost/api/surveys/survey-1/analytics"), {
      params: Promise.resolve({ surveyId: "survey-1" }),
    });

    expect(response.status).toBe(404);
  });
});
