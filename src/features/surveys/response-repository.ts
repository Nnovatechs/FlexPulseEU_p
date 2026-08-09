import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildRawLocationRetentionUntil } from "@/lib/config/response-retention";
import type { PersistedSurvey, PersistedSurveyLink } from "./generator-types";
import type {
  SubmittedSurveyAnswer,
  ValidatedPublicSurveySubmission,
} from "./response-validation";
import type { PersistedSurveyLinkIntegration } from "./integrations/types";

type CreateSurveyResponseInput = {
  survey: PersistedSurvey;
  surveyLink: PersistedSurveyLink;
  submittedLanguage: string;
  answers: Record<string, SubmittedSurveyAnswer>;
  countryCodeRaw: string | null;
  postalCodeRaw: string | null;
  legalConsent: ValidatedPublicSurveySubmission["legalConsent"];
  externalRecruitment?: {
    integration: PersistedSurveyLinkIntegration;
    participantToken: string;
    submissionToken: string;
    tokenVersion: string;
    noticeVersion: string;
  } | null;
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
      p_external_integration_id: input.externalRecruitment?.integration.id ?? null,
      p_external_participant_token: input.externalRecruitment?.participantToken ?? null,
      p_external_submission_token: input.externalRecruitment?.submissionToken ?? null,
      p_external_token_version: input.externalRecruitment?.tokenVersion ?? null,
      p_external_notice_version: input.externalRecruitment?.noticeVersion ?? null,
    },
  );

  if (error || typeof responseId !== "string") {
    throw new Error(
      `Failed to create survey response and enqueue job: ${error?.message ?? "unknown error"}`,
    );
  }

  return { responseId };
}
