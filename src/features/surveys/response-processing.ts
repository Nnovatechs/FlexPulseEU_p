import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PersistedSurvey, PersistedSurveyLink } from "./generator-types";

type ProcessingJobRow = {
  id: string;
  response_id: string;
  job_type: "response_enrichment";
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
  country_code_raw: string | null;
  postal_code_raw: string | null;
};

function maskPostalArea(postalCode: string | null) {
  if (!postalCode) {
    return null;
  }

  const compact = postalCode.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 3) {
    return `${compact}*`;
  }

  return `${compact.slice(0, 3)}*`;
}

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
  status: "enriching" | "ready" | "failed",
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

  return {
    response,
    survey: surveyData as PersistedSurvey,
    surveyLink: linkData as PersistedSurveyLink,
  };
}

async function processSingleJob(job: ProcessingJobRow) {
  const supabase = createSupabaseAdminClient();
  await updateResponsePipelineStatus(job.response_id, "enriching");

  const { response, survey } = await loadResponseRuntime(job.response_id);
  const responseContext = survey.definition_json.survey_meta.response_context;
  const normalizedCountryCode = response.country_code_raw?.trim().toUpperCase() ?? null;
  const locationAggCode = maskPostalArea(response.postal_code_raw);
  const weatherRequested = responseContext?.enrich_weather_context === true;

  const { error: enrichmentError } = await supabase.from("response_enrichment").upsert({
    response_id: response.id,
    provider: weatherRequested ? "pending_open_meteo" : "none",
    normalized_country_code: normalizedCountryCode,
    location_agg_code: locationAggCode,
    location_agg_label: locationAggCode,
    location_granularity: locationAggCode ? "postal_area" : null,
    quality_flag: weatherRequested ? "weather_pending_provider" : "not_requested",
    payload_json: weatherRequested
      ? {
          note: "Weather provider integration pending. Aggregated location persisted.",
        }
      : {
          note: "No weather enrichment requested for this survey.",
        },
  });

  if (enrichmentError) {
    throw new Error(`Failed to persist response enrichment: ${enrichmentError.message}`);
  }

  await updateResponsePipelineStatus(response.id, "ready");
  await markJobOutcome(job.id, "succeeded");
}

export async function processPendingSurveyResponseEnrichmentJobs(limit = 10) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("processing_jobs")
    .select("*")
    .in("status", ["pending", "retry_scheduled"])
    .eq("job_type", "response_enrichment")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load processing jobs: ${error.message}`);
  }

  const jobs = (data ?? []) as ProcessingJobRow[];
  let processedCount = 0;

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

    if (!claimedJob) {
      continue;
    }

    try {
      await processSingleJob(claimedJob as ProcessingJobRow);
      processedCount += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown response processing error.";

      if (nextAttempts >= job.max_attempts) {
        await updateResponsePipelineStatus(job.response_id, "failed");
        await markJobOutcome(job.id, "dead", message);
      } else {
        const nextSchedule = new Date(Date.now() + nextAttempts * 60 * 1000).toISOString();

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
      }
    }
  }

  return {
    processedCount,
    pendingJobs: jobs.length,
  };
}
