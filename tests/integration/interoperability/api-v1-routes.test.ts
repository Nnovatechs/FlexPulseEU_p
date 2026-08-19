import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateApiRequest,
  listOwnedSurveysForApi,
  getOwnedSurveyDetailForApi,
  getOwnedSurveySchemaForApi,
  listOwnedSurveyResponsesForApi,
  listOwnedSurveyProfilesForApi,
  runOwnedSurveyAnalyticsQueryForApi,
} = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  listOwnedSurveysForApi: vi.fn(),
  getOwnedSurveyDetailForApi: vi.fn(),
  getOwnedSurveySchemaForApi: vi.fn(),
  listOwnedSurveyResponsesForApi: vi.fn(),
  listOwnedSurveyProfilesForApi: vi.fn(),
  runOwnedSurveyAnalyticsQueryForApi: vi.fn(),
}));

vi.mock("@/features/interoperability/api-auth", () => ({
  authenticateApiRequest,
}));

vi.mock("@/features/interoperability/api-repository", () => ({
  listOwnedSurveysForApi,
  getOwnedSurveyDetailForApi,
  getOwnedSurveySchemaForApi,
  listOwnedSurveyResponsesForApi,
  listOwnedSurveyProfilesForApi,
  runOwnedSurveyAnalyticsQueryForApi,
  assertAnalyticsQueryLimits: vi.fn(),
}));

