import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { AudienceLinksCard } from "@/components/surveys/audience-links-card";
import { PublicLinkProlificCard } from "@/components/surveys/public-link-prolific-card";
import { QuestionList } from "@/components/surveys/question-list";
import { SurveyDuplicateAction } from "@/components/surveys/survey-duplicate-action";
import { getOwnedDefaultSurveyLink, listOwnedSurveyLinks } from "@/features/surveys/generator-repository";
import { getOwnedProlificIntegrationSummary } from "@/features/surveys/integrations/repository";
import { isDashboardQaSandboxSurvey } from "@/features/surveys/dashboard-qa/survey-fixture";
import { InternalQaDataBanner } from "@/components/surveys/internal-qa-data-banner";
import { getSurveyById } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

type SurveyDetailPageProps = {
  params: Promise<{ surveyId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function SurveyDetailPage({
  params,
  searchParams,
}: SurveyDetailPageProps) {
  const { surveyId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const survey = await getSurveyById(surveyId);

  if (!survey) {
    notFound();
  }

  const isDashboardQa = isDashboardQaSandboxSurvey({ name: survey.internalName });
  const defaultLink =
    survey.status === "Published" ? await getOwnedDefaultSurveyLink(survey.id) : null;
  const audienceLinks =
    !isDashboardQa && (survey.status === "Published" || survey.status === "Archived")
      ? await listOwnedSurveyLinks(survey.id)
      : [];
  const prolificIntegration =
    defaultLink ? await getOwnedProlificIntegrationSummary(defaultLink.id) : null;

  return (
    <div className="page-stack">
      {resolvedSearchParams.error === "immutable" ? (
        <div className="notice notice--warning" role="status">
          This survey has already been published and can no longer be edited.
        </div>
      ) : null}
      {survey.status === "Archived" ? (
        <div className="notice notice--warning" role="status">
          This survey has been archived and is hidden from the workspace list.
        </div>
      ) : null}
      {isDashboardQa ? <InternalQaDataBanner /> : null}
      <PageHeader
        breadcrumbs={[
          { label: "Surveys", href: appRoutes.dashboard },
          { label: survey.title },
        ]}
        eyebrow="Survey detail"
        title={survey.title}
        description="Overview of the survey configuration, lifecycle, and question set."
        actions={
          <div className="button-row">
            <Link href={appRoutes.surveyAnalyticsV2(survey.id)} className="button button--ghost">
              Analytics
            </Link>
            <SurveyDuplicateAction surveyId={survey.id} />
            {survey.status === "Draft" ? (
              <Link href={appRoutes.surveyEdit(survey.id)} className="button button--secondary">
                Edit survey
              </Link>
            ) : null}
            {survey.defaultPublicLinkUrl && survey.status !== "Archived" ? (
              <Link href={survey.defaultPublicLinkUrl} className="button button--primary">
                Open public link
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="content-grid survey-detail-grid">
        <article className="surface-card">
          <h2>Survey setup</h2>
          <div className="info-grid">
            <div>
              <span>Internal name</span>
              <strong>{survey.internalName}</strong>
            </div>
            <div>
              <span>Default language</span>
              <strong>{survey.defaultLanguage}</strong>
            </div>
            <div>
              <span>Supported languages</span>
              <strong>{survey.supportedLanguages.join(", ")}</strong>
            </div>
            <div>
              <span>Location context</span>
              <strong>{survey.locationContextSummary}</strong>
            </div>
            <div>
              <span>Enrichment</span>
              <strong>{survey.enrichmentSummary}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{survey.status}</strong>
            </div>
            <div>
              <span>Questions</span>
              <strong>{survey.questionCount}</strong>
            </div>
            <div>
              <span>Mapping entries</span>
              <strong>{survey.mappingCount}</strong>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <h2>Lifecycle</h2>
          <div className="stack-list">
            <div className="analytics-row">
              <strong>Created</strong>
              <span>{new Date(survey.createdAt).toLocaleString("en-GB")}</span>
            </div>
            <div className="analytics-row">
              <strong>Last updated</strong>
              <span>{new Date(survey.updatedAt).toLocaleString("en-GB")}</span>
            </div>
            <div className="analytics-row">
              <strong>Published</strong>
              <span>
                {survey.publishedAt
                  ? new Date(survey.publishedAt).toLocaleString("en-GB")
                  : "Not published yet"}
              </span>
            </div>
            <div className="analytics-row">
              <strong>Public link</strong>
              {survey.defaultPublicLinkUrl ? (
                <Link href={survey.defaultPublicLinkUrl}>{survey.defaultPublicLinkUrl}</Link>
              ) : (
                <span>Created on publish</span>
              )}
            </div>
          </div>
        </article>

        {defaultLink && survey.defaultPublicLinkUrl ? (
          <PublicLinkProlificCard
            surveyId={survey.id}
            surveyLinkId={defaultLink.id}
            publicLinkUrl={survey.defaultPublicLinkUrl}
            integration={prolificIntegration}
          />
        ) : null}
        {!isDashboardQa && (survey.status === "Published" || survey.status === "Archived") ? (
          <AudienceLinksCard
            surveyId={survey.id}
            surveyStatus={survey.status}
            links={audienceLinks}
          />
        ) : null}
      </section>

      <section className="surface-card">
        <h2>Questions</h2>
        {survey.questions.length > 0 ? (
          <QuestionList questions={survey.questions} />
        ) : (
          <div className="empty-state empty-state--inline">
            <h3>No questions yet</h3>
            <p>
              This survey has not been structured yet. The next step is defining
              the question set inside the editor.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
