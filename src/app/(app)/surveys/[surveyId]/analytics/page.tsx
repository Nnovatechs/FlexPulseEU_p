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
        description="Survey analytics shell using the live survey record from Supabase."
        actions={
          <Link href={appRoutes.surveyFill(survey.id)} className="button button--secondary">
            Preview respondent flow
          </Link>
        }
      />

      <MetricGrid
        metrics={[
          {
            label: "Questions",
            value: String(survey.questionCount),
            hint: "Current survey structure",
          },
          {
            label: "Mappings",
            value: String(survey.mappingCount),
            hint: "Semantic mapping entries",
          },
          {
            label: "Status",
            value: survey.status,
            hint: "Current lifecycle state",
          },
          {
            label: "Languages active",
            value: String(survey.supportedLanguages.length),
            hint: "Configured survey languages",
          },
        ]}
      />

      <section className="content-grid">
        <article className="surface-card">
          <h2>Current readiness</h2>
          <div className="stack-list">
            <div className="analytics-row">
              <strong>Responses pipeline</strong>
              <span>Not connected yet</span>
            </div>
            <div className="analytics-row">
              <strong>Publication state</strong>
              <span>
                {survey.publishedAt
                  ? `Published on ${new Date(survey.publishedAt).toLocaleDateString("en-GB")}`
                  : "Still in pre-publication state"}
              </span>
            </div>
            <div className="analytics-row">
              <strong>Last update</strong>
              <span>{new Date(survey.updatedAt).toLocaleDateString("en-GB")}</span>
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