describe("interoperability api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    authenticateApiRequest.mockResolvedValue({
      tokenId: "token-1",
      ownerUserId: "owner-1",
      scopes: ["surveys:read", "data:read", "analytics:read"],
      rateLimit: {
        limit: 120,
        remaining: 119,
        resetAt: "2026-08-18T12:01:00.000Z",
        retryAfterSeconds: 60,
      },
    });
  });

  it("serves the API root envelope", async () => {
    const { GET } = await import("@/app/api/v1/route");
    const response = await GET(
      new Request("http://localhost/api/v1", {
        headers: { authorization: "Bearer fp_test_demo" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: expect.objectContaining({
        service: "FlexPulseEU Interoperability API",
        api_version: "v1",
      }),
      meta: expect.objectContaining({
        api_version: "v1",
      }),
    });
  });

  it("serves the OpenAPI document publicly", async () => {
    const { GET } = await import("@/app/api/v1/openapi/route");
    const response = await GET(new Request("http://localhost/api/v1/openapi"));

    expect(authenticateApiRequest).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      openapi: "3.1.0",
      paths: expect.any(Object),
    });
  });

  it("lists owner surveys with pagination", async () => {
    listOwnedSurveysForApi.mockResolvedValue({
      items: [
        {
          id: "survey-1",
          name: "Survey A",
          status: "published",
          default_language: "en",
          supported_languages: ["en"],
          created_at: "2026-08-18T12:00:00.000Z",
          updated_at: "2026-08-18T12:00:00.000Z",
          published_at: "2026-08-18T12:00:00.000Z",
          measurement_hash: "mh",
          mapping_hash: "maph",
          response_count: 10,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    const { GET } = await import("@/app/api/v1/surveys/route");
    const response = await GET(
      new Request("http://localhost/api/v1/surveys?limit=20", {
        headers: { authorization: "Bearer fp_test_demo" },
      }),
    );

    expect(listOwnedSurveysForApi).toHaveBeenCalledWith({
      ownerUserId: "owner-1",
      limit: 20,
      cursor: null,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: "survey-1", response_count: 10 })],
      meta: expect.objectContaining({ has_more: false }),
    });
  });

  it("returns survey detail without leaking owner fields", async () => {
    getOwnedSurveyDetailForApi.mockResolvedValue({
      id: "survey-1",
      name: "Survey A",
      status: "published",
      default_language: "en",
      supported_languages: ["en"],
      created_at: "2026-08-18T12:00:00.000Z",
      updated_at: "2026-08-18T12:00:00.000Z",
      published_at: "2026-08-18T12:00:00.000Z",
      measurement_hash: "mh",
      mapping_hash: "maph",
      response_count: 10,
      definition_json: { schema_version: 1 },
      measurement_plan_json: null,
      mapping_contract_json: { schema_version: 1, mappings: [] },
      schema_namespace: "flexpulse_behavioural_schema",
      schema_version: 1,
    });

    const { GET } = await import("@/app/api/v1/surveys/[surveyId]/route");
    const response = await GET(
      new Request("http://localhost/api/v1/surveys/survey-1", {
        headers: { authorization: "Bearer fp_test_demo" },
      }),
      { params: Promise.resolve({ surveyId: "survey-1" }) },
    );

    const payload = JSON.stringify(await response.json());
    expect(payload).not.toContain("created_by");
    expect(response.status).toBe(200);
  });

  it("returns responses without confidential raw location fields", async () => {
    listOwnedSurveyResponsesForApi.mockResolvedValue({
      items: [
        {
          response_id: "response-1",
          survey_id: "survey-1",
          responded_at: "2026-08-18T12:00:00.000Z",
          submitted_language: "en",
          pipeline_status: "ready",
          answers: { Q1: "yes" },
          measurement_hash_at_submission: "mh",
          mapping_hash_at_submission: "maph",
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    const { GET } = await import("@/app/api/v1/surveys/[surveyId]/responses/route");
    const response = await GET(
      new Request("http://localhost/api/v1/surveys/survey-1/responses", {
        headers: { authorization: "Bearer fp_test_demo" },
      }),
      { params: Promise.resolve({ surveyId: "survey-1" }) },
    );

    const payload = JSON.stringify(await response.json());
    expect(payload).not.toContain("country_code_raw");
    expect(payload).not.toContain("postal_code_raw");
    expect(payload).not.toContain("survey_link_id");
    expect(payload).not.toContain("authorization");
  });

  it("returns profiles without answers_json", async () => {
    listOwnedSurveyProfilesForApi.mockResolvedValue({
      items: [
        {
          response_id: "response-1",
          survey_id: "survey-1",
          mapper_output: { profile: {}, context_metadata: {}, mapping_metadata: {} },
          mapper_version: "v1",
          processed_at: "2026-08-18T12:00:00.000Z",
          measurement_hash_used: "mh",
          mapping_hash_used: "maph",
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    const { GET } = await import("@/app/api/v1/surveys/[surveyId]/profiles/route");
    const response = await GET(
      new Request("http://localhost/api/v1/surveys/survey-1/profiles", {
        headers: { authorization: "Bearer fp_test_demo" },
      }),
      { params: Promise.resolve({ surveyId: "survey-1" }) },
    );

    const payload = JSON.stringify(await response.json());
    expect(payload).not.toContain("answers_json");
    expect(payload).toContain("mapper_output");
  });

  it("rejects malformed analytics JSON with a safe 400", async () => {
    const { POST } = await import("@/app/api/v1/surveys/[surveyId]/analytics/query/route");
    const response = await POST(
      new Request("http://localhost/api/v1/surveys/survey-1/analytics/query", {
        method: "POST",
        headers: {
          authorization: "Bearer fp_test_demo",
          "content-type": "application/json",
        },
        body: "{broken",
      }),
      { params: Promise.resolve({ surveyId: "survey-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.objectContaining({ code: "invalid_request" }),
    });
  });

  it("rejects analytics results above the external group limit", async () => {
    runOwnedSurveyAnalyticsQueryForApi.mockResolvedValue({
      schema: { survey_id: "survey-1" },
      result: {
        matched_response_count: 600,
        groups: Array.from({ length: 501 }, (_, index) => ({ key: `g-${index}` })),
      },
    });

    const { POST } = await import("@/app/api/v1/surveys/[surveyId]/analytics/query/route");
    const response = await POST(
      new Request("http://localhost/api/v1/surveys/survey-1/analytics/query", {
        method: "POST",
        headers: {
          authorization: "Bearer fp_test_demo",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          metrics: [{ key: "respondents", kind: "count" }],
        }),
      }),
      { params: Promise.resolve({ surveyId: "survey-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.objectContaining({ code: "invalid_request" }),
    });
  });
});
