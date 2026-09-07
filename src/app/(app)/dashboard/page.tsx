import { workspaceOnboardingGuide } from "@/components/onboarding/guides";
import { PageOnboardingGuide } from "@/components/onboarding/page-onboarding-guide";
import { PageHeader } from "@/components/layout/page-header";
import { PendingNavLink } from "@/components/pending-nav-link";
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
        titleAside={<PageOnboardingGuide {...workspaceOnboardingGuide} />}
        description="Created surveys, lifecycle status, and current draft inventory."
        actions={
          <PendingNavLink href={appRoutes.surveyNew} className="button button--primary">
            Create new survey
          </PendingNavLink>
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
