import { NextResponse } from "next/server";
import { handleApiRoute } from "@/features/interoperability/api-route-handler";
import { buildInteroperabilityOpenApiDocument } from "@/features/interoperability/openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  return handleApiRoute({
    request,
    routeTemplate: "/api/v1/openapi",
    publicRoute: true,
    handler: async ({ context }) => {
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;
      return NextResponse.json(buildInteroperabilityOpenApiDocument(baseUrl), {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Request-Id": context.requestId,
        },
      });
    },
  });
}
