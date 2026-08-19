import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseAdminClient } = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

describe("public survey load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for inactive public links", async () => {
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

    const { getPublicSurveyLinkByToken } = await import("@/features/surveys/public-survey-load");
    await expect(getPublicSurveyLinkByToken("inactive-link")).resolves.toBeNull();
  });

  it("loads an additional active link for the same published survey", async () => {
    createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue(
                table === "survey_links"
                  ? {
                      data: {
                        id: "link-2",
                        survey_id: "survey-1",
                        link_token: "audience-link",
                        audience_label: "Pilot cohort A",
                        audience_token: "aud_1",
                        is_active: true,
                        created_at: "2026-08-01T10:00:00.000Z",
                      },
                      error: null,
                    }
                  : {
                      data: {
                        id: "survey-1",
                        name: "Survey",
                        status: "published",
                        created_by: "owner-1",
                        created_at: "2026-08-01T10:00:00.000Z",
                        updated_at: "2026-08-01T10:00:00.000Z",
                        published_at: "2026-08-01T10:00:00.000Z",
                        default_language: "English",
                        supported_languages: ["English"],
                        definition_json: { survey_meta: {}, questions: [], translations: {}, validation_rules: {} },
                        mapping_contract_json: { schema_version: 1, mappings: [] },
                        mapping_compiled_json: null,
                        mapping_hash: "mapping-hash",
                        measurement_hash: "measurement-hash",
                      },
                      error: null,
                    },
              ),
            })),
          })),
        })),
      })),
    });

    const { getPublicSurveyLinkByToken, getPublishedSurveyByIdPublic } = await import(
      "@/features/surveys/public-survey-load"
    );
    const link = await getPublicSurveyLinkByToken("audience-link");
    const survey = await getPublishedSurveyByIdPublic("survey-1");

    expect(link).toMatchObject({
      id: "link-2",
      audience_label: "Pilot cohort A",
      survey_id: "survey-1",
    });
    expect(survey?.id).toBe("survey-1");
  });
});
