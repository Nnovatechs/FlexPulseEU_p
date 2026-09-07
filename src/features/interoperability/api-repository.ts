import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getSurveyAnalyticsSchemaForOwner,
  runSurveyAnalyticsForOwner,
} from "@/features/surveys/use-cases";
import type { PersistedSurvey } from "@/features/surveys/generator-types";
import type { SurveyAnalyticsQueryInput } from "@/features/surveys/survey-analytics";
import { buildTimestampIdCursorFilter, decodeCursor, encodeCursor } from "./api-pagination";
import { invalidRequest, notFound } from "./api-errors";
import type {
  InteroperabilityProfileItem,
  InteroperabilityResponseItem,
  InteroperabilitySurveyDetail,
  InteroperabilitySurveyListItem,
  ProfileDataCursor,
  SurveyDataCursor,
  SurveyListCursor,
} from "./api-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isUuidString(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function assertSurveyId(surveyId: string) {
  if (!isUuidString(surveyId)) {
    throw invalidRequest("The surveyId parameter must be a valid UUID.");
  }
}

type SurveyRow = Pick<
  PersistedSurvey,
  | "id"
  | "name"
  | "status"
  | "default_language"
  | "supported_languages"
  | "created_at"
  | "updated_at"
  | "published_at"
  | "measurement_hash"
  | "mapping_hash"
  | "definition_json"
  | "mapping_contract_json"
> & {
  created_by: string;
};

type SurveyListRow = Pick<
  PersistedSurvey,
  | "id"
  | "name"
  | "status"
  | "default_language"
  | "supported_languages"
  | "created_at"
  | "updated_at"
  | "published_at"
  | "measurement_hash"
  | "mapping_hash"
>;

type ResponseRow = {
  id: string;
  survey_id: string;
  responded_at: string;
  submitted_language: string;
  pipeline_status: string;
  answers_json: Record<string, unknown>;
  measurement_hash_at_submission: string | null;
  mapping_hash_at_submission: string | null;
};

type ProfileMappingRow = {
  response_id: string;
  mapper_output_json: InteroperabilityProfileItem["mapper_output"];
  mapper_version: string;
  processed_at: string;
  measurement_hash_used: string | null;
  mapping_hash_used: string | null;
};

function isSurveyListCursor(value: unknown): value is SurveyListCursor {
  return (
    typeof value === "object" &&
    value != null &&
    isIsoDateString((value as { createdAt?: unknown }).createdAt) &&
    isUuidString((value as { id?: unknown }).id)
  );
}

function isSurveyDataCursor(value: unknown): value is SurveyDataCursor {
  return (
    typeof value === "object" &&
    value != null &&
    isIsoDateString((value as { respondedAt?: unknown }).respondedAt) &&
    isUuidString((value as { responseId?: unknown }).responseId)
  );
}

function isProfileDataCursor(value: unknown): value is ProfileDataCursor {
  return (
    typeof value === "object" &&
    value != null &&
    isIsoDateString((value as { processedAt?: unknown }).processedAt) &&
    isUuidString((value as { responseId?: unknown }).responseId)
  );
}

function extractSurveyResponseReference(
  value: { id: string; survey_id: string } | Array<{ id: string; survey_id: string }>,
) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapSurveyListItem(row: SurveyListRow, responseCount: number): InteroperabilitySurveyListItem {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    default_language: row.default_language,
    supported_languages: row.supported_languages,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
    measurement_hash: row.measurement_hash ?? null,
    mapping_hash: row.mapping_hash ?? null,
    response_count: responseCount,
  };
}

function mapSurveyDetail(row: SurveyRow, responseCount: number): InteroperabilitySurveyDetail {
  const measurementPlan = row.definition_json.survey_meta.measurement_plan_json ?? null;
  return {
    ...mapSurveyListItem(row, responseCount),
    definition_json: row.definition_json,
    measurement_plan_json: measurementPlan,
    mapping_contract_json: row.mapping_contract_json,
    schema_namespace: measurementPlan?.schema_namespace ?? null,
    schema_version: measurementPlan?.schema_version ?? null,
  };
}

