export const appRoutes = {
  login: "/login",
  dashboard: "/dashboard",
  surveys: "/surveys",
  surveyNew: "/surveys/new",
  surveyDetail: (surveyId: string) => `/surveys/${surveyId}`,
  surveyEdit: (surveyId: string) => `/surveys/${surveyId}/edit`,
  publicSurveyLink: (linkToken: string) => `/s/${linkToken}`,
  publicSurveyThankYou: (linkToken: string) => `/s/${linkToken}/thank-you`,
  surveyAnalytics: (surveyId: string) => `/surveys/${surveyId}/analytics`,
} as const;
