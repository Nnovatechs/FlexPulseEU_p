import type { ApiScope } from "./api-types";

type OpenApiDocument = Record<string, unknown>;

function scopeLine(scopes: ApiScope[] | []) {
  return scopes.length > 0 ? `Required scope: \`${scopes.join("`, `")}\`.` : "Requires a valid bearer token.";
}

export function buildInteroperabilityOpenApiDocument(baseUrl: string): OpenApiDocument {
  const commonError = {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          request_id: { type: "string", format: "uuid" },
        },
        required: ["code", "message", "request_id"],
      },
    },
    required: ["error"],
  };

  const rateLimitHeaders = {
    "RateLimit-Limit": {
      schema: { type: "string" },
      description: "Maximum requests allowed in the current 60-second window.",
    },
    "RateLimit-Remaining": {
      schema: { type: "string" },
      description: "Requests remaining in the current window.",
    },
    "RateLimit-Reset": {
      schema: { type: "string", format: "date-time" },
      description: "When the current window resets (UTC).",
    },
  };

  const rateLimitExceededHeaders = {
    ...rateLimitHeaders,
    "Retry-After": {
      schema: { type: "integer", minimum: 1 },
      description: "Seconds to wait before retrying.",
    },
  };

  const errorJson = {
    content: { "application/json": { schema: commonError } },
  };

  const authErrors = {
    "401": { description: "Invalid token", ...errorJson },
    "403": { description: "Insufficient scope", ...errorJson },
    "429": {
      description: "Rate limit exceeded",
      headers: rateLimitExceededHeaders,
      ...errorJson,
    },
  };

  const surveyNotFound = {
    "404": { description: "Survey not found", ...errorJson },
  };

  const invalidRequest = {
    "400": { description: "Invalid request", ...errorJson },
  };

  const recordTooLarge = {
    "413": { description: "Record too large", ...errorJson },
  };

  const pageParams = [
    { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
    { name: "cursor", in: "query", schema: { type: "string" } },
  ];

  const surveyIdParam = {
    name: "surveyId",
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  };

  const successHeaders = { headers: rateLimitHeaders };

  return {
    openapi: "3.1.0",
    info: {
      title: "FlexPulseEU Interoperability API",
      version: "v1",
      description:
        "Read-only server-to-server API for owner-scoped surveys, responses, profiles and safe analytics queries. All authenticated routes share one 120 requests/minute limit per token.",
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "FlexPulse API Token",
        },
      },
      headers: {
        RateLimitLimit: rateLimitHeaders["RateLimit-Limit"],
        RateLimitRemaining: rateLimitHeaders["RateLimit-Remaining"],
        RateLimitReset: rateLimitHeaders["RateLimit-Reset"],
        RetryAfter: rateLimitExceededHeaders["Retry-After"],
      },
      schemas: {
        SuccessMeta: {
          type: "object",
          properties: {
            api_version: { type: "string", const: "v1" },
            request_id: { type: "string", format: "uuid" },
            generated_at: { type: "string", format: "date-time" },
          },
          required: ["api_version", "request_id", "generated_at"],
        },
        ListMeta: {
          type: "object",
          properties: {
            api_version: { type: "string", const: "v1" },
            request_id: { type: "string", format: "uuid" },
            generated_at: { type: "string", format: "date-time" },
            next_cursor: { type: ["string", "null"] },
            has_more: { type: "boolean" },
          },
          required: ["api_version", "request_id", "generated_at", "next_cursor", "has_more"],
        },
        ErrorEnvelope: commonError,
      },
    },
    paths: {
      "/": {
        get: {
          summary: "Describe the API service",
          description: scopeLine([]),
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Service metadata", ...successHeaders },
            ...authErrors,
          },
        },
      },
      "/openapi": {
        get: {
          summary: "Get the OpenAPI document",
          description: "Public contract for the Interoperability API. No authentication required.",
          responses: {
            "200": { description: "OpenAPI 3.1 document" },
          },
        },
      },
      "/surveys": {
        get: {
          summary: "List surveys for the token owner",
          description: `${scopeLine(["surveys:read"])} Ordered by created_at desc, id desc. Limit max 100. Follow meta.next_cursor while meta.has_more is true to retrieve every page.`,
          security: [{ bearerAuth: [] }],
          parameters: pageParams,
          responses: {
            "200": { description: "Survey list", ...successHeaders },
            ...invalidRequest,
            ...authErrors,
          },
        },
      },
      "/surveys/{surveyId}": {
        get: {
          summary: "Get survey metadata and frozen contracts",
          description: scopeLine(["surveys:read"]),
          security: [{ bearerAuth: [] }],
          parameters: [surveyIdParam],
          responses: {
            "200": { description: "Survey detail", ...successHeaders },
            ...invalidRequest,
            ...authErrors,
            ...surveyNotFound,
          },
        },
      },
      "/surveys/{surveyId}/schema": {
        get: {
          summary: "Get the analytics schema for a survey",
          description: scopeLine(["surveys:read"]),
          security: [{ bearerAuth: [] }],
          parameters: [surveyIdParam],
          responses: {
            "200": { description: "Survey analytics schema", ...successHeaders },
            ...invalidRequest,
            ...authErrors,
            ...surveyNotFound,
          },
        },
      },
      "/surveys/{surveyId}/responses": {
        get: {
          summary: "List responses for a survey",
          description: `${scopeLine(["data:read"])} Pages may be reduced to stay below the response size limit. Follow meta.next_cursor while meta.has_more is true. Includes every pipeline_status stored for the survey.`,
          security: [{ bearerAuth: [] }],
          parameters: [surveyIdParam, ...pageParams],
          responses: {
            "200": { description: "Response page", ...successHeaders },
            ...invalidRequest,
            ...authErrors,
            ...surveyNotFound,
            ...recordTooLarge,
          },
        },
      },
      "/surveys/{surveyId}/profiles": {
        get: {
          summary: "List mapped profiles for a survey",
          description: `${scopeLine(["data:read"])} Pages may be reduced to stay below the response size limit. Follow meta.next_cursor while meta.has_more is true.`,
          security: [{ bearerAuth: [] }],
          parameters: [surveyIdParam, ...pageParams],
          responses: {
            "200": { description: "Profile page", ...successHeaders },
            ...invalidRequest,
            ...authErrors,
            ...surveyNotFound,
            ...recordTooLarge,
          },
        },
      },
      "/surveys/{surveyId}/analytics/query": {
        post: {
          summary: "Run a safe analytics query",
          description:
            `${scopeLine(["analytics:read"])} No SQL or arbitrary expressions are allowed. Limits: 64KB body, 16 filters, 2 group_by, 12 metrics, 500 result groups.`,
          security: [{ bearerAuth: [] }],
          parameters: [surveyIdParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                examples: {
                  sample: {
                    value: {
                      filters: [{ field: "context.country_code", op: "eq", value: "ES" }],
                      group_by: ["context.country_code"],
                      metrics: [{ key: "respondents", kind: "count" }],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Analytics query result", ...successHeaders },
            ...invalidRequest,
            ...authErrors,
            ...surveyNotFound,
            "413": { description: "Payload too large", ...errorJson },
          },
        },
      },
    },
  };
}
