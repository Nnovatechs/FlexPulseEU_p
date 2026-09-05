import { PendingNavLink } from "@/components/pending-nav-link";
import { getSegmentExplorerBootstrap, getSurveyAnalyticsOverviewData } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";
import { isDashboardQaSandboxSurvey } from "@/features/surveys/dashboard-qa/survey-fixture";
import { InternalQaDataBanner } from "@/components/surveys/internal-qa-data-banner";
import { AnalyticsV2Workbench } from "./analytics-v2-workbench";

type SurveyAnalyticsV2PageProps = {
  params: Promise<{ surveyId: string }>;
  searchParams: Promise<{ segment?: string | string[] }>;
};

export default async function SurveyAnalyticsV2Page({
  params,
  searchParams,
}: SurveyAnalyticsV2PageProps) {
  const { surveyId } = await params;
  const query = await searchParams;
  const segmentParam = Array.isArray(query.segment) ? query.segment[0] : query.segment ?? null;
  const [{ survey, overview }, bootstrap] = await Promise.all([
    getSurveyAnalyticsOverviewData(surveyId),
    getSegmentExplorerBootstrap(surveyId),
  ]);

  return (
    <div className="analytics-shell analytics-shell--v2">
      <div className="analytics-content analytics-content--v2">
        <header className="analytics-content__header analytics-content__header--v2">
          <nav className="breadcrumb breadcrumb--analytics" aria-label="Breadcrumb">
            <span className="breadcrumb__item">
              <PendingNavLink href={appRoutes.dashboard}>Surveys</PendingNavLink>
            </span>
            <span className="breadcrumb__item">
              <PendingNavLink href={appRoutes.surveyDetail(survey.id)}>{survey.name}</PendingNavLink>
            </span>
            <span className="breadcrumb__item">
              <span>Analytics 2</span>
            </span>
          </nav>
        </header>

        <div className="analytics-sections-body analytics-sections-body--v2">
          {isDashboardQaSandboxSurvey(survey) ? <InternalQaDataBanner /> : null}
          <AnalyticsV2Workbench
            surveyId={survey.id}
            surveyTitle={survey.name}
            overviewData={overview}
            catalog={bootstrap.catalog}
            schema={bootstrap.schema}
            initialSegmentParam={segmentParam}
          />
        </div>
      </div>
    </div>
  );
}
