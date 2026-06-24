import { unstable_cache } from "next/cache";
import { appRoutes } from "@/lib/config/routes";
import { requireCurrentSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnedDefaultSurveyLink,
  getOwnedSurveyById,
  listOwnedSurveyLinksForSurveyIds,
  listOwnedSurveys,
} from "./generator-repository";
import { PersistedSurvey, PersistedSurveyLink } from "./generator-types";
import {
  buildSurveyAnalyticsSchema,
  runSurveyAnalyticsQuery,
  type SurveyAnalyticsQueryInput,
} from "./survey-analytics";
import { loadOwnedSurveyAnalyticsRuntimeSnapshot } from "./survey-analytics-repository";
import {
  getPublicSurveyLinkByToken,
  getPublishedSurveyByIdPublic,
} from "./public-survey-load";
import { Survey } from "./types";

const loadCachedSurveyAnalyticsRuntime = unstable_cache(
  async (surveyId: string, ownerId: string) =>
    loadOwnedSurveyAnalyticsRuntimeSnapshot(surveyId, ownerId),
  ["owned-survey-analytics-runtime"],
  { revalidate: 60 },
);

function formatQuestionType(value: string) {
  return value.replaceAll("_", " ");
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
    return "Country code and postal code";
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
        description: translations?.description?.trim() || "",
        type: formatQuestionType(question.type),
        required: question.required,
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

async function loadOwnedSurveyResponseCounts() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("survey_responses").select("survey_id");

  if (error) {
    throw new Error(`Failed to load survey response counts: ${error.message}`);
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    if (!row.survey_id) {
      continue;
    }

    counts.set(row.survey_id, (counts.get(row.survey_id) ?? 0) + 1);
  }

  return counts;
}

async function countOwnedSurveyResponses(surveyId: string) {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("survey_responses")
    .select("id", { count: "exact", head: true })
    .eq("survey_id", surveyId);

  if (error) {
    throw new Error(`Failed to count survey responses: ${error.message}`);
  }

  return count ?? 0;
}

export async function getSurveys(): Promise<Survey[]> {
  const [allSurveys, responseCounts] = await Promise.all([
    listOwnedSurveys(),
    loadOwnedSurveyResponseCounts(),
  ]);

  const surveys = allSurveys.filter((survey) => survey.status !== "archived");

  return mapOwnedPersistedSurveys(surveys, responseCounts);
}

export async function getDashboardData() {
  const [allSurveys, responseCounts, questionsAnswered] = await Promise.all([
    listOwnedSurveys(),
    loadOwnedSurveyResponseCounts(),
    countOwnedAnsweredQuestions(),
  ]);
  const surveys = allSurveys.filter((survey) => survey.status !== "archived");

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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("survey_responses").select("answers_json");

  if (error) {
    throw new Error(`Failed to load dashboard response metrics: ${error.message}`);
  }

  return (data ?? []).reduce(
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

async function loadSurveyAnalyticsContext(surveyId: string) {
  const session = await requireCurrentSession();
  const runtime = await loadCachedSurveyAnalyticsRuntime(surveyId, session.user.id);
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
}

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
