import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCurrentSession,
  createSupabaseServerClient,
} = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

function buildSurveyRow(status: "published" | "draft" | "archived" = "published") {
  return {
    id: "survey-1",
    name: "Survey",
    status,
    created_by: "owner-1",
    created_at: "2026-08-01T10:00:00.000Z",
    updated_at: "2026-08-01T10:00:00.000Z",
    published_at: status === "published" ? "2026-08-01T10:00:00.000Z" : null,
    default_language: "English",
    supported_languages: ["English"],
    definition_json: { survey_meta: {}, questions: [], translations: {}, validation_rules: {} },
    mapping_contract_json: { schema_version: 1, mappings: [] },
    mapping_compiled_json: null,
    mapping_hash: "mapping-hash",
    measurement_hash: "measurement-hash",
  };
}

function buildLinkRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "link-1",
    survey_id: "survey-1",
    link_token: "token-1",
    audience_label: "Default audience",
    audience_token: "default",
    is_active: true,
    created_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("generator repository audience links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentSession.mockResolvedValue({ user: { id: "owner-1" } });
  });

  it("creates an audience link for a published owned survey", async () => {
    const inserted = vi.fn().mockResolvedValue({
      data: buildLinkRow({
        id: "link-2",
        link_token: "generated-token",
        audience_label: "Pilot cohort A",
        audience_token: "aud_deadbeef",
      }),
      error: null,
    });
    const surveysQuery = {
      eq: vi.fn(() => surveysQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: buildSurveyRow("published"), error: null }),
    };
    const linksQuery = {
      eq: vi.fn(() => linksQuery),
      order: vi.fn().mockResolvedValue({ data: [buildLinkRow()], error: null }),
    };
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "surveys") {
          return { select: vi.fn(() => surveysQuery) };
        }
        return {
          select: vi.fn(() => linksQuery),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: inserted,
            })),
          })),
        };
      }),
      rpc: vi.fn().mockResolvedValue({ data: "generated-token", error: null }),
    });

    const { createOwnedSurveyAudienceLink } = await import(
      "@/features/surveys/generator-repository"
    );
    const link = await createOwnedSurveyAudienceLink({
      surveyId: "survey-1",
      audienceLabel: "  Pilot   cohort A  ",
    });

    expect(link.audience_label).toBe("Pilot cohort A");
    expect(link.audience_token.startsWith("aud_")).toBe(true);
  });

  it("rejects duplicate audience labels ignoring case and spacing", async () => {
    const surveysQuery = {
      eq: vi.fn(() => surveysQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: buildSurveyRow("published"), error: null }),
    };
    const linksQuery = {
      eq: vi.fn(() => linksQuery),
      order: vi.fn().mockResolvedValue({
        data: [buildLinkRow({ audience_label: "Pilot cohort A", audience_token: "aud_1" })],
        error: null,
      }),
    };
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) =>
        table === "surveys"
          ? { select: vi.fn(() => surveysQuery) }
          : { select: vi.fn(() => linksQuery) },
      ),
      rpc: vi.fn(),
    });

    const { createOwnedSurveyAudienceLink } = await import(
      "@/features/surveys/generator-repository"
    );
    await expect(
      createOwnedSurveyAudienceLink({
        surveyId: "survey-1",
        audienceLabel: " pilot   COHORT a ",
      }),
    ).rejects.toThrow("Audience label already exists for this survey.");
  });

  it("rejects audience links for draft or archived surveys", async () => {
    const surveysQuery = {
      eq: vi.fn(() => surveysQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: buildSurveyRow("draft"), error: null }),
    };
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({ select: vi.fn(() => surveysQuery) })),
      rpc: vi.fn(),
    });

    const { createOwnedSurveyAudienceLink } = await import(
      "@/features/surveys/generator-repository"
    );
    await expect(
      createOwnedSurveyAudienceLink({
        surveyId: "survey-1",
        audienceLabel: "Pilot cohort A",
      }),
    ).rejects.toThrow("Audience links can only be created for published surveys.");
  });

  it("prevents deactivating the default link but allows toggling additional links", async () => {
    const surveysQuery = {
      eq: vi.fn(() => surveysQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: buildSurveyRow("published"), error: null }),
    };
    const updateSingle = vi.fn().mockResolvedValue({
      data: buildLinkRow({
        id: "link-2",
        audience_label: "Pilot cohort A",
        audience_token: "aud_1",
        is_active: false,
      }),
      error: null,
    });
    const linksQuery = {
      eq: vi.fn(() => linksQuery),
      order: vi.fn().mockResolvedValue({
        data: [
          buildLinkRow(),
          buildLinkRow({
            id: "link-2",
            audience_label: "Pilot cohort A",
            audience_token: "aud_1",
            is_active: true,
          }),
        ],
        error: null,
      }),
    };
    createSupabaseServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "surveys") {
          return { select: vi.fn(() => surveysQuery) };
        }
        return {
          select: vi.fn(() => linksQuery),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: updateSingle,
                })),
              })),
            })),
          })),
        };
      }),
      rpc: vi.fn(),
    });

    const { setOwnedSurveyAudienceLinkActive } = await import(
      "@/features/surveys/generator-repository"
    );

    await expect(
      setOwnedSurveyAudienceLinkActive({
        surveyId: "survey-1",
        surveyLinkId: "link-1",
        isActive: false,
      }),
    ).rejects.toThrow("The default audience link cannot be deactivated.");

    await expect(
      setOwnedSurveyAudienceLinkActive({
        surveyId: "survey-1",
        surveyLinkId: "link-2",
        isActive: false,
      }),
    ).resolves.toMatchObject({
      id: "link-2",
      is_active: false,
    });
  });
});
