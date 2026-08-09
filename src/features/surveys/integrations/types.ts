export const SURVEY_LINK_INTEGRATION_PROVIDER_PROLIFIC = "prolific";
export const EXTERNAL_RECRUITMENT_NOTICE_VERSION = "external-recruitment-v1";
export const EXTERNAL_RECRUITMENT_TOKEN_VERSION = "v1";

export type SurveyLinkIntegrationProvider =
  typeof SURVEY_LINK_INTEGRATION_PROVIDER_PROLIFIC;

export type PersistedSurveyLinkIntegration = {
  id: string;
  survey_link_id: string;
  provider: SurveyLinkIntegrationProvider;
  external_study_id: string;
  completion_url: string;
  provider_config_json: Record<string, unknown>;
  privacy_notice_version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProlificIntegrationSummary = {
  id: string;
  studyId: string;
  completionUrl: string;
  completionCode: string;
  isActive: boolean;
};

export type PublicExternalRecruitment =
  | { kind: "direct" }
  | {
      kind: "prolific";
      prolificPid: string;
      studyId: string;
      sessionId: string;
    }
  | { kind: "error"; message: string };
