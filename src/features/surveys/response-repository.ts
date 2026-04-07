import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PersistedSurvey, PersistedSurveyLink } from "./generator-types";
import type { SubmittedSurveyAnswer } from "./response-validation";

type CreateSurveyResponseInput = {
  survey: PersistedSurvey;
  surveyLink: PersistedSurveyLink;
  submittedLanguage: string;
  answers: Record<string, SubmittedSurveyAnswer>;
  countryCodeRaw: string | null;
  postalCodeRaw: string | null;
};

type SurveyResponseRow = {
  id: string;
};

function buildRawLocationRetentionUntil() {
  return new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
}

export async function createSurveyResponseAndEnqueueJob(
  input: CreateSurveyResponseInput,
): Promise<{ responseId: string }> {
  const supabase = createSupabaseAdminClient();

  const shouldRetainRawLocation =
    Boolean(input.countryCodeRaw) || Boolean(input.postalCodeRaw);

  const { data: response, error: responseError } = await supabase
    .from("survey_responses")
    .insert({
      survey_id: input.survey.id,
      survey_link_id: input.surveyLink.id,
      submitted_language: input.submittedLanguage,
      answers_json: input.answers,
      pipeline_status: "received",
      country_code_raw: input.countryCodeRaw,
      postal_code_raw: input.postalCodeRaw,
      raw_location_retention_until: shouldRetainRawLocation
        ? buildRawLocationRetentionUntil()
        : null,
      mapping_hash_at_submission: input.survey.mapping_hash,
    })
    .select("id")
    .single();

  if (responseError || !response) {
    throw new Error(
      `Failed to create survey response: ${responseError?.message ?? "unknown error"}`,
    );
  }

  const { error: jobError } = await supabase.from("processing_jobs").insert({
    response_id: (response as SurveyResponseRow).id,
    job_type: "response_enrichment",
    status: "pending",
  });

  if (jobError) {
    throw new Error(`Failed to enqueue processing job: ${jobError.message}`);
  }

  const { error: updateError } = await supabase
    .from("survey_responses")
    .update({
      pipeline_status: "queued",
    })
    .eq("id", (response as SurveyResponseRow).id);

  if (updateError) {
    throw new Error(`Failed to update response pipeline status: ${updateError.message}`);
  }

  return { responseId: (response as SurveyResponseRow).id };
}
