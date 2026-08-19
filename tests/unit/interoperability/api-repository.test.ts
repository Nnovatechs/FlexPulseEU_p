import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseAdminClient,
  getSurveyAnalyticsSchemaForOwner,
  runSurveyAnalyticsForOwner,
} = vi.hoisted(() => ({
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

describe("interoperability api repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid cursors before reaching PostgREST", async () => {
    const surveyQuery = {
      eq: vi.fn(() => surveyQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "survey-1" }, error: null }),
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
        ownerUserId: "11111111-1111-4111-8111-111111111111",
        surveyId: "survey-1",
        limit: 50,
        cursor: Buffer.from(
          JSON.stringify({ respondedAt: "not-a-date", responseId: "bad-id" }),
          "utf8",
        ).toString("base64url"),
      }),
    ).rejects.toMatchObject({ code: "invalid_request", status: 400 });
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

    await expect(
      getOwnedSurveySchemaForApi("owner-a", "survey-b"),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
    expect(getSurveyAnalyticsSchemaForOwner).not.toHaveBeenCalled();
  });

  it("accepts a profile relation returned as an object", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "survey-1" }, error: null });
    const mappingQuery = {
      eq: vi.fn(() => mappingQuery),
      order: vi.fn(() => mappingQuery),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            response_id: "22222222-2222-4222-8222-222222222222",
            mapper_output_json: { profile: {}, context_metadata: {}, mapping_metadata: {} },
            mapper_version: "v1",
            processed_at: "2026-08-19T09:00:00.000Z",
            measurement_hash_used: "mh",
            mapping_hash_used: "maph",
            survey_responses: {
              id: "22222222-2222-4222-8222-222222222222",
              survey_id: "survey-1",
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
        ownerUserId: "owner-a",
        surveyId: "survey-1",
        limit: 50,
        cursor: null,
      }),
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          survey_id: "survey-1",
          mapper_version: "v1",
        }),
      ],
    });
  });
});
