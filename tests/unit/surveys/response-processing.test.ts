import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseAdminClient,
  classifyPostalCodeInput,
  geocodePostalCodeWithOpenMeteo,
  fetchHistoricalWeatherWithOpenMeteo,
  deriveNormalizedSurveyLocation,
  upsertResponseMappingResult,
  mapSurveyResponseToOutput,
} = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  classifyPostalCodeInput: vi.fn(),
  geocodePostalCodeWithOpenMeteo: vi.fn(),
  fetchHistoricalWeatherWithOpenMeteo: vi.fn(),
  deriveNormalizedSurveyLocation: vi.fn(),
  upsertResponseMappingResult: vi.fn(),
  mapSurveyResponseToOutput: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

vi.mock("@/features/surveys/response-enrichment", () => ({
  classifyPostalCodeInput,
  geocodePostalCodeWithOpenMeteo,
  fetchHistoricalWeatherWithOpenMeteo,
  deriveNormalizedSurveyLocation,
}));

vi.mock("@/features/surveys/response-mapping-repository", () => ({
  upsertResponseMappingResult,
}));

vi.mock("@/features/surveys/response-mapper", () => ({
  mapSurveyResponseToOutput,
  RESPONSE_MAPPER_VERSION: "v1",
}));

type UpdatePatch = Record<string, unknown>;

type MockJob = {
  id: string;
  response_id: string;
  job_type: "response_enrichment" | "response_mapping";
  status: "pending" | "running" | "retry_scheduled" | "succeeded" | "failed" | "dead";
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
};

function createHappyPathSupabaseMock(options?: {
  weatherRequested?: boolean;
  postalCollectionMode?: "full" | "prefix";
}) {
  const responseUpdates: UpdatePatch[] = [];
  const processingJobUpdates: UpdatePatch[] = [];
  const insertedJobs: Array<Record<string, unknown>> = [];
  const upsertedEnrichments: Array<Record<string, unknown>> = [];

  const enrichmentJob: MockJob = {
    id: "job-enrich",
    response_id: "response-1",
    job_type: "response_enrichment",
    status: "pending",
    attempts: 0,
    max_attempts: 3,
    scheduled_at: new Date().toISOString(),
  };

  const mappingJob: MockJob = {
    id: "job-map",
    response_id: "response-1",
    job_type: "response_mapping",
    status: "pending",
    attempts: 0,
    max_attempts: 3,
    scheduled_at: new Date().toISOString(),
  };

  let selectBatch = 0;
  let mappingJobQueued = false;

  const responseRow = {
    id: "response-1",
    survey_id: "survey-1",
    survey_link_id: "link-1",
    submitted_language: "English",
    responded_at: new Date().toISOString(),
    answers_json: { Q1: 3 },
    country_code_raw: "ES",
    postal_code_raw: "28001",
    raw_location_retention_until: null,
    mapping_hash_at_submission: "mapping-hash",
    measurement_hash_at_submission: "measurement-hash",
  };

  const surveyRow = {
    id: "survey-1",
    definition_json: {
      survey_meta: {
        response_context: {
          enrich_weather_context: options?.weatherRequested ?? false,
          postal_collection_mode: options?.postalCollectionMode ?? "full",
        },
      },
    },
    mapping_compiled_json: { schema_version: 1, mappings: [] },
    mapping_contract_json: null,
    mapping_hash: "mapping-hash",
    measurement_hash: "measurement-hash",
  };

  const client = {
    from: vi.fn((table: string) => {
      let operation: "count" | "insert" | "select" | "update" | "upsert" | null = null;
      let updatePatch: UpdatePatch = {};
      let eqId: string | undefined;
      let eqStatus: string | undefined;

      const builder = {
        select: vi.fn((_columns?: string, options?: { head?: boolean }) => {
          operation = options?.head ? "count" : "select";
          return builder;
        }),
        insert: vi.fn((payload: Record<string, unknown>) => {
          operation = "insert";
          if (table === "processing_jobs") {
            mappingJobQueued = true;
            insertedJobs.push(payload);
          }
          return builder;
        }),
        upsert: vi.fn((payload: Record<string, unknown>) => {
          operation = "upsert";
          if (table === "response_enrichment") {
            upsertedEnrichments.push(payload);
          }
          return Promise.resolve({ error: null });
        }),
        update: vi.fn((patch: UpdatePatch) => {
          operation = "update";
          updatePatch = patch;

          if (table === "survey_responses") {
            responseUpdates.push(patch);
          }

          if (table === "processing_jobs") {
            processingJobUpdates.push(patch);
          }

          return builder;
        }),
        in: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          if (column === "id") {
            eqId = value as string;
          }
          if (column === "status") {
            eqStatus = value as string;
          }
          return builder;
        }),
        lte: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => {
          if (table === "processing_jobs" && operation === "select") {
            const batch = selectBatch;
            selectBatch += 1;

            if (batch === 0) {
              return Promise.resolve({ data: [{ ...enrichmentJob }], error: null });
            }

            if (batch === 1 && mappingJobQueued) {
              return Promise.resolve({ data: [{ ...mappingJob }], error: null });
            }

            return Promise.resolve({ data: [], error: null });
          }

          return Promise.resolve({ data: [], error: null });
        }),
        maybeSingle: vi.fn(() => {
          if (table === "processing_jobs" && updatePatch.status === "running") {
            const job =
              eqId === enrichmentJob.id
                ? enrichmentJob
                : eqId === mappingJob.id
                  ? mappingJob
                  : null;

            if (!job || job.status !== eqStatus) {
              return Promise.resolve({ data: null, error: null });
            }

            return Promise.resolve({
              data: {
                ...job,
                status: "running",
                attempts: (updatePatch.attempts as number) ?? job.attempts + 1,
              },
              error: null,
            });
          }

          if (table === "response_enrichment") {
            return Promise.resolve({ data: null, error: null });
          }

          return Promise.resolve({ data: null, error: null });
        }),
        single: vi.fn(() => {
          if (table === "survey_responses") {
            return Promise.resolve({ data: responseRow, error: null });
          }

          if (table === "surveys") {
            return Promise.resolve({ data: surveyRow, error: null });
          }

          return Promise.resolve({ data: { id: "link-1" }, error: null });
        }),
        then: (
          resolve: (value: { count?: number; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) =>
          Promise.resolve({
            ...(table === "processing_jobs" && operation === "count" ? { count: 0 } : {}),
            error: null,
          }).then(resolve, reject),
      };

      return builder;
    }),
  };

  return {
    client,
    responseUpdates,
    processingJobUpdates,
    insertedJobs,
    upsertedEnrichments,
  };
}

