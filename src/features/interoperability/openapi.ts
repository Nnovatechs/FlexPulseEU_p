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

  return {
    openapi: "3.1.0",
    info: {
      title: "FlexPulseEU Interoperability API",
      version: "v1",
      description:
        "Read-only server-to-server API for owner-scoped surveys, responses, profiles and safe analytics queries.",
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
            "200": { description: "Service metadata" },
            "401": { description: "Invalid token", content: { "application/json": { schema: commonError } } },
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
          description: `${scopeLine(["surveys:read"])} Ordered by created_at desc, id desc. Limit max 100.`,
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Survey list" },
            "401": { description: "Invalid token", content: { "application/json": { schema: commonError } } },
            "403": { description: "Insufficient scope", content: { "application/json": { schema: commonError } } },
          },
        },
      },
      "/surveys/{surveyId}": {
        get: {
          summary: "Get survey metadata and frozen contracts",
          description: scopeLine(["surveys:read"]),
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "surveyId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Survey detail" },
            "404": { description: "Survey not found", content: { "application/json": { schema: commonError } } },
          },
        },
      },
      "/surveys/{surveyId}/schema": {
        get: {
          summary: "Get the analytics schema for a survey",
          description: scopeLine(["surveys:read"]),
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "surveyId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Survey analytics schema" },
          },
        },
      },
      "/surveys/{surveyId}/responses": {
        get: {
          summary: "List responses for a survey",
          description: `${scopeLine(["data:read"])} Responses are paginated and payloads may be reduced to stay below the response size limit.`,
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "surveyId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Response page" },
            "413": { description: "Record too large", content: { "application/json": { schema: commonError } } },
          },
        },
      },
      "/surveys/{surveyId}/profiles": {
        get: {
          summary: "List mapped profiles for a survey",
          description: scopeLine(["data:read"]),
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "surveyId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
            { name: "cursor", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Profile page" },
          },
        },
      },
      "/surveys/{surveyId}/analytics/query": {
        post: {
          summary: "Run a safe analytics query",
          description:
            `${scopeLine(["analytics:read"])} No SQL or arbitrary expressions are allowed. Limits: 64KB body, 16 filters, 2 group_by, 12 metrics, 500 result groups.`,
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "surveyId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
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
            "200": { description: "Analytics query result" },
            "400": { description: "Invalid request", content: { "application/json": { schema: commonError } } },
            "429": { description: "Rate limit exceeded", content: { "application/json": { schema: commonError } } },
          },
        },
      },
    },
  };
}
