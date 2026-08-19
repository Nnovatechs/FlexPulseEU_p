import Link from "next/link";
import { appRoutes } from "@/lib/config/routes";

export default function ApiDocsPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="legal-eyebrow">Interoperability API</p>
        <h1>FlexPulseEU API</h1>
        <p>
          The Interoperability API is a read-only server-to-server API for surveys, mapped
          profiles and safe aggregated analytics queries.
        </p>
        <p>
          Create tokens from your account settings, keep them in your own backend, and call the
          API with an `Authorization: Bearer ...` header. Browser-side token storage is not
          supported in v1.
        </p>

        <section>
          <h2>What you can do</h2>
          <ul>
            <li>List surveys that belong to the token owner.</li>
            <li>Read a survey definition and analytics schema.</li>
            <li>Download paginated responses and mapped profiles.</li>
            <li>Run safe analytics queries using the existing FlexPulse analytics engine.</li>
          </ul>
        </section>

        <section>
          <h2>Base URL</h2>
          <p>`/api/v1`</p>
        </section>

        <section>
          <h2>Scopes</h2>
          <ul>
            <li>`surveys:read` for survey metadata and analytics schema.</li>
            <li>`data:read` for responses and profiles.</li>
            <li>{"`analytics:read` for `POST /api/v1/surveys/{surveyId}/analytics/query`."}</li>
          </ul>
        </section>

        <section>
          <h2>Pagination and limits</h2>
          <ul>
            <li>Default page size: 50.</li>
            <li>Maximum page size: 100.</li>
            <li>Responses are kept below the runtime payload budget and may be reduced further.</li>
            <li>Analytics query body limit: 64 KB.</li>
            <li>Analytics query limits: 16 filters, 2 group_by fields, 12 metrics, 500 groups.</li>
          </ul>
        </section>

        <section>
          <h2>Errors</h2>
          <p>
            The API returns safe JSON errors such as `invalid_request`, `invalid_token`,
            `insufficient_scope`, `not_found`, `payload_too_large`, `record_too_large` and
            `rate_limit_exceeded`.
          </p>
        </section>

        <section>
          <h2>OpenAPI</h2>
          <p>
            The machine-readable contract is available at{" "}
            <Link href="/api/v1/openapi">`/api/v1/openapi`</Link>.
          </p>
        </section>

        <section>
          <h2>`curl` example</h2>
          <pre>{`curl \\
  -H "Authorization: Bearer fp_live_REPLACE_ME" \\
  "https://<deployment>/api/v1/surveys"`}</pre>
        </section>

        <section>
          <h2>Analytics query example</h2>
          <pre>{`curl \\
  -X POST \\
  -H "Authorization: Bearer fp_live_REPLACE_ME" \\
  -H "Content-Type: application/json" \\
  "https://<deployment>/api/v1/surveys/<surveyId>/analytics/query" \\
  -d '{
    "filters": [
      { "field": "context.country_code", "op": "eq", "value": "ES" }
    ],
    "group_by": ["context.country_code"],
    "metrics": [
      { "key": "respondents", "kind": "count" }
    ]
  }'`}</pre>
        </section>

        <p className="legal-meta">
          Tokens can be created from <Link href={appRoutes.accountApi}>API Access</Link>.
        </p>
      </article>
    </main>
  );
}
