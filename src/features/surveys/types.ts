export type SurveyQuestion = {
  id: string;
  key: string;
  title: string;
  description: string;
  type: string;
  required: boolean;
};

export type SurveyStatus = "Draft" | "Published" | "Archived";

export type Survey = {
  id: string;
  title: string;
  internalName: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  status: SurveyStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  responsesCount: number;
  questionCount: number;
  mappingCount: number;
  questions: SurveyQuestion[];
};
