import { workspaceOnboardingGuide } from "@/components/onboarding/guides";
import { PageOnboardingGuide } from "@/components/onboarding/page-onboarding-guide";
import { PageHeader } from "@/components/layout/page-header";
import { PendingNavLink } from "@/components/pending-nav-link";
import { SurveyList } from "@/components/surveys/survey-list";
import { getSurveys } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

export default async function SurveysPage() {
  const surveys = await getSurveys();

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[
          { label: "Surveys", href: appRoutes.dashboard },
          { label: "Library" },
        ]}
        title="Survey library"
        titleAside={<PageOnboardingGuide {...workspaceOnboardingGuide} />}
        description="Draft and published surveys. Archived surveys are removed from this list."
        actions={
          <PendingNavLink href={appRoutes.surveyNew} className="button button--primary">
            Create new survey
          </PendingNavLink>
        }
      />

      <SurveyList surveys={surveys} />
    </div>
  );
}
