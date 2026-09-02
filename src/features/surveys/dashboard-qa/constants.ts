export const DASHBOARD_QA_SURVEY_NAME = "[Internal QA] Dashboard coverage v2 — synthetic";
export const DASHBOARD_QA_FIXTURE_KIND = "dashboard_coverage_v2";
export const DASHBOARD_QA_BANNER = "Internal synthetic QA data — not participant fieldwork";
export const DASHBOARD_QA_LINK_AUDIENCE_TOKEN = "dashboard_qa_internal";
export const DASHBOARD_QA_LINK_AUDIENCE_LABEL = "Internal QA";
export const DASHBOARD_QA_RESPONSE_COUNT = 360;
export const DASHBOARD_QA_VARIANTS_PER_ARCHETYPE = 12;
export const DASHBOARD_QA_COUNTRIES = ["IE", "ES", "FR"] as const;
export const DASHBOARD_QA_COUNTRY_RESPONSE_COUNT = 120;

export type DashboardQaCountryCode = (typeof DASHBOARD_QA_COUNTRIES)[number];
