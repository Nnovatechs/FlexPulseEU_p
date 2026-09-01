import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOwnedSurveyById } from "./generator-repository";
import type { PersistedSurvey } from "./generator-types";
import type { MapperOutput } from "./generator-types";
import type { NormalizedLocationLevel } from "./response-enrichment";
import { readExactCount, selectAllPages, selectByIds } from "./supabase-batch";
import type { SurveyAnalyticsRecord } from "./survey-analytics";

type SurveyResponseRow = {
  id: string;
  responded_at: string;
  survey_link_id: string | null;
};

type ResponseMappingRow = {
  response_id: string;
  mapper_output_json: MapperOutput;
};

type ResponseEnrichmentRow = {
  response_id: string;
  normalized_location_json: unknown;
};

type SurveyLinkLiteRow = {
  id: string;
  audience_token: string;
  audience_label: string;
};

export type OwnedSurveyAnalyticsRuntime = {
  survey: PersistedSurvey;
  rows: SurveyAnalyticsRecord[];
  excludedUnmappedCount: number;
  readyPipelineCount: number;
  collectedResponseCount: number;
  collectedResponseWindow: {
    firstRespondedAt: string | null;
    lastRespondedAt: string | null;
  };
};

function isNormalizedLocationLevel(value: unknown): value is NormalizedLocationLevel {
  return (
    typeof value === "object" &&
    value != null &&
    typeof (value as { kind?: unknown }).kind === "string" &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { label?: unknown }).label === "string"
  );
}

function parseLocationLevels(
  normalizedLocationJson: unknown,
  mapperOutput: MapperOutput,
): NormalizedLocationLevel[] {
  const levelsRaw =
    typeof normalizedLocationJson === "object" && normalizedLocationJson != null
      ? (normalizedLocationJson as { levels?: unknown }).levels
      : null;

  const levels = Array.isArray(levelsRaw)
    ? levelsRaw.filter(isNormalizedLocationLevel)
    : [];

  if (levels.length > 0) {
    return levels;
  }

  const fallbackLevels: NormalizedLocationLevel[] = [];
  const countryCode = mapperOutput.context_metadata.country_code;
  const bestLocation = mapperOutput.context_metadata.location;

  if (countryCode) {
    fallbackLevels.push({
      kind: "country",
      code: countryCode,
      label: countryCode,
      providerId: null,
      centroidLat: bestLocation?.centroid_lat ?? null,
      centroidLon: bestLocation?.centroid_lon ?? null,
    });
  }

  if (
    bestLocation?.agg_code &&
    bestLocation.label &&
    typeof bestLocation.granularity === "string"
  ) {
    const granularity = bestLocation.granularity as NormalizedLocationLevel["kind"];
    fallbackLevels.push({
      kind: granularity,
      code: bestLocation.agg_code,
      label: bestLocation.label,
      providerId: null,
      centroidLat: bestLocation.centroid_lat ?? null,
      centroidLon: bestLocation.centroid_lon ?? null,
    });
  }

  return fallbackLevels;
}

function buildAnalyticsRecords(input: {
  responseRows: SurveyResponseRow[];
  mappingsByResponseId: Map<string, MapperOutput>;
  enrichmentsByResponseId: Map<string, unknown>;
  linksById: Map<string, SurveyLinkLiteRow>;
}) {
  const rows: SurveyAnalyticsRecord[] = [];

  for (const row of input.responseRows) {
    const mapperOutput = input.mappingsByResponseId.get(row.id);
    if (!mapperOutput) {
      continue;
    }

    const link = row.survey_link_id ? input.linksById.get(row.survey_link_id) ?? null : null;
    rows.push({
      response_id: row.id,
      responded_at: row.responded_at,
      audience_token: link?.audience_token ?? null,
      audience_label: link?.audience_label ?? null,
      mapper_output: mapperOutput,
      location_levels: parseLocationLevels(
        input.enrichmentsByResponseId.get(row.id) ?? null,
        mapperOutput,
      ),
    });
  }

  return rows;
}

