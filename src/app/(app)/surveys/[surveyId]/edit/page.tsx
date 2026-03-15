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
        eyebrow="Editing flow"
        title={`Edit ${survey.title}`}
        description="This mockup represents the step where generated questions can be refined, extended, and validated before publication."
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
                <span>Question title</span>
                <input defaultValue={question.title} />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea defaultValue={question.description} rows={4} />
              </label>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
