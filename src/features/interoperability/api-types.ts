import type { MapperOutput, PersistedSurvey } from "@/features/surveys/generator-types";
import type { SurveyAnalyticsSchema } from "@/features/surveys/survey-analytics";

export const INTEROPERABILITY_API_VERSION = "v1";
export const API_TOKEN_PREFIX_LIVE = "fp_live";
export const API_TOKEN_PREFIX_TEST = "fp_test";
export const API_MAX_JSON_BYTES = 3_500_000;
export const API_MAX_QUERY_BYTES = 64 * 1024;
export const API_DEFAULT_PAGE_LIMIT = 50;
export const API_MAX_PAGE_LIMIT = 100;
export const API_RATE_LIMIT_STANDARD = 120;
export const API_RATE_LIMIT_ANALYTICS = 30;

export const API_SCOPES = ["surveys:read", "data:read", "analytics:read"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export type ApiRequestContext = {
  requestId: string;
  startedAt: number;
  routeTemplate: string;
  method: string;
};

export type ApiAuthContext = {
  tokenId: string;
  ownerUserId: string;
  scopes: ApiScope[];
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string;
    retryAfterSeconds: number;
  };
};

export type InteroperabilityApiTokenRow = {
  id: string;
  owner_user_id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  scopes: ApiScope[];
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  rate_window_started_at: string | null;
  rate_window_count: number;
};

export type InteroperabilityApiTokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiScope[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  status: "active" | "expired" | "revoked";
};

export type CreateInteroperabilityApiTokenInput = {
  name: string;
  scopes: ApiScope[];
  expiresAt: string | null;
};

export type CreatedInteroperabilityApiToken = {
  summary: InteroperabilityApiTokenSummary;
  token: string;
};

export type SurveyListCursor = {
  createdAt: string;
  id: string;
};

export type SurveyDataCursor = {
  respondedAt: string;
  responseId: string;
};

export type ProfileDataCursor = {
  processedAt: string;
  responseId: string;
};

export type InteroperabilitySurveyListItem = {
  id: string;
  name: string;
  status: PersistedSurvey["status"];
  default_language: string;
  supported_languages: string[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  measurement_hash: string | null;
  mapping_hash: string | null;
  response_count: number;
};

export type InteroperabilitySurveyDetail = InteroperabilitySurveyListItem & {
  definition_json: PersistedSurvey["definition_json"];
  measurement_plan_json: PersistedSurvey["definition_json"]["survey_meta"]["measurement_plan_json"] | null;
  mapping_contract_json: PersistedSurvey["mapping_contract_json"];
  schema_namespace: SurveyAnalyticsSchema["schema_namespace"] | PersistedSurvey["definition_json"]["survey_meta"]["measurement_plan_json"] extends infer T
    ? T extends { schema_namespace: infer U }
      ? U
      : null
    : null;
  schema_version: number | null;
};

export type InteroperabilityResponseItem = {
  response_id: string;
  survey_id: string;
  responded_at: string;
  submitted_language: string;
  pipeline_status: string;
  answers: Record<string, unknown>;
  measurement_hash_at_submission: string | null;
  mapping_hash_at_submission: string | null;
};

export type InteroperabilityProfileItem = {
  response_id: string;
  survey_id: string;
  mapper_output: MapperOutput;
  mapper_version: string;
  processed_at: string;
  measurement_hash_used: string | null;
  mapping_hash_used: string | null;
};

export type ApiSuccessMeta = {
  api_version: typeof INTEROPERABILITY_API_VERSION;
  request_id: string;
  generated_at: string;
};

export type ApiListMeta = ApiSuccessMeta & {
  next_cursor: string | null;
  has_more: boolean;
};

export type ApiErrorCode =
  | "invalid_request"
  | "invalid_token"
  | "insufficient_scope"
  | "not_found"
  | "payload_too_large"
  | "record_too_large"
  | "rate_limit_exceeded"
  | "internal_error";

export type ApiListPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
