import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeCursor } from "@/features/interoperability/api-pagination";

const { createSupabaseAdminClient, getSurveyAnalyticsSchemaForOwner, runSurveyAnalyticsForOwner } =
  vi.hoisted(() => ({
    createSupabaseAdminClient: vi.fn(),
    getSurveyAnalyticsSchemaForOwner: vi.fn(),
    runSurveyAnalyticsForOwner: vi.fn(),
  }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

vi.mock("@/features/surveys/use-cases", () => ({
  getSurveyAnalyticsSchemaForOwner,
  runSurveyAnalyticsForOwner,
}));

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const SURVEY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RESPONSE_ID = "22222222-2222-4222-8222-222222222222";

describe("interoperability api repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid cursors before reaching PostgREST", async () => {
    const surveyQuery = {
      eq: vi.fn(() => surveyQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SURVEY_ID }, error: null }),
    };
    createSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => surveyQuery),
      })),
    });

    const { listOwnedSurveyResponsesForApi } = await import(
      "@/features/interoperability/api-repository"
    );

    await expect(
      listOwnedSurveyResponsesForApi({
        ownerUserId: OWNER_ID,
        surveyId: SURVEY_ID,
        limit: 50,
        cursor: Buffer.from(
          JSON.stringify({ respondedAt: "not-a-date", responseId: "bad-id" }),
          "utf8",
        ).toString("base64url"),
      }),
    ).rejects.toMatchObject({ code: "invalid_request", status: 400 });
  });

  it("quotes timestamp cursor values in PostgREST or() filters", async () => {
    const respondedAt = "2026-08-19T09:00:00.123+00:00";
    const responseQuery = {
      eq: vi.fn(() => responseQuery),
      order: vi.fn(() => responseQuery),
      limit: vi.fn(() => responseQuery),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const surveyQuery = {
      eq: vi.fn(() => surveyQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SURVEY_ID }, error: null }),
    };
    createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) => ({
        select: vi.fn(() => (table === "surveys" ? surveyQuery : responseQuery)),
      })),
    });

    const { listOwnedSurveyResponsesForApi } = await import(
      "@/features/interoperability/api-repository"
    );

    await listOwnedSurveyResponsesForApi({
      ownerUserId: OWNER_ID,
      surveyId: SURVEY_ID,
      limit: 50,
      cursor: encodeCursor({
        respondedAt,
        responseId: RESPONSE_ID,
      }),
    });

    expect(responseQuery.or).toHaveBeenCalledWith(
      `responded_at.lt."${respondedAt}",and(responded_at.eq."${respondedAt}",id.lt."${RESPONSE_ID}")`,
    );
  });

  it("quotes survey and profile cursor timestamps the same way", async () => {
    const createdAt = "2026-08-19T09:00:00.123+00:00";
    const processedAt = "2026-08-19T10:15:30.456+00:00";
    const surveyListQuery = {
      eq: vi.fn(() => surveyListQuery),
      neq: vi.fn(() => surveyListQuery),
      order: vi.fn(() => surveyListQuery),
      limit: vi.fn(() => surveyListQuery),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const mappingQuery = {
      eq: vi.fn(() => mappingQuery),
      order: vi.fn(() => mappingQuery),
      limit: vi.fn(() => mappingQuery),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const ownedSurveyQuery = {
      eq: vi.fn(() => ownedSurveyQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SURVEY_ID }, error: null }),
    };

    const { listOwnedSurveysForApi, listOwnedSurveyProfilesForApi } = await import(
      "@/features/interoperability/api-repository"
    );

    createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "surveys") {
          return { select: vi.fn(() => surveyListQuery) };
        }
        return { select: vi.fn(() => mappingQuery) };
      }),
    });

    await listOwnedSurveysForApi({
      ownerUserId: OWNER_ID,
      limit: 50,
      cursor: encodeCursor({ createdAt, id: SURVEY_ID }),
    });
    expect(surveyListQuery.or).toHaveBeenCalledWith(
      `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt."${SURVEY_ID}")`,
    );

    createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) => ({
        select: vi.fn(() => (table === "surveys" ? ownedSurveyQuery : mappingQuery)),
      })),
    });

    await listOwnedSurveyProfilesForApi({
      ownerUserId: OWNER_ID,
      surveyId: SURVEY_ID,
      limit: 50,
      cursor: encodeCursor({ processedAt, responseId: RESPONSE_ID }),
    });
    expect(mappingQuery.or).toHaveBeenCalledWith(
      `processed_at.lt."${processedAt}",and(processed_at.eq."${processedAt}",response_id.lt."${RESPONSE_ID}")`,
    );
  });

  it("counts listed surveys with exact SQL counts instead of loading response rows", async () => {
    const createdAt = "2026-08-19T09:00:00.123+00:00";
    const surveyQuery = {
      eq: vi.fn(() => surveyQuery),
      neq: vi.fn(() => surveyQuery),
      order: vi.fn(() => surveyQuery),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: SURVEY_ID,
            name: "Survey A",
            status: "published",
            created_at: createdAt,
            updated_at: createdAt,
            published_at: createdAt,
            default_language: "en",
            supported_languages: ["en"],
            mapping_hash: "maph",
            measurement_hash: "mh",
          },
        ],
        error: null,
      }),
      or: vi.fn(() => surveyQuery),
    };
    const countEq = vi.fn().mockResolvedValue({ count: 3543, error: null });
    const countSelect = vi.fn(() => ({ eq: countEq }));
    createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "surveys") {
          return { select: vi.fn(() => surveyQuery) };
        }
        return { select: countSelect };
      }),
    });

    const { listOwnedSurveysForApi } = await import("@/features/interoperability/api-repository");
    const result = await listOwnedSurveysForApi({
      ownerUserId: OWNER_ID,
      limit: 50,
      cursor: null,
    });

    expect(countSelect).toHaveBeenCalledWith("id", { head: true, count: "exact" });
    expect(countSelect).not.toHaveBeenCalledWith("survey_id");
    expect(result.items[0]?.response_count).toBe(3543);
  });

  it("rejects invalid survey ids before querying", async () => {
    const { getOwnedSurveySchemaForApi, getOwnedSurveyDetailForApi, listOwnedSurveyResponsesForApi } =
      await import("@/features/interoperability/api-repository");

    await expect(getOwnedSurveySchemaForApi(OWNER_ID, "survey-b")).rejects.toMatchObject({
      code: "invalid_request",
      status: 400,
    });
    await expect(getOwnedSurveyDetailForApi(OWNER_ID, "not-a-uuid")).rejects.toMatchObject({
      code: "invalid_request",
      status: 400,
    });
    await expect(
      listOwnedSurveyResponsesForApi({
        ownerUserId: OWNER_ID,
        surveyId: "bad",
        limit: 50,
        cursor: null,
      }),
    ).rejects.toMatchObject({ code: "invalid_request", status: 400 });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(getSurveyAnalyticsSchemaForOwner).not.toHaveBeenCalled();
  });

  it("returns 404 and does not invoke analytics use cases for surveys owned by another user", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    createSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
      })),
    });

    const { getOwnedSurveySchemaForApi } = await import(
      "@/features/interoperability/api-repository"
    );

    await expect(getOwnedSurveySchemaForApi(OWNER_ID, SURVEY_ID)).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });
    expect(getSurveyAnalyticsSchemaForOwner).not.toHaveBeenCalled();
  });

  it("accepts a profile relation returned as an object", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: SURVEY_ID }, error: null });
    const mappingQuery = {
      eq: vi.fn(() => mappingQuery),
      order: vi.fn(() => mappingQuery),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            response_id: RESPONSE_ID,
            mapper_output_json: { profile: {}, context_metadata: {}, mapping_metadata: {} },
            mapper_version: "v1",
            processed_at: "2026-08-19T09:00:00.000Z",
            measurement_hash_used: "mh",
            mapping_hash_used: "maph",
            survey_responses: {
              id: RESPONSE_ID,
              survey_id: SURVEY_ID,
            },
          },
        ],
        error: null,
      }),
      or: vi.fn(() => mappingQuery),
    };
    const surveyQuery = {
      eq: vi.fn(() => surveyQuery),
      maybeSingle,
    };
    createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "surveys") {
          return {
            select: vi.fn(() => surveyQuery),
          };
        }
        return {
          select: vi.fn(() => mappingQuery),
        };
      }),
    });

    const { listOwnedSurveyProfilesForApi } = await import(
      "@/features/interoperability/api-repository"
    );

    await expect(
      listOwnedSurveyProfilesForApi({
        ownerUserId: OWNER_ID,
        surveyId: SURVEY_ID,
        limit: 50,
        cursor: null,
      }),
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          survey_id: SURVEY_ID,
          mapper_version: "v1",
        }),
      ],
    });
  });
});
