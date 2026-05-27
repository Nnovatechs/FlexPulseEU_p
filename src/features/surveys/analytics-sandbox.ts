import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserSession } from "@/lib/auth/session";
import { appRoutes } from "@/lib/config/routes";
import { buildSyntheticCohortDataset } from "./mapper-profiling/synthetic-cohorts";

const SANDBOX_SURVEY_NAME = "[Internal sandbox] Mapper profiling synthetic cohorts";

function parseAllowedEmails() {
  return (process.env.ANALYTICS_SANDBOX_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function assertAnalyticsSandboxAccess(session: UserSession) {
  const explicitlyEnabled = process.env.ANALYTICS_SANDBOX_ENABLED === "true";
  const explicitlyDisabled = process.env.ANALYTICS_SANDBOX_ENABLED === "false";
  const isLocalDevelopment = process.env.NODE_ENV !== "production";
  const enabled = explicitlyEnabled || (isLocalDevelopment && !explicitlyDisabled);

  if (!enabled) {
    throw new Error("Analytics sandbox seeding is disabled.");
  }

  const allowedEmails = parseAllowedEmails();
  if (allowedEmails.length > 0) {
    if (!allowedEmails.includes(session.email.toLowerCase())) {
      throw new Error("Current user is not allowed to seed the analytics sandbox.");
    }
    return;
  }

  if (!isLocalDevelopment) {
    throw new Error("ANALYTICS_SANDBOX_ALLOWED_EMAILS must be configured outside local development.");
  }
}

function toLinkToken(audienceToken: string) {
  return `sandbox-${audienceToken}-${randomUUID()}`;
}

export async function seedAnalyticsSandboxForSession(session: UserSession) {
  assertAnalyticsSandboxAccess(session);

  const supabase = createSupabaseAdminClient();
  const dataset = buildSyntheticCohortDataset();
  const survey = dataset.survey;
  const now = new Date().toISOString();
  const surveyId = randomUUID();

  const { data: existingSurveys, error: existingError } = await supabase
    .from("surveys")
    .select("id")
    .eq("created_by", session.user.id)
    .eq("name", SANDBOX_SURVEY_NAME);

  if (existingError) {
    throw new Error(`Failed to check existing analytics sandbox: ${existingError.message}`);
  }

  const existingIds = (existingSurveys ?? []).map((row) => row.id as string);
  if (existingIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("surveys")
      .delete()
      .in("id", existingIds);

    if (deleteError) {
      throw new Error(`Failed to reset existing analytics sandbox: ${deleteError.message}`);
    }
  }

  const { error: surveyError } = await supabase.from("surveys").insert({
    id: surveyId,
    name: SANDBOX_SURVEY_NAME,
    status: "published",
    created_by: session.user.id,
    created_at: now,
    updated_at: now,
    published_at: now,
    default_language: survey.default_language,
    supported_languages: survey.supported_languages,
    definition_json: survey.definition_json,
    mapping_contract_json: survey.mapping_contract_json,
    mapping_compiled_json: survey.mapping_compiled_json,
    mapping_hash: survey.mapping_hash,
    measurement_hash: survey.measurement_hash,
  });

  if (surveyError) {
    throw new Error(`Failed to create analytics sandbox survey: ${surveyError.message}`);
  }

  const audienceTokens = Array.from(new Set(dataset.personas.map((persona) => persona.audienceToken)));
  const linkRows = audienceTokens.map((audienceToken) => ({
    id: randomUUID(),
    survey_id: surveyId,
    link_token: toLinkToken(audienceToken),
    audience_label: audienceToken,
    audience_token: audienceToken,
    is_active: true,
    created_at: now,
  }));
  const linkIdByAudienceToken = new Map(
    linkRows.map((row) => [row.audience_token, row.id]),
  );

  const { error: linkError } = await supabase.from("survey_links").insert(linkRows);
  if (linkError) {
    throw new Error(`Failed to create analytics sandbox links: ${linkError.message}`);
  }

  const responseRows = dataset.personas.map((persona, index) => {
    const responseId = randomUUID();
    const respondedAt = new Date(Date.parse(now) + index * 60_000).toISOString();

    return {
      id: responseId,
      survey_id: surveyId,
      survey_link_id: linkIdByAudienceToken.get(persona.audienceToken),
      submitted_language: persona.submittedLanguage,
      responded_at: respondedAt,
      answers_json: persona.answers,
      pipeline_status: "ready",
      country_code_raw: persona.countryCode,
      postal_code_raw: null,
      raw_location_retention_until: null,
      mapping_hash_at_submission: survey.mapping_hash,
      measurement_hash_at_submission: survey.measurement_hash,
      created_at: respondedAt,
      updated_at: respondedAt,
      persona,
    };
  });

  const responseInsertRows = responseRows.map((row) => ({
    id: row.id,
    survey_id: row.survey_id,
    survey_link_id: row.survey_link_id,
    submitted_language: row.submitted_language,
    responded_at: row.responded_at,
    answers_json: row.answers_json,
    pipeline_status: row.pipeline_status,
    country_code_raw: row.country_code_raw,
    postal_code_raw: row.postal_code_raw,
    raw_location_retention_until: row.raw_location_retention_until,
    mapping_hash_at_submission: row.mapping_hash_at_submission,
    measurement_hash_at_submission: row.measurement_hash_at_submission,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const { error: responseError } = await supabase
    .from("survey_responses")
    .insert(responseInsertRows);

  if (responseError) {
    throw new Error(`Failed to create analytics sandbox responses: ${responseError.message}`);
  }

  const rowByPersonaId = new Map(dataset.rows.map((row) => [row.response_id, row]));
  const mappingRows = responseRows.map((responseRow) => {
    const syntheticRow = rowByPersonaId.get(`response_${responseRow.persona.id}`);
    if (!syntheticRow) {
      throw new Error(`Missing synthetic mapper output for ${responseRow.persona.id}.`);
    }

    return {
      response_id: responseRow.id,
      mapper_output_json: syntheticRow.mapper_output,
      mapping_hash_used: syntheticRow.mapper_output.mapping_metadata.mapping_hash,
      measurement_hash_used: syntheticRow.mapper_output.mapping_metadata.measurement_hash,
      mapper_version: syntheticRow.mapper_output.mapping_metadata.mapper_version,
      processed_at: responseRow.responded_at,
      created_at: responseRow.responded_at,
      updated_at: responseRow.responded_at,
    };
  });

  const { error: mappingError } = await supabase.from("response_mapping").insert(mappingRows);
  if (mappingError) {
    throw new Error(`Failed to create analytics sandbox mappings: ${mappingError.message}`);
  }

  const enrichmentRows = responseRows.map((responseRow) => {
    const syntheticRow = rowByPersonaId.get(`response_${responseRow.persona.id}`);
    if (!syntheticRow) {
      throw new Error(`Missing synthetic enrichment for ${responseRow.persona.id}.`);
    }

    const location = syntheticRow.mapper_output.context_metadata.location;
    const climate = syntheticRow.mapper_output.context_metadata.climate;

    return {
      response_id: responseRow.id,
      provider: climate?.provider ?? "synthetic",
      normalized_country_code: syntheticRow.mapper_output.context_metadata.country_code,
      location_agg_code: location?.agg_code ?? null,
      location_agg_label: location?.label ?? null,
      location_granularity: location?.granularity ?? null,
      temp_outdoor_c: climate?.temp_outdoor_c ?? null,
      humidity_pct: climate?.humidity_pct ?? null,
      observed_at: climate?.observed_at ?? null,
      quality_flag: climate?.quality_flag ?? "synthetic",
      payload_json: { source: "analytics_sandbox" },
      centroid_lat: location?.centroid_lat ?? null,
      centroid_lon: location?.centroid_lon ?? null,
      normalized_location_json: {
        provider: "analytics_sandbox",
        levels: syntheticRow.location_levels,
      },
      created_at: responseRow.responded_at,
      updated_at: responseRow.responded_at,
    };
  });

  const { error: enrichmentError } = await supabase
    .from("response_enrichment")
    .insert(enrichmentRows);

  if (enrichmentError) {
    throw new Error(`Failed to create analytics sandbox enrichment: ${enrichmentError.message}`);
  }

  return {
    surveyId,
    responseCount: responseRows.length,
    archetypeCount: dataset.archetypes.length,
    analyticsUrl: appRoutes.surveyAnalytics(surveyId),
  };
}
