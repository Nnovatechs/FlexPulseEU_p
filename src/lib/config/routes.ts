export const appRoutes = {
  login: "/login",
  dashboard: "/dashboard",
  surveys: "/surveys",
  surveyNew: "/surveys/new",
  surveyDetail: (surveyId: string) => `/surveys/${surveyId}`,
  surveyEdit: (surveyId: string) => `/surveys/${surveyId}/edit`,
  surveyFill: (surveyId: string) => `/surveys/${surveyId}/fill`,
  surveyAnalytics: (surveyId: string) => `/surveys/${surveyId}/analytics`,
} as const;
