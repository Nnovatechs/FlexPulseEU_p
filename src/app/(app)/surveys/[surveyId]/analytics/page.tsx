import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MetricGrid } from "@/components/surveys/metric-grid";
import { getSurveyById } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

type SurveyAnalyticsPageProps = {
  params: Promise<{ surveyId: string }>;
};

export default async function SurveyAnalyticsPage({
  params,
}: SurveyAnalyticsPageProps) {
  const { surveyId } = await params;
  const survey = await getSurveyById(surveyId);

  if (!survey) {
    notFound();
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Survey analytics"
        title={`${survey.title} dashboard`}
        description="A future data-processing cockpit for response quality, participation, and concept-level interpretation."
        actions={
          <Link href={appRoutes.surveyFill(survey.id)} className="button button--secondary">
            Preview respondent flow
          </Link>
        }
      />

      <MetricGrid
        metrics={[
          {
            label: "Responses collected",
            value: String(survey.responsesCount),
            hint: "Current mock participation volume",
          },
          {
            label: "Completion rate",
            value: "84%",
            hint: "Illustrative metric for future analytics",
          },
          {
            label: "Average duration",
            value: "6m 20s",
            hint: "Expected respondent effort",
          },
          {
            label: "Languages active",
            value: String(survey.targetLanguages.length),
            hint: "Published language versions",
          },
        ]}
      />

      <section className="content-grid">
        <article className="surface-card">
          <h2>Processing insights</h2>
          <div className="stack-list">
            <div className="analytics-row">
              <strong>Trusting Automation</strong>
              <span>Strong positive signal in early mock data</span>
            </div>
            <div className="analytics-row">
              <strong>Thermal Comfort Zones</strong>
              <span>Comfort sensitivity remains the key barrier</span>
            </div>
            <div className="analytics-row">
              <strong>Flexibility Necessities</strong>
              <span>Convenience framing likely increases engagement</span>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <h2>Lifecycle controls</h2>
          <div className="stack-list">
            <Link href={appRoutes.surveyDetail(survey.id)} className="button button--ghost">
              Open survey detail
            </Link>
            <Link href={appRoutes.surveyEdit(survey.id)} className="button button--ghost">
              Reopen editing
            </Link>
            <Link href={appRoutes.surveyFill(survey.id)} className="button button--primary">
              Test survey URL
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
