import { SurveyRepository } from "./contracts";
import { mockSurveyRepository } from "./mock-repository";
import { Survey } from "./types";

const surveyRepository: SurveyRepository = mockSurveyRepository;

export async function getSurveys(): Promise<Survey[]> {
  return surveyRepository.listSurveys();
}

export async function getSurveyById(surveyId: string): Promise<Survey | null> {
  return surveyRepository.getSurveyById(surveyId);
}

export async function getDashboardMetrics() {
  const surveys = await getSurveys();
  const published = surveys.filter((survey) => survey.status === "Published");
  const drafts = surveys.filter((survey) => survey.status === "Draft");

  return {
    totalSurveys: surveys.length,
    publishedSurveys: published.length,
    draftSurveys: drafts.length,
    totalResponses: surveys.reduce(
      (accumulator, survey) => accumulator + survey.responsesCount,
      0,
    ),
  };
}
