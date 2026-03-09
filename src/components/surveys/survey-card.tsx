import Link from "next/link";
import { appRoutes } from "@/lib/config/routes";
import { Survey } from "@/features/surveys/types";

type SurveyCardProps = {
  survey: Survey;
};

export function SurveyCard({ survey }: SurveyCardProps) {
  return (
    <article className="survey-card">
      <div className="survey-card__header">
        <span className={`status-pill status-pill--${survey.status.toLowerCase()}`}>
          {survey.status}
        </span>
        <span className="meta-pill">{survey.responsesCount} responses</span>
      </div>

      <div className="survey-card__body">
        <h2>{survey.title}</h2>
        <p>
          {survey.stakeholderType} survey in {survey.sourceLanguage} with{" "}
          {survey.targetLanguages.length} target language
          {survey.targetLanguages.length > 1 ? "s" : ""}.
        </p>
      </div>

      <div className="survey-card__concepts">
        {survey.ontologyConcepts.map((concept) => (
          <span key={concept} className="tag">
            {concept}
          </span>
        ))}
      </div>

      <div className="survey-card__actions">
        <Link href={appRoutes.surveyDetail(survey.id)} className="button button--secondary">
          View
        </Link>
        <Link href={appRoutes.surveyEdit(survey.id)} className="button button--ghost">
          Edit
        </Link>
        <Link href={appRoutes.surveyAnalytics(survey.id)} className="button button--ghost">
          Analytics
        </Link>
      </div>
    </article>
  );
}
