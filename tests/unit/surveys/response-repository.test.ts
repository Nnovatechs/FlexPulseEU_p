import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistedSurvey, PersistedSurveyLink } from "@/features/surveys/generator-types";
import { buildValidationSurveyFixture } from "../../fixtures/surveys/validation/factory";

const { createSupabaseAdminClient } = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

function createSurveyFixture(): PersistedSurvey {
  const fixture = buildValidationSurveyFixture({
    title: "Public survey",
  });

  return {
    id: "survey-1",
    name: "Public survey",
    status: "published",
    created_by: "user-1",
    created_at: "2026-05-21T10:00:00.000Z",
    updated_at: "2026-05-21T10:00:00.000Z",
    published_at: "2026-05-21T10:00:00.000Z",
    default_language: fixture.language,
    supported_languages: [fixture.language],
    definition_json: fixture.definition,
    mapping_contract_json: {
      schema_version: 1,
      mappings: fixture.mappings,
    },
    mapping_compiled_json: null,
    mapping_hash: "mapping-hash",
  };
}

function createSurveyLinkFixture(): PersistedSurveyLink {
  return {
    id: "link-1",
    survey_id: "survey-1",
    link_token: "public-token",
    audience_label: "Default audience",
    audience_token: "default",
    is_active: true,
    created_at: "2026-05-21T10:00:00.000Z",
  };
}

describe("survey response repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates responses through the transactional RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "response-1",
      error: null,
    });
    createSupabaseAdminClient.mockReturnValue({ rpc });

    const { createSurveyResponseAndEnqueueJob } = await import(
      "@/features/surveys/response-repository"
    );

    await expect(
      createSurveyResponseAndEnqueueJob({
        survey: createSurveyFixture(),
        surveyLink: createSurveyLinkFixture(),
        submittedLanguage: "English",
        answers: {
          Q1: "yes",
        },
        countryCodeRaw: "ES",
        postalCodeRaw: "28001",
      }),
    ).resolves.toEqual({ responseId: "response-1" });

    expect(rpc).toHaveBeenCalledWith("create_survey_response_with_job", {
      p_survey_id: "survey-1",
      p_survey_link_id: "link-1",
      p_submitted_language: "English",
      p_answers_json: {
        Q1: "yes",
      },
      p_country_code_raw: "ES",
      p_postal_code_raw: "28001",
      p_raw_location_retention_until: "2026-05-24T12:00:00.000Z",
      p_mapping_hash_at_submission: "mapping-hash",
    });
  });

  it("surfaces RPC failures", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function not found" },
    });
    createSupabaseAdminClient.mockReturnValue({ rpc });

    const { createSurveyResponseAndEnqueueJob } = await import(
      "@/features/surveys/response-repository"
    );

    await expect(
      createSurveyResponseAndEnqueueJob({
        survey: createSurveyFixture(),
        surveyLink: createSurveyLinkFixture(),
        submittedLanguage: "English",
        answers: {},
        countryCodeRaw: null,
        postalCodeRaw: null,
      }),
    ).rejects.toThrow(
      "Failed to create survey response and enqueue job: function not found",
    );
  });
});
