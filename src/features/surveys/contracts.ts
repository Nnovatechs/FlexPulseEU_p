import { Survey } from "./types";

export type SurveyRepository = {
  listSurveys(): Promise<Survey[]>;
  getSurveyById(surveyId: string): Promise<Survey | null>;
};