describe("survey response processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    classifyPostalCodeInput.mockReturnValue({
      normalizedPostalCode: "28001",
      inputStatus: "full",
    });
    geocodePostalCodeWithOpenMeteo.mockRejectedValue(new Error("Open-Meteo unavailable"));
    deriveNormalizedSurveyLocation.mockReturnValue({
      normalizedCountryCode: "ES",
      locationAggCode: "ES-28001",
      locationAggLabel: "Madrid",
      locationGranularity: "postal",
      centroidLat: 40.4,
      centroidLon: -3.7,
      normalizedLocationJson: {},
    });
    mapSurveyResponseToOutput.mockReturnValue({
      profile: {},
      context_metadata: {},
      mapping_metadata: {
        mapping_hash: "mapping-hash",
        measurement_hash: "measurement-hash",
      },
    });
    upsertResponseMappingResult.mockResolvedValue(undefined);
  });

  it("continues to mapping when geocoding fails technically", async () => {
    const supabase = createHappyPathSupabaseMock();
    createSupabaseAdminClient.mockReturnValue(supabase.client);

    const { processPendingSurveyResponseJobs } = await import(
      "@/features/surveys/response-processing"
    );

    const result = await processPendingSurveyResponseJobs(10);

    expect(result).toEqual({
      processedCount: 2,
      pendingJobs: 0,
      selectedJobs: 2,
    });
    expect(supabase.responseUpdates).toEqual([
      { pipeline_status: "enriching" },
      { pipeline_status: "enriched" },
      { pipeline_status: "mapping" },
      { pipeline_status: "ready" },
    ]);
    expect(supabase.upsertedEnrichments).toEqual([
      expect.objectContaining({
        quality_flag: "geocoding_technical_failure",
        temp_outdoor_c: null,
        humidity_pct: null,
      }),
    ]);
    expect(fetchHistoricalWeatherWithOpenMeteo).not.toHaveBeenCalled();
    expect(mapSurveyResponseToOutput).toHaveBeenCalledOnce();
  });

  it("processes enrichment and mapping jobs until the response is ready", async () => {
    geocodePostalCodeWithOpenMeteo.mockResolvedValue({
      latitude: 40.4,
      longitude: -3.7,
      name: "Madrid",
    });

    const supabase = createHappyPathSupabaseMock();
    createSupabaseAdminClient.mockReturnValue(supabase.client);

    const { processPendingSurveyResponseJobs } = await import(
      "@/features/surveys/response-processing"
    );

    const result = await processPendingSurveyResponseJobs(10);

    expect(result).toEqual({
      processedCount: 2,
      pendingJobs: 0,
      selectedJobs: 2,
    });
    expect(supabase.insertedJobs).toEqual([
      {
        response_id: "response-1",
        job_type: "response_mapping",
        status: "pending",
      },
    ]);
    expect(supabase.responseUpdates).toEqual([
      { pipeline_status: "enriching" },
      { pipeline_status: "enriched" },
      { pipeline_status: "mapping" },
      { pipeline_status: "ready" },
    ]);
    expect(supabase.processingJobUpdates).toEqual([
      expect.objectContaining({ status: "running", attempts: 1 }),
      expect.objectContaining({ status: "succeeded" }),
      expect.objectContaining({ status: "running", attempts: 1 }),
      expect.objectContaining({ status: "succeeded" }),
    ]);
    expect(mapSurveyResponseToOutput).toHaveBeenCalledOnce();
    expect(upsertResponseMappingResult).toHaveBeenCalledOnce();
  });

  it("stores null climate and keeps the response ready when weather fails technically", async () => {
    geocodePostalCodeWithOpenMeteo.mockResolvedValue({
      latitude: 40.4,
      longitude: -3.7,
      name: "Madrid",
      postcodes: ["28001"],
    });
    fetchHistoricalWeatherWithOpenMeteo.mockRejectedValue(new Error("Weather unavailable"));

    const supabase = createHappyPathSupabaseMock({ weatherRequested: true });
    createSupabaseAdminClient.mockReturnValue(supabase.client);

    const { processPendingSurveyResponseJobs } = await import(
      "@/features/surveys/response-processing"
    );

    const result = await processPendingSurveyResponseJobs(10);

    expect(result).toEqual({
      processedCount: 2,
      pendingJobs: 0,
      selectedJobs: 2,
    });
    expect(supabase.upsertedEnrichments).toEqual([
      expect.objectContaining({
        quality_flag: "weather_technical_failure",
        temp_outdoor_c: null,
        humidity_pct: null,
      }),
    ]);
    expect(mapSurveyResponseToOutput).toHaveBeenCalledOnce();
    expect(upsertResponseMappingResult).toHaveBeenCalledOnce();
  });

  it("stores coarse prefix context without geocoding or weather when prefix mode is enabled", async () => {
    classifyPostalCodeInput.mockReturnValue({
      normalizedPostalCode: "28",
      inputStatus: "prefix",
    });
    deriveNormalizedSurveyLocation.mockReturnValue({
      normalizedCountryCode: "ES",
      locationAggCode: "ES:postal_area:28",
      locationAggLabel: "28*",
      locationGranularity: "postal_area",
      centroidLat: null,
      centroidLon: null,
      normalizedLocationJson: {
        provider: "fallback",
        postalAreaMask: "28*",
        postalInputStatus: "prefix",
      },
    });

    const supabase = createHappyPathSupabaseMock({ postalCollectionMode: "prefix" });
    createSupabaseAdminClient.mockReturnValue(supabase.client);

    const { processPendingSurveyResponseJobs } = await import(
      "@/features/surveys/response-processing"
    );

    const result = await processPendingSurveyResponseJobs(10);

    expect(result).toEqual({
      processedCount: 2,
      pendingJobs: 0,
      selectedJobs: 2,
    });
    expect(geocodePostalCodeWithOpenMeteo).not.toHaveBeenCalled();
    expect(fetchHistoricalWeatherWithOpenMeteo).not.toHaveBeenCalled();
    expect(supabase.upsertedEnrichments).toEqual([
      expect.objectContaining({
        quality_flag: "postal_prefix_location_only",
        provider: "none",
        temp_outdoor_c: null,
        humidity_pct: null,
      }),
    ]);
  });
});
