import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseAdminClient,
  geocodePostalCodeWithOpenMeteo,
  fetchHistoricalWeatherWithOpenMeteo,
  deriveNormalizedSurveyLocation,
} = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  geocodePostalCodeWithOpenMeteo: vi.fn(),
  fetchHistoricalWeatherWithOpenMeteo: vi.fn(),
  deriveNormalizedSurveyLocation: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

vi.mock("@/features/surveys/response-enrichment", () => ({
  geocodePostalCodeWithOpenMeteo,
  fetchHistoricalWeatherWithOpenMeteo,
  deriveNormalizedSurveyLocation,
}));

type UpdatePatch = Record<string, unknown>;

function createRetrySupabaseMock() {
  const responseUpdates: UpdatePatch[] = [];
  const processingJobUpdates: UpdatePatch[] = [];

  const job = {
    id: "job-1",
    response_id: "response-1",
    job_type: "response_enrichment",
    status: "pending",
    attempts: 0,
    max_attempts: 3,
    scheduled_at: new Date().toISOString(),
  };

  const client = {
    from: vi.fn((table: string) => {
      let operation: "select" | "update" | null = null;

      const builder = {
        select: vi.fn(() => {
          operation = "select";
          return builder;
        }),
        update: vi.fn((patch: UpdatePatch) => {
          operation = "update";
          if (table === "survey_responses") {
            responseUpdates.push(patch);
          }
          if (table === "processing_jobs") {
            processingJobUpdates.push(patch);
          }
          return builder;
        }),
        in: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() =>
          Promise.resolve({
            data: table === "processing_jobs" && operation === "select" ? [job] : [],
            error: null,
          }),
        ),
        maybeSingle: vi.fn(() =>
          Promise.resolve({
            data: {
              ...job,
              status: "running",
              attempts: 1,
            },
            error: null,
          }),
        ),
        single: vi.fn(() => {
          if (table === "survey_responses") {
            return Promise.resolve({
              data: {
                id: "response-1",
                survey_id: "survey-1",
                survey_link_id: "link-1",
                responded_at: new Date().toISOString(),
                country_code_raw: "ES",
                postal_code_raw: "28001",
                raw_location_retention_until: null,
              },
              error: null,
            });
          }

          if (table === "surveys") {
            return Promise.resolve({
              data: {
                id: "survey-1",
                definition_json: {
                  survey_meta: {
                    response_context: {
                      enrich_weather_context: true,
                    },
                  },
                },
              },
              error: null,
            });
          }

          return Promise.resolve({
            data: { id: "link-1" },
            error: null,
          });
        }),
        then: (resolve: (value: { error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve, reject),
      };

      return builder;
    }),
  };

  return {
    client,
    responseUpdates,
    processingJobUpdates,
  };
}

describe("survey response processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    geocodePostalCodeWithOpenMeteo.mockRejectedValue(new Error("Open-Meteo unavailable"));
  });

  it("returns a response to queued when a transient enrichment failure schedules a retry", async () => {
    const supabase = createRetrySupabaseMock();
    createSupabaseAdminClient.mockReturnValue(supabase.client);

    const { processPendingSurveyResponseEnrichmentJobs } = await import(
      "@/features/surveys/response-processing"
    );

    const result = await processPendingSurveyResponseEnrichmentJobs(10);

    expect(result).toEqual({
      processedCount: 0,
      pendingJobs: 1,
      selectedJobs: 1,
    });
    expect(supabase.responseUpdates).toEqual([
      { pipeline_status: "enriching" },
      { pipeline_status: "queued" },
    ]);
    expect(supabase.processingJobUpdates).toEqual([
      expect.objectContaining({
        status: "running",
        attempts: 1,
      }),
      expect.objectContaining({
        status: "retry_scheduled",
        last_error: "Open-Meteo unavailable",
      }),
    ]);
  });
});
