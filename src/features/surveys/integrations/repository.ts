import { requireCurrentSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseProlificCompletionUrl } from "./prolific";
import {
  EXTERNAL_RECRUITMENT_NOTICE_VERSION,
  SURVEY_LINK_INTEGRATION_PROVIDER_PROLIFIC,
  type PersistedSurveyLinkIntegration,
  type ProlificIntegrationSummary,
} from "./types";

type SurveyLinkIntegrationRow = PersistedSurveyLinkIntegration;

function mapSurveyLinkIntegrationRow(
  row: SurveyLinkIntegrationRow,
): PersistedSurveyLinkIntegration {
  return {
    id: row.id,
    survey_link_id: row.survey_link_id,
    provider: row.provider,
    external_study_id: row.external_study_id,
    completion_url: row.completion_url,
    provider_config_json: row.provider_config_json ?? {},
    privacy_notice_version: row.privacy_notice_version,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toProlificIntegrationSummary(
  integration: PersistedSurveyLinkIntegration,
): ProlificIntegrationSummary {
  const parsed = parseProlificCompletionUrl(integration.completion_url);
  return {
    id: integration.id,
    studyId: integration.external_study_id,
    completionUrl: integration.completion_url,
    completionCode: parsed.completionCode,
    isActive: integration.is_active,
  };
}

async function assertOwnedSurveyLink(surveyLinkId: string) {
  await requireCurrentSession();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("survey_links")
    .select("id")
    .eq("id", surveyLinkId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify survey link ownership: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Survey link not found or inaccessible.");
  }
}

export async function getOwnedProlificIntegrationSummary(
  surveyLinkId: string,
): Promise<ProlificIntegrationSummary | null> {
  await assertOwnedSurveyLink(surveyLinkId);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("survey_link_integrations")
    .select("*")
    .eq("survey_link_id", surveyLinkId)
    .eq("provider", SURVEY_LINK_INTEGRATION_PROVIDER_PROLIFIC)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Prolific integration: ${error.message}`);
  }

  return data
    ? toProlificIntegrationSummary(
        mapSurveyLinkIntegrationRow(data as SurveyLinkIntegrationRow),
      )
    : null;
}

export async function upsertOwnedProlificIntegration(input: {
  surveyLinkId: string;
  studyId: string;
  completionUrl: string;
}): Promise<ProlificIntegrationSummary> {
  await assertOwnedSurveyLink(input.surveyLinkId);
  const supabase = await createSupabaseServerClient();
  const studyId = input.studyId.trim();
  if (!studyId) {
    throw new Error("Prolific study ID is required.");
  }

  const parsed = parseProlificCompletionUrl(input.completionUrl);
  const payload = {
    survey_link_id: input.surveyLinkId,
    provider: SURVEY_LINK_INTEGRATION_PROVIDER_PROLIFIC,
    external_study_id: studyId,
    completion_url: parsed.completionUrl,
    provider_config_json: {},
    privacy_notice_version: EXTERNAL_RECRUITMENT_NOTICE_VERSION,
    is_active: true,
  };

  const { data, error } = await supabase
    .from("survey_link_integrations")
    .upsert(payload, {
      onConflict: "survey_link_id,provider",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save Prolific integration: ${error.message}`);
  }

  return toProlificIntegrationSummary(
    mapSurveyLinkIntegrationRow(data as SurveyLinkIntegrationRow),
  );
}

export async function deactivateOwnedProlificIntegration(surveyLinkId: string): Promise<void> {
  await assertOwnedSurveyLink(surveyLinkId);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("survey_link_integrations")
    .update({ is_active: false })
    .eq("survey_link_id", surveyLinkId)
    .eq("provider", SURVEY_LINK_INTEGRATION_PROVIDER_PROLIFIC);

  if (error) {
    throw new Error(`Failed to deactivate Prolific integration: ${error.message}`);
  }
}

export async function getActivePublicProlificIntegration(
  surveyLinkId: string,
): Promise<PersistedSurveyLinkIntegration | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("survey_link_integrations")
    .select("*")
    .eq("survey_link_id", surveyLinkId)
    .eq("provider", SURVEY_LINK_INTEGRATION_PROVIDER_PROLIFIC)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load active public Prolific integration: ${error.message}`);
  }

  return data ? mapSurveyLinkIntegrationRow(data as SurveyLinkIntegrationRow) : null;
}
