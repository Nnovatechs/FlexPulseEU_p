import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, expect, it } from "vitest";
import { buildInteroperabilityOpenApiDocument } from "@/features/interoperability/openapi";

describe("interoperability openapi", () => {
  it("validates as OpenAPI 3.1 and contains all implemented endpoints", async () => {
    const document = buildInteroperabilityOpenApiDocument("https://flexpulse.test");
    await expect(SwaggerParser.validate(document as never)).resolves.toBeTruthy();

    expect(document).toMatchObject({
      openapi: "3.1.0",
      paths: {
        "/": expect.any(Object),
        "/openapi": expect.any(Object),
        "/surveys": expect.any(Object),
        "/surveys/{surveyId}": expect.any(Object),
        "/surveys/{surveyId}/schema": expect.any(Object),
        "/surveys/{surveyId}/responses": expect.any(Object),
        "/surveys/{surveyId}/profiles": expect.any(Object),
        "/surveys/{surveyId}/analytics/query": expect.any(Object),
      },
      components: {
        securitySchemes: {
          bearerAuth: expect.objectContaining({
            type: "http",
            scheme: "bearer",
          }),
        },
      },
    });

    const surveys = document.paths as Record<string, { get?: { responses: Record<string, unknown> } }>;
    expect(surveys["/surveys"]?.get?.responses).toMatchObject({
      "401": expect.any(Object),
      "403": expect.any(Object),
      "429": expect.any(Object),
    });
    expect(surveys["/surveys/{surveyId}/profiles"]?.get?.responses).toMatchObject({
      "413": expect.any(Object),
      "429": expect.any(Object),
    });
    expect(surveys["/surveys/{surveyId}/responses"]?.get?.responses).toMatchObject({
      "413": expect.any(Object),
    });
    expect(
      (surveys["/surveys"]?.get?.responses as { "200"?: { headers?: Record<string, unknown> } })["200"]
        ?.headers,
    ).toMatchObject({
      "RateLimit-Limit": expect.any(Object),
      "RateLimit-Remaining": expect.any(Object),
      "RateLimit-Reset": expect.any(Object),
    });
    const analytics = document.paths as Record<
      string,
      { get?: { responses: Record<string, unknown> }; post?: { responses: Record<string, unknown> } }
    >;
    expect(analytics["/surveys/{surveyId}/analytics/query"]?.post?.responses).toMatchObject({
      "400": expect.any(Object),
      "401": expect.any(Object),
      "403": expect.any(Object),
      "413": expect.any(Object),
      "429": expect.any(Object),
    });
  });
});
