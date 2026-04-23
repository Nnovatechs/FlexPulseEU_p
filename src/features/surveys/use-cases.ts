import { listOwnedSurveys, getOwnedSurveyById } from "./generator-repository";
import { PersistedSurvey } from "./generator-types";
import { Survey } from "./types";

function formatQuestionType(value: string) {
  return value.replaceAll("_", " ");
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function mapPersistedSurvey(survey: PersistedSurvey): Survey {
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
    status: toTitleCase(survey.status) as Survey["status"],
    createdAt: survey.created_at,
    updatedAt: survey.updated_at,
    publishedAt: survey.published_at,
    responsesCount: 0,
    questionCount: questions.length,
    mappingCount: survey.mapping_contract_json.mappings.length,
    questions,
  };
}

export async function getSurveys(): Promise<Survey[]> {
  const surveys = await listOwnedSurveys();
  return surveys.map(mapPersistedSurvey);
}

export async function getSurveyById(surveyId: string): Promise<Survey | null> {
  try {
    const survey = await getOwnedSurveyById(surveyId);
    return mapPersistedSurvey(survey);
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
