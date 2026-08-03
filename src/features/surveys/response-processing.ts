import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  normalizeSurveyResponseContextConfig,
  type PersistedSurvey,
  type PersistedSurveyLink,
} from "./generator-types";
import {
  classifyPostalCodeInput,
  deriveNormalizedSurveyLocation,
  fetchHistoricalWeatherWithOpenMeteo,
  geocodePostalCodeWithOpenMeteo,
} from "./response-enrichment";
import { upsertResponseMappingResult } from "./response-mapping-repository";
import {
  mapSurveyResponseToOutput,
  RESPONSE_MAPPER_VERSION,
  type ResponseEnrichmentRecord,
} from "./response-mapper";
import type { SubmittedSurveyAnswer } from "./response-validation";

type ProcessingJobRow = {
  id: string;
  response_id: string;
  job_type: "response_enrichment" | "response_mapping";
  status:
    | "pending"
    | "running"
    | "retry_scheduled"
    | "succeeded"
    | "failed"
    | "dead";
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
};

type SurveyResponseRow = {
  id: string;
  survey_id: string;
  survey_link_id: string;
  submitted_language: string;
  responded_at: string;
  answers_json: Record<string, SubmittedSurveyAnswer>;
  country_code_raw: string | null;
  postal_code_raw: string | null;
  raw_location_retention_until: string | null;
  mapping_hash_at_submission: string | null;
  measurement_hash_at_submission: string | null;
};

async function markJobOutcome(
  jobId: string,
  status: "succeeded" | "retry_scheduled" | "dead",
  lastError?: string | null,
) {
  const supabase = createSupabaseAdminClient();

  const patch: Record<string, unknown> = {
    status,
    last_error: lastError ?? null,
  };

  if (status === "succeeded" || status === "dead") {
    patch.finished_at = new Date().toISOString();
  }

  const { error } = await supabase.from("processing_jobs").update(patch).eq("id", jobId);

  if (error) {
    throw new Error(`Failed to update processing job: ${error.message}`);
  }
}

async function updateResponsePipelineStatus(
  responseId: string,
  status: "queued" | "enriching" | "enriched" | "mapping" | "ready" | "failed",
) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("survey_responses")
    .update({ pipeline_status: status })
    .eq("id", responseId);

  if (error) {
    throw new Error(`Failed to update response pipeline status: ${error.message}`);
  }
}

async function loadResponseRuntime(responseId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: responseData, error: responseError } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("id", responseId)
    .single();

  if (responseError || !responseData) {
    throw new Error(`Failed to load survey response: ${responseError?.message ?? "unknown"}`);
  }

  const response = responseData as SurveyResponseRow;

  const { data: surveyData, error: surveyError } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", response.survey_id)
    .single();

  if (surveyError || !surveyData) {
    throw new Error(`Failed to load survey for response: ${surveyError?.message ?? "unknown"}`);
  }

  const { data: linkData, error: linkError } = await supabase
    .from("survey_links")
    .select("*")
    .eq("id", response.survey_link_id)
    .single();

  if (linkError || !linkData) {
    throw new Error(`Failed to load survey link for response: ${linkError?.message ?? "unknown"}`);
  }

  const { data: enrichmentData, error: enrichmentError } = await supabase
    .from("response_enrichment")
    .select("*")
    .eq("response_id", responseId)
    .maybeSingle();

  if (enrichmentError) {
    throw new Error(
      `Failed to load response enrichment: ${enrichmentError.message}`,
    );
  }

  return {
    response,
    survey: surveyData as PersistedSurvey,
    surveyLink: linkData as PersistedSurveyLink,
    enrichment: (enrichmentData as ResponseEnrichmentRecord | null) ?? null,
  };
}

