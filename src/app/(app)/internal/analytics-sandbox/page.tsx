import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  canAccessAnalyticsSandbox,
  seedAnalyticsSandboxForSession,
} from "@/features/surveys/analytics-sandbox";
import { findDashboardQaSandboxForOwner } from "@/features/surveys/dashboard-qa-sandbox";
import { DASHBOARD_QA_BANNER } from "@/features/surveys/dashboard-qa/constants";
import { requireCurrentSession } from "@/lib/auth/session";
import { appRoutes } from "@/lib/config/routes";
import {
  createDashboardQaSandboxAction,
  resetDashboardQaSandboxAction,
} from "./dashboard-qa-actions";
import { DashboardQaSandboxForm } from "./dashboard-qa-sandbox-form";

async function seedAnalyticsSandboxAction() {
  "use server";

  const session = await requireCurrentSession();
  const result = await seedAnalyticsSandboxForSession(session);

  redirect(result.analyticsUrl);
}

export default async function AnalyticsSandboxPage() {
  const session = await requireCurrentSession();
  const canSeed = canAccessAnalyticsSandbox(session);
  const dashboardQa = canSeed ? await findDashboardQaSandboxForOwner(session.user.id) : null;

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[
          { label: "Surveys", href: appRoutes.dashboard },
          { label: "Internal sandbox" },
        ]}
        eyebrow="Internal sandbox"
        title="Analytics sandbox dataset"
        description="Generate private synthetic datasets in your account. Mapper profiling stays on legacy analytics; Dashboard QA opens Analytics V2."
      />

      <section className="surface-card">
        <h2>Mapper / profiling sandbox</h2>
        {canSeed ? (
          <>
            <p>
              This action resets your existing internal analytics sandbox survey and seeds a new
              published survey with 270 ready mapped responses, 8 archetypes, synthetic enrichment,
              and mapper outputs.
            </p>
            <p>
              Access is restricted by session and sandbox configuration. The generated survey is
              owned by your current user, so the normal survey middleware, ownership checks, and
              analytics repository are used when you open the analytics screen.
            </p>
            <form action={seedAnalyticsSandboxAction}>
              <button type="submit" className="button button--primary">
                Generate sandbox and open analytics
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="evidence-warning">
              Analytics sandbox seeding is not available for your account in this environment.
            </p>
            <p>
              In production this requires explicit sandbox configuration and an allowlisted email.
              In local development it is enabled by default unless disabled via environment
              variables.
            </p>
          </>
        )}
      </section>

      <section className="surface-card">
        <h2>Dashboard QA Sandbox V2</h2>
        <p>
          Internal synthetic QA data for Analytics V2. This dataset is not participant fieldwork
          and is excluded from real workspace metrics.
        </p>
        <p className="evidence-warning">{DASHBOARD_QA_BANNER}</p>
        {canSeed ? (
          dashboardQa ? (
            <div className="button-row">
              <Link href={dashboardQa.analyticsUrl} className="button button--primary">
                Open Dashboard QA sandbox
              </Link>
              <DashboardQaSandboxForm
                action={resetDashboardQaSandboxAction}
                idleLabel="Reset synthetic data"
                pendingLabel="Resetting…"
              />
            </div>
          ) : (
            <DashboardQaSandboxForm
              action={createDashboardQaSandboxAction}
              idleLabel="Create Dashboard QA sandbox"
              pendingLabel="Creating…"
            />
          )
        ) : (
          <p>
            Dashboard QA sandbox actions use the same sandbox access rules as mapper profiling.
          </p>
        )}
      </section>
    </div>
  );
}
