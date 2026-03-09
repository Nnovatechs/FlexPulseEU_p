import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionList } from "@/components/surveys/question-list";
import { getSurveyById } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

type SurveyDetailPageProps = {
  params: Promise<{ surveyId: string }>;
};

export default async function SurveyDetailPage({
  params,
}: SurveyDetailPageProps) {
  const { surveyId } = await params;
  const survey = await getSurveyById(surveyId);

  if (!survey) {
    notFound();
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Survey visualization"
        title={survey.title}
        description="A clean read-only view of the generated survey before editing, validation, publication, or analytics review."
        actions={
          <div className="button-row">
            <Link href={appRoutes.surveyEdit(survey.id)} className="button button--secondary">
              Edit survey
            </Link>
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
              <span>Stakeholder</span>
              <strong>{survey.stakeholderType}</strong>
            </div>
            <div>
              <span>Source language</span>
              <strong>{survey.sourceLanguage}</strong>
            </div>
            <div>
              <span>Target languages</span>
              <strong>{survey.targetLanguages.join(", ")}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{survey.status}</strong>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <h2>Ontology concepts</h2>
          <div className="chip-grid">
            {survey.ontologyConcepts.map((concept) => (
              <span key={concept} className="tag">
                {concept}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-card">
        <h2>Generated questions</h2>
        <QuestionList questions={survey.questions} />
      </section>
    </div>
  );
}
