import { handleApiRoute } from "@/features/interoperability/api-route-handler";
import { jsonSuccess } from "@/features/interoperability/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  return handleApiRoute({
    request,
    routeTemplate: "/api/v1",
    handler: async ({ auth, context }) =>
      jsonSuccess(
        {
          service: "FlexPulseEU Interoperability API",
          api_version: "v1",
          openapi_url: "/api/v1/openapi",
          docs_url: "/docs/api",
          scopes: auth?.scopes ?? [],
        },
        context.requestId,
        auth,
      ),
  });
}
