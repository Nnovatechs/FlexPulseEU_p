import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSurveyById } from "@/features/surveys/use-cases";

type SurveyFillPageProps = {
  params: Promise<{ surveyId: string }>;
};

export default async function PublicSurveyFillPage({
  params,
}: SurveyFillPageProps) {
  const { surveyId } = await params;
  const survey = await getSurveyById(surveyId);

  if (!survey) {
    notFound();
  }

  return (
    <main className="public-survey-shell">
      <section className="public-survey-container">
        <PageHeader
          eyebrow="Open survey"
          title={survey.title}
          description="Public respondent view for shared survey links."
        />

        <section className="survey-flow">
          {survey.questions.map((question, index) => (
            <article key={question.id} className="surface-card survey-step">
              <p className="section-header__eyebrow">
                Step {index + 1} of {survey.questions.length}
              </p>
              <h2>{question.title}</h2>
              <p>{question.description}</p>

              <div className="mock-answer">
                <span>{question.type} answer component placeholder</span>
              </div>
            </article>
          ))}
        </section>
        <div className="public-survey-note">
          Protected analytics and survey management remain available only inside
          the authenticated workspace.
        </div>
      </section>
    </main>
  );
}
