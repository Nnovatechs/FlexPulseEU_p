import { cache } from "react";
import { appRoutes } from "@/lib/config/routes";
import { requireCurrentSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnedDefaultSurveyLink,
  getOwnedSurveyById,
  listOwnedSurveyLinksForSurveyIds,
  listOwnedSurveys,
} from "./generator-repository";
import { PersistedSurvey, PersistedSurveyLink, SurveyQuestionDefinition } from "./generator-types";
import {
  buildSurveyAnalyticsSchema,
  runSurveyAnalyticsQuery,
  type SurveyAnalyticsQueryInput,
} from "./survey-analytics";
import { buildSurveyOverviewData } from "./analytics/overview-v2";
import { buildInstrumentHealthData } from "./analytics/instrument-health";
import { buildPostalMapAnalysis } from "./analytics/geography/postal-map-analysis";
import { buildPostalMapComparison } from "./analytics/geography/postal-map-comparison";
import type { PostalMapAnalysis } from "./analytics/geography/postal-map-types";
import {
  buildSegmentAnalysis,
  buildSegmentCatalog,
  buildSegmentComparison,
  previewSegmentSample,
  validateSegmentDefinition,
  type SegmentDefinition,
} from "./analytics/segments";
import { loadOwnedInstrumentHealthSource } from "./instrument-health-repository";
import { loadOwnedSurveyAnalyticsRuntimeSnapshot } from "./survey-analytics-repository";
import {
  formatPostgrestError,
  isCancelledPostgrestError,
  readExactCount,
  selectAllPages,
} from "./supabase-batch";
import {
  getPublicSurveyLinkByToken,
  getPublishedSurveyByIdPublic,
} from "./public-survey-load";
import { Survey } from "./types";

