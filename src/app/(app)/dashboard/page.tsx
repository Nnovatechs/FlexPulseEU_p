import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { MetricGrid } from "@/components/surveys/metric-grid";
import { SurveyList } from "@/components/surveys/survey-list";
import { getDashboardMetrics, getSurveys } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

export default async function DashboardPage() {
  const [metrics, surveys] = await Promise.all([
    getDashboardMetrics(),
    getSurveys(),
  ]);

  return (
    <div className="page-stack">
      <PageHeader
        title="Surveys"
        description="Created surveys, current status, and response activity in one place."
        actions={
          <Link href={appRoutes.surveyNew} className="button button--primary">
            Create new survey
          </Link>
        }
      />

      <MetricGrid
        metrics={[
          {
            label: "Total surveys",
            value: String(metrics.totalSurveys),
            hint: "Current portfolio",
          },
          {
            label: "Published",
            value: String(metrics.publishedSurveys),
            hint: "Live survey links",
          },
          {
            label: "Drafts",
            value: String(metrics.draftSurveys),
            hint: "Pending refinement",
          },
          {
            label: "Responses",
            value: String(metrics.totalResponses),
            hint: "Across all surveys",
          },
        ]}
      />

      <section className="workspace-strip">
        <div className="workspace-strip__copy">
          <h2>Survey operations</h2>
          <p>Start a new survey or continue working across the existing portfolio.</p>
        </div>
        <div className="workspace-strip__actions">
          <Link href={appRoutes.surveyNew} className="button button--primary">
            New survey
          </Link>
        </div>
      </section>

      <SurveyList surveys={surveys} />
    </div>
  );
}
