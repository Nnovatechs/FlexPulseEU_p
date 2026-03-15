import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSurveyById } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

type SurveyEditPageProps = {
  params: Promise<{ surveyId: string }>;
};

export default async function SurveyEditPage({ params }: SurveyEditPageProps) {
  const { surveyId } = await params;
  const survey = await getSurveyById(surveyId);

  if (!survey) {
    notFound();
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Draft editing"
        title={`Edit ${survey.title}`}
        description="This draft is now loaded from Supabase. Question editing will be connected in the next step."
        actions={
          <div className="button-row">
            <Link href={appRoutes.surveyDetail(survey.id)} className="button button--ghost">
              Back to preview
            </Link>
            <Link
              href={appRoutes.surveyAnalytics(survey.id)}
              className="button button--primary"
            >
              Validate survey
            </Link>
          </div>
        }
      />

      {survey.questions.length > 0 ? (
        <section className="stack-list">
          {survey.questions.map((question, index) => (
            <article key={question.id} className="surface-card">
              <div className="editable-question__header">
                <div>
                  <p className="section-header__eyebrow">Question {index + 1}</p>
                  <h2>{question.title}</h2>
                </div>
                <span className="meta-pill">{question.type}</span>
              </div>

              <div className="stack-form">
                <label className="field">
                  <span>Question key</span>
                  <input defaultValue={question.key} readOnly />
                </label>

                <label className="field">
                  <span>Question title</span>
                  <input defaultValue={question.title} readOnly />
                </label>

                <label className="field">
                  <span>Description</span>
                  <textarea defaultValue={question.description} rows={4} readOnly />
                </label>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="surface-card">
          <div className="empty-state empty-state--inline">
            <h3>Draft created successfully</h3>
            <p>
              This survey already exists in the database. The next implementation
              step is to connect the generator/editor so questions can be added here.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
