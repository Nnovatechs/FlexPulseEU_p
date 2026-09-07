import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { TokenManager } from "./token-manager";
import { listCurrentOwnerApiTokens } from "@/features/interoperability/api-token-repository";
import { appRoutes } from "@/lib/config/routes";

type AccountApiPageProps = {
  searchParams?: Promise<{ revoked?: string; error?: string }>;
};

const errorMessages: Record<string, string> = {
  "missing-token": "Choose a token to revoke.",
  "revoke-failed": "The token could not be revoked.",
};

export default async function AccountApiPage({ searchParams }: AccountApiPageProps) {
  const params = (await searchParams) ?? {};
  const tokens = await listCurrentOwnerApiTokens();
  const errorMessage = params.error ? errorMessages[params.error] ?? "API token request failed." : null;

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[
          { label: "Workspace", href: appRoutes.dashboard },
          { label: "Account" },
        ]}
        title="API Access"
        description="Create and revoke server-to-server API tokens for your own FlexPulse surveys."
      />

      {params.revoked === "1" ? (
        <div className="notice notice--info" role="status">
          API token revoked.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <section className="surface-card stack-form">
        <div>
          <p className="legal-eyebrow">Documentation</p>
          <p className="muted">
            Read the integration guide or inspect the versioned OpenAPI contract
            before creating a server-to-server integration.
          </p>
        </div>
        <div className="button-row">
          <Link
            href={appRoutes.interoperabilityApiDocs}
            className="button button--secondary"
          >
            View API documentation
          </Link>
          <a
            href={appRoutes.interoperabilityOpenApi}
            className="button button--ghost"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenAPI 3.1 specification ↗
          </a>
        </div>
      </section>

      <TokenManager tokens={tokens} />
    </div>
  );
}