function mapResponseItem(row: ResponseRow): InteroperabilityResponseItem {
  return {
    response_id: row.id,
    survey_id: row.survey_id,
    responded_at: row.responded_at,
    submitted_language: row.submitted_language,
    pipeline_status: row.pipeline_status,
    answers: row.answers_json,
    measurement_hash_at_submission: row.measurement_hash_at_submission,
    mapping_hash_at_submission: row.mapping_hash_at_submission,
  };
}

async function countResponsesForSurveyIds(surveyIds: string[]) {
  if (surveyIds.length === 0) {
    return new Map<string, number>();
  }
  const supabase = createSupabaseAdminClient();
  const entries = await Promise.all(
    surveyIds.map(async (surveyId) => {
      const { count, error } = await supabase
        .from("survey_responses")
        .select("id", { head: true, count: "exact" })
        .eq("survey_id", surveyId);
      if (error) {
        throw new Error(`Failed to count survey responses: ${error.message}`);
      }
      return [surveyId, count ?? 0] as const;
    }),
  );
  return new Map(entries);
}

async function countResponsesForSurvey(surveyId: string) {
  const counts = await countResponsesForSurveyIds([surveyId]);
  return counts.get(surveyId) ?? 0;
}

export async function listOwnedSurveysForApi(input: {
  ownerUserId: string;
  limit: number;
  cursor: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const cursor = decodeCursor(input.cursor, isSurveyListCursor);
  let query = supabase
    .from("surveys")
    .select(
      "id, name, status, created_at, updated_at, published_at, default_language, supported_languages, mapping_hash, measurement_hash",
    )
    .eq("created_by", input.ownerUserId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(input.limit + 1);

  if (cursor) {
    query = query.or(
      buildTimestampIdCursorFilter({
        timestampColumn: "created_at",
        timestamp: cursor.createdAt,
        idColumn: "id",
        id: cursor.id,
      }),
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list surveys: ${error.message}`);
  }

  const rows = (data ?? []) as SurveyListRow[];
  const pageRows = rows.slice(0, input.limit);
  const counts = await countResponsesForSurveyIds(pageRows.map((row) => row.id));
  const items = pageRows.map((row) => mapSurveyListItem(row, counts.get(row.id) ?? 0));

  return {
    items,
    hasMore: rows.length > input.limit,
    nextCursor:
      rows.length > input.limit
        ? encodeCursor<SurveyListCursor>({
            createdAt: pageRows[pageRows.length - 1].created_at,
            id: pageRows[pageRows.length - 1].id,
          })
        : null,
  };
}

export async function getOwnedSurveyDetailForApi(ownerUserId: string, surveyId: string) {
  assertSurveyId(surveyId);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("surveys")
    .select(
      "id, name, status, created_by, created_at, updated_at, published_at, default_language, supported_languages, definition_json, mapping_contract_json, mapping_hash, measurement_hash",
    )
    .eq("id", surveyId)
    .eq("created_by", ownerUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load survey: ${error.message}`);
  }
  if (!data) {
    throw notFound();
  }

  return mapSurveyDetail(data as SurveyRow, await countResponsesForSurvey(surveyId));
}

async function assertOwnedSurvey(ownerUserId: string, surveyId: string) {
  assertSurveyId(surveyId);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("surveys")
    .select("id")
    .eq("id", surveyId)
    .eq("created_by", ownerUserId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load survey: ${error.message}`);
  }
  if (!data) {
    throw notFound();
  }
}

export async function getOwnedSurveySchemaForApi(ownerUserId: string, surveyId: string) {
  await assertOwnedSurvey(ownerUserId, surveyId);
  return getSurveyAnalyticsSchemaForOwner(surveyId, ownerUserId);
}

export async function runOwnedSurveyAnalyticsQueryForApi(
  ownerUserId: string,
  surveyId: string,
  query: SurveyAnalyticsQueryInput,
) {
  await assertOwnedSurvey(ownerUserId, surveyId);
  return runSurveyAnalyticsForOwner(surveyId, ownerUserId, query);
}

export async function listOwnedSurveyResponsesForApi(input: {
  ownerUserId: string;
  surveyId: string;
  limit: number;
  cursor: string | null;
}) {
  await assertOwnedSurvey(input.ownerUserId, input.surveyId);
  const supabase = createSupabaseAdminClient();
  const cursor = decodeCursor(input.cursor, isSurveyDataCursor);
  let query = supabase
    .from("survey_responses")
    .select(
      "id, survey_id, responded_at, submitted_language, pipeline_status, answers_json, measurement_hash_at_submission, mapping_hash_at_submission",
    )
    .eq("survey_id", input.surveyId)
    .order("responded_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(input.limit + 1);

  if (cursor) {
    query = query.or(
      buildTimestampIdCursorFilter({
        timestampColumn: "responded_at",
        timestamp: cursor.respondedAt,
        idColumn: "id",
        id: cursor.responseId,
      }),
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load responses: ${error.message}`);
  }

  const rows = (data ?? []) as ResponseRow[];
  const pageRows = rows.slice(0, input.limit);
  return {
    items: pageRows.map(mapResponseItem),
    hasMore: rows.length > input.limit,
    nextCursor:
      rows.length > input.limit
        ? encodeCursor<SurveyDataCursor>({
            respondedAt: pageRows[pageRows.length - 1].responded_at,
            responseId: pageRows[pageRows.length - 1].id,
          })
        : null,
  };
}

export async function listOwnedSurveyProfilesForApi(input: {
  ownerUserId: string;
  surveyId: string;
  limit: number;
  cursor: string | null;
}) {
  await assertOwnedSurvey(input.ownerUserId, input.surveyId);
  const supabase = createSupabaseAdminClient();
  const cursor = decodeCursor(input.cursor, isProfileDataCursor);
  let query = supabase
    .from("response_mapping")
    .select(
      "response_id, mapper_output_json, mapper_version, processed_at, measurement_hash_used, mapping_hash_used, survey_responses!inner(id, survey_id)",
    )
    .eq("survey_responses.survey_id", input.surveyId)
    .order("processed_at", { ascending: false })
    .order("response_id", { ascending: false })
    .limit(input.limit + 1);

  if (cursor) {
    query = query.or(
      buildTimestampIdCursorFilter({
        timestampColumn: "processed_at",
        timestamp: cursor.processedAt,
        idColumn: "response_id",
        id: cursor.responseId,
      }),
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load profiles: ${error.message}`);
  }

  const rows = ((data ?? []) as unknown as Array<
    ProfileMappingRow & {
      survey_responses: { id: string; survey_id: string } | Array<{ id: string; survey_id: string }>;
    }
  >).slice(0, input.limit);
  const items = rows.map((row) => ({
    response_id: row.response_id,
    survey_id: extractSurveyResponseReference(row.survey_responses)?.survey_id ?? input.surveyId,
    mapper_output: row.mapper_output_json,
    mapper_version: row.mapper_version,
    processed_at: row.processed_at,
    measurement_hash_used: row.measurement_hash_used,
    mapping_hash_used: row.mapping_hash_used,
  }));

  return {
    items,
    hasMore: (data ?? []).length > input.limit,
    nextCursor:
      (data ?? []).length > input.limit
        ? encodeCursor<ProfileDataCursor>({
            processedAt: rows[rows.length - 1].processed_at,
            responseId: rows[rows.length - 1].response_id,
          })
        : null,
  };
}

export function assertAnalyticsQueryLimits(query: SurveyAnalyticsQueryInput) {
  if ((query.filters?.length ?? 0) > 16) {
    throw invalidRequest("Analytics queries support at most 16 filters.");
  }
  if ((query.group_by?.length ?? 0) > 2) {
    throw invalidRequest("Analytics queries support at most 2 group_by fields.");
  }
  if (query.metrics.length > 12) {
    throw invalidRequest("Analytics queries support at most 12 metrics.");
  }
}
