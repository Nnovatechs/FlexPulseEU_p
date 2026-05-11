import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { seedAnalyticsSandboxForSession } from "@/features/surveys/analytics-sandbox";
import { requireCurrentSession } from "@/lib/auth/session";

async function seedAnalyticsSandboxAction() {
  "use server";

  const session = await requireCurrentSession();
  const result = await seedAnalyticsSandboxForSession(session);

  redirect(result.analyticsUrl);
}

export default async function AnalyticsSandboxPage() {
  await requireCurrentSession();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Internal sandbox"
        title="Analytics sandbox dataset"
        description="Generate a private synthetic mapper/profiling dataset in your account, then inspect it through the normal survey analytics page."
      />

      <section className="surface-card">
        <h2>Generate synthetic analytics survey</h2>
        <p>
          This action resets your existing internal analytics sandbox survey and seeds a new
          published survey with 270 ready mapped responses, 8 archetypes, synthetic enrichment,
          and mapper outputs.
        </p>
        <p>
          Access is restricted by session and sandbox configuration. The generated survey is owned
          by your current user, so the normal survey middleware, ownership checks, and analytics
          repository are used when you open the analytics screen.
        </p>
        <form action={seedAnalyticsSandboxAction}>
          <button type="submit" className="button button--primary">
            Generate sandbox and open analytics
          </button>
        </form>
      </section>
    </div>
  );
}
