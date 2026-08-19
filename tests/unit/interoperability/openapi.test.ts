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
  });
});