async function loadSurveyAnalyticsRuntimeForSurvey(
  survey: PersistedSurvey,
  supabase:
    | Awaited<ReturnType<typeof createSupabaseServerClient>>
    | ReturnType<typeof createSupabaseAdminClient>,
): Promise<OwnedSurveyAnalyticsRuntime> {
  const [
    { count: readyPipelineCount, error: readyCountError },
    { count: collectedResponseCount, error: collectedCountError },
    { data: firstCollectedRaw, error: firstCollectedError },
    { data: lastCollectedRaw, error: lastCollectedError },
  ] = await Promise.all([
    supabase
      .from("survey_responses")
      .select("id", { count: "exact" })
      .eq("survey_id", survey.id)
      .eq("pipeline_status", "ready")
      .limit(1),
    supabase
      .from("survey_responses")
      .select("id", { count: "exact" })
      .eq("survey_id", survey.id)
      .limit(1),
    supabase
      .from("survey_responses")
      .select("responded_at")
      .eq("survey_id", survey.id)
      .order("responded_at", { ascending: true })
      .limit(1),
    supabase
      .from("survey_responses")
      .select("responded_at")
      .eq("survey_id", survey.id)
      .order("responded_at", { ascending: false })
      .limit(1),
  ]);

  const totalReadyCount = readExactCount(
    readyPipelineCount,
    readyCountError,
    "Failed to count survey analytics responses",
  );
  const totalCollectedCount = readExactCount(
    collectedResponseCount,
    collectedCountError,
    "Failed to count collected survey responses",
  );

  if (firstCollectedError) {
    throw new Error(`Failed to load first collected response timestamp: ${firstCollectedError.message}`);
  }

  if (lastCollectedError) {
    throw new Error(`Failed to load last collected response timestamp: ${lastCollectedError.message}`);
  }
  const collectedResponseWindow = {
    firstRespondedAt: firstCollectedRaw?.[0]?.responded_at ?? null,
    lastRespondedAt: lastCollectedRaw?.[0]?.responded_at ?? null,
  };

  if (totalReadyCount === 0) {
    return {
      survey,
      rows: [],
      excludedUnmappedCount: 0,
      readyPipelineCount: 0,
      collectedResponseCount: totalCollectedCount,
      collectedResponseWindow,
    };
  }

  const responseRows = await selectAllPages(async (from, to) => {
    const { data, error } = await supabase
      .from("survey_responses")
      .select("id, responded_at, survey_link_id")
      .eq("survey_id", survey.id)
      .eq("pipeline_status", "ready")
      .order("responded_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load survey analytics responses: ${error.message}`);
    }

    return (data ?? []) as SurveyResponseRow[];
  });

  if (responseRows.length === 0) {
    return {
      survey,
      rows: [],
      excludedUnmappedCount: 0,
      readyPipelineCount: totalReadyCount,
      collectedResponseCount: totalCollectedCount,
      collectedResponseWindow,
    };
  }

  const responseIds = responseRows.map((row) => row.id);
  const linkIds = Array.from(
    new Set(
      responseRows
        .map((row) => row.survey_link_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [mappings, enrichments, links] = await Promise.all([
    selectByIds(responseIds, async (chunk) => {
      const { data, error } = await supabase
        .from("response_mapping")
        .select("response_id, mapper_output_json")
        .in("response_id", chunk);

      if (error) {
        throw new Error(`Failed to load mapped responses: ${error.message}`);
      }

      return (data ?? []) as ResponseMappingRow[];
    }),
    selectByIds(responseIds, async (chunk) => {
      const { data, error } = await supabase
        .from("response_enrichment")
        .select("response_id, normalized_location_json")
        .in("response_id", chunk);

      if (error) {
        throw new Error(`Failed to load enrichment records: ${error.message}`);
      }

      return (data ?? []) as ResponseEnrichmentRow[];
    }),
    selectByIds(linkIds, async (chunk) => {
      const { data, error } = await supabase
        .from("survey_links")
        .select("id, audience_token, audience_label")
        .in("id", chunk);

      if (error) {
        throw new Error(`Failed to load survey link metadata: ${error.message}`);
      }

      return (data ?? []) as SurveyLinkLiteRow[];
    }),
  ]);

  const mappingsByResponseId = new Map(mappings.map((row) => [row.response_id, row.mapper_output_json]));
  const enrichmentsByResponseId = new Map(
    enrichments.map((row) => [row.response_id, row.normalized_location_json]),
  );
  const linksById = new Map(links.map((row) => [row.id, row]));

  const rows = buildAnalyticsRecords({
    responseRows,
    mappingsByResponseId,
    enrichmentsByResponseId,
    linksById,
  });

  return {
    survey,
    rows,
    excludedUnmappedCount: responseRows.length - rows.length,
    readyPipelineCount: totalReadyCount,
    collectedResponseCount: totalCollectedCount,
    collectedResponseWindow,
  };
}

export async function loadOwnedSurveyAnalyticsRuntime(
  surveyId: string,
): Promise<OwnedSurveyAnalyticsRuntime> {
  const survey = await getOwnedSurveyById(surveyId);
  const supabase = await createSupabaseServerClient();

  return loadSurveyAnalyticsRuntimeForSurvey(survey, supabase);
}

export async function loadOwnedSurveyAnalyticsRuntimeSnapshot(
  surveyId: string,
  ownerId: string,
): Promise<OwnedSurveyAnalyticsRuntime> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", surveyId)
    .eq("created_by", ownerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load survey: ${error.message}`);
  }

  if (!data) {
    throw new Error("Survey not found.");
  }

  return loadSurveyAnalyticsRuntimeForSurvey(data as PersistedSurvey, supabase);
}
