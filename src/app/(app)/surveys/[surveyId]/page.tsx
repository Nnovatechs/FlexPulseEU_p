import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionList } from "@/components/surveys/question-list";
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

  return (
    <div className="page-stack">
      {resolvedSearchParams.error === "immutable" ? (
        <div className="notice notice--warning" role="status">
          This survey has already been published and can no longer be edited.
        </div>
      ) : null}
      <PageHeader
        eyebrow="Survey detail"
        title={survey.title}
        description="Overview of the survey configuration, lifecycle, and question set."
        actions={
          <div className="button-row">
            {survey.status === "Draft" ? (
              <Link href={appRoutes.surveyEdit(survey.id)} className="button button--secondary">
                Edit survey
              </Link>
            ) : null}
            {survey.defaultPublicLinkUrl ? (
              <Link href={survey.defaultPublicLinkUrl} className="button button--primary">
                Open public link
              </Link>
            ) : null}
            <Link href={appRoutes.surveyFill(survey.id)} className="button button--primary">
              Preview filling flow
            </Link>
          </div>
        }
      />

      <section className="content-grid">
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
