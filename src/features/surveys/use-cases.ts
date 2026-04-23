import { appRoutes } from "@/lib/config/routes";
import {
  getOwnedDefaultSurveyLink,
  getOwnedSurveyById,
  getPublicSurveyLinkByToken,
  getPublishedSurveyByIdPublic,
  listOwnedSurveys,
} from "./generator-repository";
import { PersistedSurvey, PersistedSurveyLink } from "./generator-types";
import {
  buildSurveyAnalyticsSchema,
  runSurveyAnalyticsQuery,
  type SurveyAnalyticsQueryInput,
} from "./survey-analytics";
import { loadOwnedSurveyAnalyticsRuntime } from "./survey-analytics-repository";
import { Survey } from "./types";

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
    responsesCount: 0,
    questionCount: questions.length,
    mappingCount: survey.mapping_contract_json.mappings.length,
    defaultPublicLinkUrl,
    questions,
  };
}

async function mapOwnedPersistedSurvey(survey: PersistedSurvey): Promise<Survey> {
  const defaultLink =
    survey.status === "published"
      ? await getOwnedDefaultSurveyLink(survey.id)
      : null;

  return buildSurveyProjection(
    survey,
    defaultLink ? appRoutes.publicSurveyLink(defaultLink.link_token) : null,
  );
}

export async function getSurveys(): Promise<Survey[]> {
  const surveys = await listOwnedSurveys();
  return Promise.all(surveys.map(mapOwnedPersistedSurvey));
}

export async function getSurveyById(surveyId: string): Promise<Survey | null> {
  try {
    const survey = await getOwnedSurveyById(surveyId);
    return mapOwnedPersistedSurvey(survey);
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

export async function getDashboardMetrics() {
  const surveys = await getSurveys();
  const published = surveys.filter((survey) => survey.status === "Published");
  const drafts = surveys.filter((survey) => survey.status === "Draft");
  const archived = surveys.filter((survey) => survey.status === "Archived");

  return {
    totalSurveys: surveys.length,
    publishedSurveys: published.length,
    draftSurveys: drafts.length,
    archivedSurveys: archived.length,
    totalQuestions: surveys.reduce(
      (accumulator, survey) => accumulator + survey.questionCount,
      0,
    ),
  };
}

export async function getSurveyAnalyticsSchema(surveyId: string) {
  const { survey, rows } = await loadOwnedSurveyAnalyticsRuntime(surveyId);
  return buildSurveyAnalyticsSchema({
    survey,
    readyResponseCount: rows.length,
  });
}

export async function runSurveyAnalytics(surveyId: string, query: SurveyAnalyticsQueryInput) {
  const { survey, rows } = await loadOwnedSurveyAnalyticsRuntime(surveyId);
  const schema = buildSurveyAnalyticsSchema({
    survey,
    readyResponseCount: rows.length,
  });

  return {
    schema,
    result: runSurveyAnalyticsQuery({
      schema,
      rows,
      query,
    }),
  };
}
