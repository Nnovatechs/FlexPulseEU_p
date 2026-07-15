import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildRawLocationRetentionUntil } from "@/lib/config/response-retention";
import type { PersistedSurvey, PersistedSurveyLink } from "./generator-types";
import type {
  SubmittedSurveyAnswer,
  ValidatedPublicSurveySubmission,
} from "./response-validation";

type CreateSurveyResponseInput = {
  survey: PersistedSurvey;
  surveyLink: PersistedSurveyLink;
  submittedLanguage: string;
  answers: Record<string, SubmittedSurveyAnswer>;
  countryCodeRaw: string | null;
  postalCodeRaw: string | null;
  legalConsent: ValidatedPublicSurveySubmission["legalConsent"];
};

export async function createSurveyResponseAndEnqueueJob(
  input: CreateSurveyResponseInput,
): Promise<{ responseId: string }> {
  const supabase = createSupabaseAdminClient();

  const shouldRetainRawLocation =
    Boolean(input.countryCodeRaw) || Boolean(input.postalCodeRaw);

  const { data: responseId, error } = await supabase.rpc(
    "create_survey_response_with_job",
    {
      p_survey_id: input.survey.id,
      p_survey_link_id: input.surveyLink.id,
      p_submitted_language: input.submittedLanguage,
      p_answers_json: input.answers,
      p_country_code_raw: input.countryCodeRaw,
      p_postal_code_raw: input.postalCodeRaw,
      p_raw_location_retention_until: shouldRetainRawLocation
        ? buildRawLocationRetentionUntil()
        : null,
      p_mapping_hash_at_submission: input.survey.mapping_hash,
      p_measurement_hash_at_submission: input.survey.measurement_hash ?? null,
      p_legal_consent_accepted: input.legalConsent.accepted,
      p_legal_consent_statement: input.legalConsent.statement,
      p_legal_consent_version: input.legalConsent.consentVersion,
      p_legal_privacy_notice_version: input.legalConsent.privacyNoticeVersion,
      p_legal_cookie_notice_version: input.legalConsent.cookieNoticeVersion,
      p_legal_consent_source: input.legalConsent.source,
    },
  );

  if (error || typeof responseId !== "string") {
    throw new Error(
      `Failed to create survey response and enqueue job: ${error?.message ?? "unknown error"}`,
    );
  }

  return { responseId };
}
