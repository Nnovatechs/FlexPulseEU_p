import Link from "next/link";
import { getSurveyAnalyticsOverviewData } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";
import { AnalyticsV2Workbench } from "./analytics-v2-workbench";

type SurveyAnalyticsV2PageProps = {
  params: Promise<{ surveyId: string }>;
};

export default async function SurveyAnalyticsV2Page({ params }: SurveyAnalyticsV2PageProps) {
  const { surveyId } = await params;
  const { survey, overview } = await getSurveyAnalyticsOverviewData(surveyId);

  return (
    <div className="analytics-shell analytics-shell--v2">
      <div className="analytics-content analytics-content--v2">
        <header className="analytics-content__header analytics-content__header--v2">
          <nav className="breadcrumb breadcrumb--analytics" aria-label="Breadcrumb">
            <span className="breadcrumb__item">
              <Link href={appRoutes.dashboard}>Surveys</Link>
            </span>
            <span className="breadcrumb__item">
              <Link href={appRoutes.surveyDetail(survey.id)}>{survey.name}</Link>
            </span>
            <span className="breadcrumb__item">
              <span>Analytics 2</span>
            </span>
          </nav>
        </header>

        <div className="analytics-sections-body analytics-sections-body--v2">
          <AnalyticsV2Workbench
            surveyId={survey.id}
            surveyTitle={survey.name}
            overviewData={overview}
          />
        </div>
      </div>
    </div>
  );
}
