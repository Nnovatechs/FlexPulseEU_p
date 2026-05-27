import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PersistedSurvey, PersistedSurveyLink } from "./generator-types";

type PublicSurveyRow = PersistedSurvey;
type PublicSurveyLinkRow = PersistedSurveyLink;

function mapPublicSurveyRow(row: PublicSurveyRow): PersistedSurvey {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
    default_language: row.default_language,
    supported_languages: row.supported_languages,
    definition_json: row.definition_json,
    mapping_contract_json: row.mapping_contract_json,
    mapping_compiled_json: row.mapping_compiled_json,
    mapping_hash: row.mapping_hash,
    measurement_hash: row.measurement_hash ?? null,
  };
}

function mapPublicSurveyLinkRow(row: PublicSurveyLinkRow): PersistedSurveyLink {
  return {
    id: row.id,
    survey_id: row.survey_id,
    link_token: row.link_token,
    audience_label: row.audience_label,
    audience_token: row.audience_token,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

export async function getPublicSurveyLinkByToken(
  linkToken: string,
): Promise<PersistedSurveyLink | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("survey_links")
    .select("*")
    .eq("link_token", linkToken)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load public survey link: ${error.message}`);
  }

  return data ? mapPublicSurveyLinkRow(data as PublicSurveyLinkRow) : null;
}

export async function getPublishedSurveyByIdPublic(
  surveyId: string,
): Promise<PersistedSurvey | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", surveyId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load published survey: ${error.message}`);
  }

  return data ? mapPublicSurveyRow(data as PublicSurveyRow) : null;
}