function formatQuestionType(value: string) {
  const labels: Record<string, string> = {
    single_choice: "Single choice",
    multiple_choice: "Multiple choice",
    rating_scale: "Rating scale",
    free_text: "Free text",
    numeric: "Numeric",
    boolean: "Boolean",
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

function buildScaleSummary(
  scale: NonNullable<SurveyQuestionDefinition["scale"]>,
) {
  return `Scale ${scale.min}${scale.min_label ? ` (${scale.min_label})` : ""} → ${scale.max}${scale.max_label ? ` (${scale.max_label})` : ""}`;
}

function buildNumericSummary(
  numeric: NonNullable<SurveyQuestionDefinition["numeric"]>,
) {
  const parts = ["Numeric"];
  if (numeric.unit) {
    parts.push(numeric.unit);
  }
  if (numeric.min != null && numeric.max != null) {
    parts.push(`${numeric.min}–${numeric.max}`);
  }
  return parts.join(" · ");
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function summarizeLocationContext(survey: PersistedSurvey) {
  const responseContext = survey.definition_json.survey_meta.response_context;

  if (!responseContext?.collect_country_code && !responseContext?.collect_postal_code) {
    return "Not collected";
  }

  if (responseContext.collect_country_code && responseContext.collect_postal_code) {
    return responseContext.postal_collection_mode === "prefix"
      ? "Country code and postal prefix"
      : "Country code and postal code";
  }

  if (responseContext.collect_country_code) {
    return "Country code only";
  }

  return "Postal code only";
}

function summarizeEnrichment(survey: PersistedSurvey) {
  const responseContext = survey.definition_json.survey_meta.response_context;
  return responseContext?.enrich_weather_context
    ? "Weather enrichment enabled"
    : "No enrichment";
}

function buildSurveyProjection(
  survey: PersistedSurvey,
  defaultPublicLinkUrl: string | null,
  responsesCount = 0,
): Survey {
  const defaultTranslations =
    survey.definition_json.translations[survey.default_language];

  const questions = survey.definition_json.questions
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((question) => {
      const translations = defaultTranslations?.questions[question.question_key];

      return {
        id: question.question_key,
        key: question.question_key,
        title: translations?.title?.trim() || question.question_key,
        type: formatQuestionType(question.type),
        typeKey: question.type,
        required: question.required,
        optionLabels: question.options?.map(
          (option) => translations?.options?.[option.option_key] ?? option.option_key,
        ),
        scaleSummary: question.scale ? buildScaleSummary(question.scale) : undefined,
        numericSummary: question.numeric ? buildNumericSummary(question.numeric) : undefined,
      };
    });

  return {
    id: survey.id,
    title: defaultTranslations?.survey_title?.trim() || survey.name,
    internalName: survey.name,
    defaultLanguage: survey.default_language,
    supportedLanguages: survey.supported_languages,
    locationContextSummary: summarizeLocationContext(survey),
    enrichmentSummary: summarizeEnrichment(survey),
    status: toTitleCase(survey.status) as Survey["status"],
    createdAt: survey.created_at,
    updatedAt: survey.updated_at,
    publishedAt: survey.published_at,
    responsesCount,
    questionCount: questions.length,
    mappingCount: survey.mapping_contract_json.mappings.length,
    defaultPublicLinkUrl,
    questions,
  };
}

async function mapOwnedPersistedSurvey(
  survey: PersistedSurvey,
  responsesCount = 0,
  defaultLink: PersistedSurveyLink | null = null,
): Promise<Survey> {
  return buildSurveyProjection(
    survey,
    defaultLink ? appRoutes.publicSurveyLink(defaultLink.link_token) : null,
    responsesCount,
  );
}

async function loadOwnedDefaultSurveyLinksBySurveyId(surveys: PersistedSurvey[]) {
  const publishedSurveyIds = surveys
    .filter((survey) => survey.status === "published")
    .map((survey) => survey.id);

  const links = await listOwnedSurveyLinksForSurveyIds(publishedSurveyIds);
  const linksBySurveyId = new Map<string, PersistedSurveyLink>();

  for (const link of links) {
    const existing = linksBySurveyId.get(link.survey_id);
    if (!existing || link.audience_token === "default") {
      linksBySurveyId.set(link.survey_id, link);
    }
  }

  return linksBySurveyId;
}

async function mapOwnedPersistedSurveys(
  surveys: PersistedSurvey[],
  responseCounts: Map<string, number>,
): Promise<Survey[]> {
  const linksBySurveyId = await loadOwnedDefaultSurveyLinksBySurveyId(surveys);

  return Promise.all(
    surveys.map((survey) =>
      mapOwnedPersistedSurvey(
        survey,
        responseCounts.get(survey.id) ?? 0,
        linksBySurveyId.get(survey.id) ?? null,
      ),
    ),
  );
}

function buildDashboardMetrics(
  surveys: PersistedSurvey[],
  questionsAnswered: number,
) {
  const published = surveys.filter((survey) => survey.status === "published");

  return {
    totalSurveys: surveys.length,
    publishedSurveys: published.length,
    totalQuestions: surveys.reduce(
      (accumulator, survey) => accumulator + survey.definition_json.questions.length,
      0,
    ),
    questionsAnswered,
  };
}

async function countOwnedSurveyResponsesWithClient(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  surveyId: string,
) {
  const { count, error } = await supabase
    .from("survey_responses")
    .select("id", { count: "exact" })
    .eq("survey_id", surveyId)
    .limit(1);

  return readExactCount(count, error, "Failed to count survey responses");
}

async function loadOwnedSurveyResponseCounts(surveyIds: string[]) {
  const counts = new Map<string, number>();
  if (surveyIds.length === 0) {
    return counts;
  }

  const supabase = await createSupabaseServerClient();

  await Promise.all(
    surveyIds.map(async (surveyId) => {
      counts.set(surveyId, await countOwnedSurveyResponsesWithClient(supabase, surveyId));
    }),
  );

  return counts;
}

async function countOwnedSurveyResponses(surveyId: string) {
  const supabase = await createSupabaseServerClient();
  return countOwnedSurveyResponsesWithClient(supabase, surveyId);
}

async function loadOwnedResponseMetricRows() {
  const supabase = await createSupabaseServerClient();

  return selectAllPages(async (from, to) => {
    const { data, error } = await supabase
      .from("survey_responses")
      .select("id, survey_id, answers_json")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      if (isCancelledPostgrestError(error)) {
        const abortError = new Error("The operation was aborted.");
        abortError.name = "AbortError";
        throw abortError;
      }

      throw new Error(
        `Failed to load dashboard response metrics: ${formatPostgrestError(error) || "unknown error"}`,
      );
    }

    return data ?? [];
  });
}

async function loadOwnedDashboardResponseStats(surveyIds: string[]) {
  const counts = new Map<string, number>(surveyIds.map((id) => [id, 0]));
  const surveyIdSet = new Set(surveyIds);
  const rows = await loadOwnedResponseMetricRows();

  let questionsAnswered = 0;
  for (const row of rows) {
    questionsAnswered += countAnsweredQuestions(row.answers_json);
    if (surveyIdSet.has(row.survey_id)) {
      counts.set(row.survey_id, (counts.get(row.survey_id) ?? 0) + 1);
    }
  }

  return { counts, questionsAnswered };
}

export async function getSurveys(): Promise<Survey[]> {
  const allSurveys = await listOwnedSurveys();
  const surveys = allSurveys.filter((survey) => survey.status !== "archived");
  const responseCounts = await loadOwnedSurveyResponseCounts(surveys.map((survey) => survey.id));

  return mapOwnedPersistedSurveys(surveys, responseCounts);
}

export async function getDashboardData() {
  const allSurveys = await listOwnedSurveys();
  const surveys = allSurveys.filter((survey) => survey.status !== "archived");
  const { counts: responseCounts, questionsAnswered } = await loadOwnedDashboardResponseStats(
    surveys.map((survey) => survey.id),
  );

  return {
    metrics: buildDashboardMetrics(surveys, questionsAnswered),
    surveys: await mapOwnedPersistedSurveys(surveys, responseCounts),
  };
}

export async function getSurveyById(surveyId: string): Promise<Survey | null> {
  try {
    const [survey, responsesCount] = await Promise.all([
      getOwnedSurveyById(surveyId),
      countOwnedSurveyResponses(surveyId),
    ]);

    const defaultLink =
      survey.status === "published"
        ? await getOwnedDefaultSurveyLink(survey.id)
        : null;

    return mapOwnedPersistedSurvey(survey, responsesCount, defaultLink);
  } catch {
    return null;
  }
}

export async function getPublicSurveyByLinkToken(
  linkToken: string,
): Promise<Survey | null> {
  try {
    const link = await getPublicSurveyLinkByToken(linkToken);
    if (!link) {
      return null;
    }

    const survey = await getPublishedSurveyByIdPublic(link.survey_id);
    if (!survey) {
      return null;
    }

    return buildSurveyProjection(
      survey,
      appRoutes.publicSurveyLink(link.link_token),
    );
  } catch {
    return null;
  }
}

export async function getPublicSurveyRuntimeByLinkToken(
  linkToken: string,
): Promise<{ survey: PersistedSurvey; link: PersistedSurveyLink } | null> {
  try {
    const link = await getPublicSurveyLinkByToken(linkToken);
    if (!link) {
      return null;
    }

    const survey = await getPublishedSurveyByIdPublic(link.survey_id);
    if (!survey) {
      return null;
    }

    return { survey, link };
  } catch {
    return null;
  }
}

function countAnsweredQuestions(answersJson: unknown) {
  if (!answersJson || typeof answersJson !== "object" || Array.isArray(answersJson)) {
    return 0;
  }

  return Object.values(answersJson as Record<string, unknown>).filter((value) => {
    if (value == null) {
      return false;
    }

    if (typeof value === "string") {
      return value.trim() !== "";
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return true;
  }).length;
}

async function countOwnedAnsweredQuestions() {
  const rows = await loadOwnedResponseMetricRows();

  return rows.reduce(
    (accumulator, row) => accumulator + countAnsweredQuestions(row.answers_json),
    0,
  );
}

export async function getDashboardMetrics() {
  const [allSurveys, questionsAnswered] = await Promise.all([
    listOwnedSurveys(),
    countOwnedAnsweredQuestions(),
  ]);
  const surveys = allSurveys.filter((survey) => survey.status !== "archived");

  return buildDashboardMetrics(surveys, questionsAnswered);
}

export async function getSurveyAnalyticsSchema(surveyId: string) {
  const { schema } = await loadSurveyAnalyticsContext(surveyId);
  return schema;
}

export async function runSurveyAnalytics(surveyId: string, query: SurveyAnalyticsQueryInput) {
  const context = await loadSurveyAnalyticsContext(surveyId);
  return runSurveyAnalyticsFromContext(context, query);
}

export async function getSurveyAnalyticsPageData(surveyId: string) {
  const context = await loadSurveyAnalyticsContext(surveyId);

  return {
    schema: context.schema,
    runPreview: (query: SurveyAnalyticsQueryInput) => runSurveyAnalyticsFromContext(context, query),
  };
}

export async function getSurveyAnalyticsOverviewData(surveyId: string) {
  const context = await loadSurveyAnalyticsContext(surveyId);
  const defaultTranslations =
    context.survey.definition_json.translations[context.survey.default_language];
  const surveyTitle = defaultTranslations?.survey_title?.trim() || context.survey.name;

  return {
    survey: context.survey,
    surveyTitle,
    overview: buildSurveyOverviewData({
      survey: context.survey,
      schema: context.schema,
      rows: context.rows,
      collectedResponseCount: context.collectedResponseCount,
      collectedResponseWindow: context.collectedResponseWindow,
    }),
  };
}

export async function getSegmentExplorerBootstrap(surveyId: string) {
  const context = await loadSurveyAnalyticsContext(surveyId);
  return {
    schema: context.schema,
    catalog: buildSegmentCatalog({
      survey: context.survey,
      schema: context.schema,
      rows: context.rows,
    }),
    analysedN: context.rows.length,
    measurementHash: context.schema.measurement_hash,
    schemaNamespace: context.schema.schema_namespace,
  };
}

export async function runSegmentExplorerSummary(surveyId: string, definition: SegmentDefinition) {
  const context = await loadSurveyAnalyticsContext(surveyId);
  const validated = validateSegmentDefinition(definition, context.schema, {
    surveyId: context.survey.id,
    measurementHash: context.schema.measurement_hash,
  });
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  return buildSegmentAnalysis({
    schema: context.schema,
    rows: context.rows,
    definition: validated.definition,
  });
}

export async function runSegmentSamplePreview(surveyId: string, definition: SegmentDefinition) {
  const context = await loadSurveyAnalyticsContext(surveyId);
  const validated = validateSegmentDefinition(definition, context.schema, {
    surveyId: context.survey.id,
    measurementHash: context.schema.measurement_hash,
  });
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  return previewSegmentSample({
    schema: context.schema,
    rows: context.rows,
    definition: validated.definition,
  });
}

export async function runSegmentPostalMapPreview(
  surveyId: string,
  definition: SegmentDefinition,
): Promise<PostalMapAnalysis | null> {
  const context = await loadSurveyAnalyticsContext(surveyId);
  const validated = validateSegmentDefinition(definition, context.schema, {
    surveyId: context.survey.id,
    measurementHash: context.schema.measurement_hash,
  });
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  return buildPostalMapAnalysis({
    schema: context.schema,
    rows: context.rows,
    definition: validated.definition,
  });
}

export async function runSegmentComparison(
  surveyId: string,
  definitionA: SegmentDefinition,
  definitionB: SegmentDefinition,
) {
  const context = await loadSurveyAnalyticsContext(surveyId);
  const expected = {
    surveyId: context.survey.id,
    measurementHash: context.schema.measurement_hash,
  };
  const validatedA = validateSegmentDefinition(definitionA, context.schema, expected);
  if (!validatedA.ok) {
    throw new Error(validatedA.message);
  }
  const validatedB = validateSegmentDefinition(definitionB, context.schema, expected);
  if (!validatedB.ok) {
    throw new Error(validatedB.message);
  }

  const result = buildSegmentComparison({
    schema: context.schema,
    rows: context.rows,
    definitionA: validatedA.definition,
    definitionB: validatedB.definition,
  });
  return {
    ...result,
    postalMap: buildPostalMapComparison(
      buildPostalMapAnalysis({
        schema: context.schema,
        rows: context.rows,
        definition: validatedA.definition,
      }),
      buildPostalMapAnalysis({
        schema: context.schema,
        rows: context.rows,
        definition: validatedB.definition,
      }),
    ),
  };
}

export async function generateSurveyInstrumentHealthData(surveyId: string) {
  await requireCurrentSession();
  const source = await loadOwnedInstrumentHealthSource(surveyId);
  return buildInstrumentHealthData(source);
}

const loadSurveyAnalyticsContext = cache(async (surveyId: string) => {
  const session = await requireCurrentSession();
  // Do not wrap this snapshot in unstable_cache: ~1000 mapped rows exceed Next's 2MB data-cache limit.
  const runtime = await loadOwnedSurveyAnalyticsRuntimeSnapshot(surveyId, session.user.id);
  const schema = buildSurveyAnalyticsSchema({
    survey: runtime.survey,
    readyResponseCount: runtime.rows.length,
    excludedUnmappedCount: runtime.excludedUnmappedCount,
    readyPipelineCount: runtime.readyPipelineCount,
  });

  return {
    ...runtime,
    schema,
  };
});

function runSurveyAnalyticsFromContext(
  context: Awaited<ReturnType<typeof loadSurveyAnalyticsContext>>,
  query: SurveyAnalyticsQueryInput,
) {
  return {
    schema: context.schema,
    result: runSurveyAnalyticsQuery({
      schema: context.schema,
      rows: context.rows,
      query,
    }),
  };
}
