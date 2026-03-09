import Link from "next/link";
import { Survey } from "@/features/surveys/types";
import { appRoutes } from "@/lib/config/routes";

type SurveyListProps = {
  surveys: Survey[];
  title?: string;
};

export function SurveyList({ surveys, title }: SurveyListProps) {
  return (
    <section className="surface-card surface-card--dense">
      {title ? (
        <div className="list-header">
          <div>
            <h2>{title}</h2>
          </div>
        </div>
      ) : null}

      <div className="survey-list" role="list">
        {surveys.map((survey) => (
          <article key={survey.id} className="survey-list__item" role="listitem">
            <div className="survey-list__main">
              <div className="survey-list__title">
                <h3>{survey.title}</h3>
                <p>
                  {survey.stakeholderType} · {survey.sourceLanguage} ·{" "}
                  {survey.targetLanguages.length} language
                  {survey.targetLanguages.length > 1 ? "s" : ""}
                </p>
              </div>

              <div className="survey-list__meta">
                <span className={`status-pill status-pill--${survey.status.toLowerCase()}`}>
                  {survey.status}
                </span>
                <span className="meta-pill">{survey.responsesCount} responses</span>
              </div>
            </div>

            <div className="survey-list__footer">
              <div className="survey-card__concepts">
                {survey.ontologyConcepts.map((concept) => (
                  <span key={concept} className="tag">
                    {concept}
                  </span>
                ))}
              </div>

              <div className="button-row">
                <Link href={appRoutes.surveyDetail(survey.id)} className="button button--secondary">
                  Open
                </Link>
                <Link href={appRoutes.surveyEdit(survey.id)} className="button button--ghost">
                  Edit
                </Link>
                <Link
                  href={appRoutes.surveyAnalytics(survey.id)}
                  className="button button--ghost"
                >
                  Analytics
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
