import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserSession } from "@/lib/auth/session";
import { appRoutes } from "@/lib/config/routes";
import {
  assertAnalyticsSandboxAccess,
  canAccessAnalyticsSandbox,
} from "./analytics-sandbox";
import {
  DASHBOARD_QA_FIXTURE_KIND,
  DASHBOARD_QA_LINK_AUDIENCE_LABEL,
  DASHBOARD_QA_LINK_AUDIENCE_TOKEN,
  DASHBOARD_QA_SURVEY_NAME,
} from "./dashboard-qa/constants";
import { buildDashboardQaSyntheticDataset, deterministicDashboardQaUuid } from "./dashboard-qa/dashboard-qa-synthetic-dataset";
import { isDashboardQaSandboxSurvey } from "./dashboard-qa/survey-fixture";
import { RESPONSE_MAPPER_VERSION } from "./response-mapper";

export { canAccessAnalyticsSandbox, isDashboardQaSandboxSurvey };

export type DashboardQaSandboxSummary = {
  surveyId: string;
  analyticsUrl: string;
};

export async function findDashboardQaSandboxForOwner(
  ownerUserId: string,
): Promise<DashboardQaSandboxSummary | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("surveys")
    .select("id, name, definition_json")
    .eq("created_by", ownerUserId)
    .eq("name", DASHBOARD_QA_SURVEY_NAME);

  if (error) {
    throw new Error(`Failed to look up Dashboard QA sandbox: ${error.message}`);
  }

  const match = (data ?? []).find((row) => isDashboardQaSandboxSurvey(row));
  if (!match) {
    return null;
  }

  return {
    surveyId: match.id as string,
    analyticsUrl: appRoutes.surveyAnalyticsV2(match.id as string),
  };
}

function toPersistPayload(input: {
  ownerUserId: string;
  surveyId: string;
  linkId: string;
  linkToken: string;
}) {
  const createdAt = new Date().toISOString();
  const dataset = buildDashboardQaSyntheticDataset({
    surveyId: input.surveyId,
    ownerUserId: input.ownerUserId,
    createdAt,
  });
  const survey = dataset.survey;

  return {
    p_owner_user_id: input.ownerUserId,
    p_fixture_name: DASHBOARD_QA_SURVEY_NAME,
    p_fixture_kind: DASHBOARD_QA_FIXTURE_KIND,
    p_survey: {
      id: survey.id,
      created_at: survey.created_at,
      updated_at: survey.updated_at,
      published_at: survey.published_at,
      default_language: survey.default_language,
      supported_languages: survey.supported_languages,
      definition_json: survey.definition_json,
      mapping_contract_json: survey.mapping_contract_json,
      mapping_compiled_json: survey.mapping_compiled_json,
      mapping_hash: survey.mapping_hash,
      measurement_hash: survey.measurement_hash,
    },
    p_link: {
      id: input.linkId,
      link_token: input.linkToken,
      audience_label: DASHBOARD_QA_LINK_AUDIENCE_LABEL,
      audience_token: DASHBOARD_QA_LINK_AUDIENCE_TOKEN,
      created_at: createdAt,
    },
    p_responses: dataset.records.map((record, index) => {
      const respondedAt = new Date(Date.parse(createdAt) + index * 60_000).toISOString();
      return {
        id: record.id,
        submitted_language: record.submittedLanguage,
        responded_at: respondedAt,
        answers_json: record.answers,
        country_code_raw: record.countryCode.toLowerCase(),
        mapping_hash_at_submission: survey.mapping_hash,
        measurement_hash_at_submission: survey.measurement_hash,
        created_at: respondedAt,
        updated_at: respondedAt,
      };
    }),
    p_mappings: dataset.records.map((record, index) => {
      const processedAt = new Date(Date.parse(createdAt) + index * 60_000).toISOString();
      return {
        response_id: record.id,
        mapper_output_json: record.mapperOutput,
        mapping_hash_used: record.mapperOutput.mapping_metadata.mapping_hash,
        measurement_hash_used: record.mapperOutput.mapping_metadata.measurement_hash,
        mapper_version: record.mapperOutput.mapping_metadata.mapper_version ?? RESPONSE_MAPPER_VERSION,
        processed_at: processedAt,
        created_at: processedAt,
        updated_at: processedAt,
      };
    }),
    p_enrichments: dataset.records.map((record, index) => {
      const created = new Date(Date.parse(createdAt) + index * 60_000).toISOString();
      return {
        response_id: record.id,
        provider: record.enrichment.provider ?? "dashboard_qa_sandbox",
        normalized_country_code: record.enrichment.normalized_country_code,
        location_agg_code: record.enrichment.location_agg_code,
        location_agg_label: record.enrichment.location_agg_label,
        location_granularity: record.enrichment.location_granularity,
        temp_outdoor_c: record.enrichment.temp_outdoor_c,
        humidity_pct: record.enrichment.humidity_pct,
        observed_at: record.enrichment.observed_at,
        quality_flag: record.enrichment.quality_flag,
        payload_json: { source: "dashboard_qa_sandbox" },
        centroid_lat: record.enrichment.centroid_lat,
        centroid_lon: record.enrichment.centroid_lon,
        normalized_location_json: record.enrichment.normalized_location_json,
        created_at: created,
        updated_at: created,
      };
    }),
  };
}

async function upsertDashboardQaSandboxForSession(session: UserSession) {
  assertAnalyticsSandboxAccess(session);

  const existing = await findDashboardQaSandboxForOwner(session.user.id);
  const surveyId = existing?.surveyId ?? deterministicDashboardQaUuid(`dashboard-qa-v2:survey:${session.user.id}`);
  const linkId = deterministicDashboardQaUuid(`dashboard-qa-v2:link:${session.user.id}`);
  const linkToken = `dqa-${surveyId.replaceAll("-", "").slice(0, 24)}`;
  const payload = toPersistPayload({
    ownerUserId: session.user.id,
    surveyId,
    linkId,
    linkToken,
  });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("upsert_dashboard_qa_sandbox_dataset", payload);

  if (error) {
    throw new Error(`Failed to persist Dashboard QA sandbox: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const persistedSurveyId = row?.survey_id as string | undefined;
  if (!persistedSurveyId) {
    throw new Error("Dashboard QA sandbox did not return a survey id.");
  }

  return {
    surveyId: persistedSurveyId,
    responseCount: Number(row.response_count ?? 0),
    created: Boolean(row.created),
    analyticsUrl: appRoutes.surveyAnalyticsV2(persistedSurveyId),
  };
}

export async function createDashboardQaSandboxForSession(session: UserSession) {
  return upsertDashboardQaSandboxForSession(session);
}

export async function resetDashboardQaSandboxForSession(session: UserSession) {
  assertAnalyticsSandboxAccess(session);
  const existing = await findDashboardQaSandboxForOwner(session.user.id);
  if (!existing) {
    throw new Error("Dashboard QA sandbox does not exist.");
  }
  return upsertDashboardQaSandboxForSession(session);
}
