import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSurveyById } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

type SurveyFillPageProps = {
  params: Promise<{ surveyId: string }>;
};

export default async function SurveyFillPage({ params }: SurveyFillPageProps) {
  const { surveyId } = await params;
  const survey = await getSurveyById(surveyId);

  if (!survey) {
    notFound();
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Respondent experience"
        title={`Fill ${survey.title}`}
        description="A premium survey-filling mockup with calm pacing, clear prompts, and space for future transitions and progress logic."
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

      <div className="button-row">
        <Link href={appRoutes.surveyDetail(survey.id)} className="button button--ghost">
          Return to survey
        </Link>
        <Link href={appRoutes.surveyAnalytics(survey.id)} className="button button--primary">
          View analytics mockup
        </Link>
      </div>
    </div>
  );
}
