import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { MetricGrid } from "@/components/surveys/metric-grid";
import { SurveyList } from "@/components/surveys/survey-list";
import { getDashboardData } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

export default async function DashboardPage() {
  const { metrics, surveys } = await getDashboardData();

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[{ label: "Workspace" }]}
        title="Surveys"
        description="Created surveys, lifecycle status, and current draft inventory."
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
            label: "Surveys published",
            value: String(metrics.publishedSurveys),
            hint: "Published definitions",
          },
          {
            label: "Questions",
            value: String(metrics.totalQuestions),
            hint: "Across all drafts and published surveys",
          },
          {
            label: "Questions answered",
            value: String(metrics.questionsAnswered),
            hint: "Individual answers collected from submissions",
          },
        ]}
      />

      <SurveyList surveys={surveys} />
    </div>
  );
}