async function purgeExpiredRawLocationData(limit = 200) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("survey_responses")
    .select("id")
    .not("raw_location_retention_until", "is", null)
    .or("country_code_raw.not.is.null,postal_code_raw.not.is.null")
    .lte("raw_location_retention_until", now)
    .order("raw_location_retention_until", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load expired raw location data: ${error.message}`);
  }

  const expiredIds = (data ?? []).map((row) => row.id as string);
  if (expiredIds.length === 0) {
    return { purgedCount: 0 };
  }

  const { error: updateError } = await supabase
    .from("survey_responses")
    .update({
      country_code_raw: null,
      postal_code_raw: null,
      raw_location_retention_until: null,
    })
    .in("id", expiredIds);

  if (updateError) {
    throw new Error(`Failed to purge raw location data: ${updateError.message}`);
  }

  return { purgedCount: expiredIds.length };
}

async function enqueueResponseMappingJob(responseId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("processing_jobs").insert({
    response_id: responseId,
    job_type: "response_mapping",
    status: "pending",
  });

  if (error) {
    throw new Error(`Failed to enqueue response mapping job: ${error.message}`);
  }
}

async function processEnrichmentJob(job: ProcessingJobRow) {
  const supabase = createSupabaseAdminClient();
  await updateResponsePipelineStatus(job.response_id, "enriching");

  const { response, survey } = await loadResponseRuntime(job.response_id);
  const responseContext = normalizeSurveyResponseContextConfig(
    survey.definition_json.survey_meta.response_context,
  );
  const normalizedCountryCode = response.country_code_raw?.trim().toUpperCase() ?? null;
  const weatherRequested = responseContext.enrich_weather_context === true;
  const postalCode = response.postal_code_raw?.trim() ?? null;
  const postalInput = classifyPostalCodeInput({
    countryCode: normalizedCountryCode,
    postalCode,
    collectionMode: responseContext.postal_collection_mode,
  });
  const normalizedPostalCode = postalInput.normalizedPostalCode;
  const canAttemptGeocoding =
    normalizedCountryCode != null &&
    postalInput.inputStatus === "full" &&
    normalizedPostalCode != null;
  let geocodedLocation = null;
  let geocodingTechnicalFailure = false;

  if (
    normalizedCountryCode != null &&
    postalInput.inputStatus === "full" &&
    normalizedPostalCode != null
  ) {
    try {
      geocodedLocation = await geocodePostalCodeWithOpenMeteo({
        countryCode: normalizedCountryCode,
        postalCode: normalizedPostalCode,
      });
    } catch {
      geocodingTechnicalFailure = true;
    }
  }

  const normalizedLocation = deriveNormalizedSurveyLocation({
    countryCode: normalizedCountryCode,
    postalCode: postalInput.normalizedPostalCode,
    geocodedLocation,
    postalInputStatus: postalInput.inputStatus,
  });
  const { centroidLat, centroidLon } = normalizedLocation;

  const canAttemptWeather =
    weatherRequested &&
    postalInput.inputStatus === "full" &&
    geocodedLocation != null &&
    centroidLat != null &&
    centroidLon != null;
  let weatherObservation = null;
  let weatherTechnicalFailure = false;

  if (canAttemptWeather) {
    try {
      weatherObservation = await fetchHistoricalWeatherWithOpenMeteo({
        latitude: centroidLat,
        longitude: centroidLon,
        respondedAt: response.responded_at,
      });
    } catch {
      weatherTechnicalFailure = true;
    }
  }

  const qualityFlag =
    postalInput.inputStatus === "prefix"
      ? "postal_prefix_location_only"
      : postalInput.inputStatus === "partial"
      ? "postal_partial_location_only"
      : postalInput.inputStatus === "invalid_or_unresolved"
        ? "postal_invalid_or_unresolved"
        : geocodingTechnicalFailure
          ? "geocoding_technical_failure"
          : weatherRequested
            ? geocodedLocation == null
              ? "postal_invalid_or_unresolved"
              : weatherObservation
                ? "weather_ok"
                : weatherTechnicalFailure
                  ? "weather_technical_failure"
                  : "weather_unavailable"
            : "weather_not_requested";
  const provider =
    canAttemptGeocoding || canAttemptWeather ? "open_meteo" : "none";

  const { error: enrichmentError } = await supabase.from("response_enrichment").upsert({
    response_id: response.id,
    provider,
    normalized_country_code: normalizedLocation.normalizedCountryCode,
    location_agg_code: normalizedLocation.locationAggCode,
    location_agg_label: normalizedLocation.locationAggLabel,
    location_granularity: normalizedLocation.locationGranularity,
    centroid_lat: normalizedLocation.centroidLat,
    centroid_lon: normalizedLocation.centroidLon,
    normalized_location_json: normalizedLocation.normalizedLocationJson,
    temp_outdoor_c: weatherObservation?.temperatureOutdoorC ?? null,
    humidity_pct: weatherObservation?.humidityPct ?? null,
    observed_at: weatherObservation?.observedAt ?? null,
    quality_flag: qualityFlag,
    payload_json: {
      postal_input_status: postalInput.inputStatus,
      weather:
        weatherObservation?.payload ??
        {
          source: weatherRequested ? "not_available" : "not_requested",
          technical_failure: weatherTechnicalFailure,
        },
      geocoding: {
        attempted: canAttemptGeocoding,
        technical_failure: geocodingTechnicalFailure,
      },
      raw_location_retention_until: response.raw_location_retention_until,
    },
  });

  if (enrichmentError) {
    throw new Error(`Failed to persist response enrichment: ${enrichmentError.message}`);
  }

  await updateResponsePipelineStatus(response.id, "enriched");
  await enqueueResponseMappingJob(response.id);
  await markJobOutcome(job.id, "succeeded");
}

async function processMappingJob(job: ProcessingJobRow) {
  await updateResponsePipelineStatus(job.response_id, "mapping");

  const { response, survey, enrichment } = await loadResponseRuntime(job.response_id);

  const mapperOutput = mapSurveyResponseToOutput({
    survey,
    answers: response.answers_json,
    submittedLanguage: response.submitted_language,
    countryCodeRaw: response.country_code_raw,
    mappingHashAtSubmission: response.mapping_hash_at_submission,
    measurementHashAtSubmission: response.measurement_hash_at_submission,
    enrichment,
  });

  await upsertResponseMappingResult({
    responseId: response.id,
    mapperOutput,
    mappingHashUsed: mapperOutput.mapping_metadata.mapping_hash,
    measurementHashUsed: mapperOutput.mapping_metadata.measurement_hash,
    mapperVersion: RESPONSE_MAPPER_VERSION,
  });

  await updateResponsePipelineStatus(response.id, "ready");
  await markJobOutcome(job.id, "succeeded");
}

function getRetryPipelineStatus(jobType: ProcessingJobRow["job_type"]) {
  return jobType === "response_mapping" ? "enriched" : "queued";
}

async function claimNextProcessingJob() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("processing_jobs")
    .select("*")
    .in("status", ["pending", "retry_scheduled"])
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`Failed to load processing jobs: ${error.message}`);
  }

  const jobs = (data ?? []) as ProcessingJobRow[];

  for (const job of jobs) {
    const nextAttempts = job.attempts + 1;

    const { data: claimedJob, error: claimError } = await supabase
      .from("processing_jobs")
      .update({
        status: "running",
        attempts: nextAttempts,
        last_error: null,
      })
      .eq("id", job.id)
      .eq("status", job.status)
      .select("*")
      .maybeSingle();

    if (claimError) {
      throw new Error(`Failed to claim processing job: ${claimError.message}`);
    }

    if (claimedJob) {
      return claimedJob as ProcessingJobRow;
    }
  }

  return null;
}

async function countPendingProcessingJobs() {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("processing_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "retry_scheduled"])
    .lte("scheduled_at", new Date().toISOString())
    ;

  if (error) {
    throw new Error(`Failed to load processing jobs: ${error.message}`);
  }

  return count ?? 0;
}

async function processClaimedJob(job: ProcessingJobRow) {
  if (job.job_type === "response_mapping") {
    await processMappingJob(job);
    return;
  }

  await processEnrichmentJob(job);
}

export async function processPendingSurveyResponseJobs(limit = 10) {
  let processedCount = 0;

  while (processedCount < limit) {
    const job = await claimNextProcessingJob();
    if (!job) {
      break;
    }

    const nextAttempts = job.attempts;

    try {
      await processClaimedJob(job);
      processedCount += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown response processing error.";

      if (nextAttempts >= job.max_attempts) {
        await updateResponsePipelineStatus(job.response_id, "failed");
        await markJobOutcome(job.id, "dead", message);
      } else {
        const nextSchedule = new Date(Date.now() + nextAttempts * 60 * 1000).toISOString();
        const retryPipelineStatus = getRetryPipelineStatus(job.job_type);

        const supabase = createSupabaseAdminClient();
        const { error: retryError } = await supabase
          .from("processing_jobs")
          .update({
            status: "retry_scheduled",
            last_error: message,
            scheduled_at: nextSchedule,
          })
          .eq("id", job.id);

        if (retryError) {
          throw new Error(`Failed to reschedule processing job: ${retryError.message}`);
        }

        await updateResponsePipelineStatus(job.response_id, retryPipelineStatus);
      }
    }
  }

  const pendingJobs = await countPendingProcessingJobs();

  return {
    processedCount,
    pendingJobs,
    selectedJobs: processedCount,
  };
}

export async function cleanupExpiredSurveyResponseLocationData(limit = 200) {
  return purgeExpiredRawLocationData(limit);
}
