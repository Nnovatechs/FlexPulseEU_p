import Link from "next/link";
import { Survey } from "@/features/surveys/types";
import { appRoutes } from "@/lib/config/routes";

type SurveyListProps = {
  surveys: Survey[];
  title?: string;
};

export function SurveyList({ surveys, title }: SurveyListProps) {
  if (surveys.length === 0) {
    return (
      <section className="surface-card surface-card--dense">
        {title ? (
          <div className="list-header">
            <div>
              <h2>{title}</h2>
            </div>
          </div>
        ) : null}

        <div className="empty-state">
          <h3>No surveys yet</h3>
          <p>Create the first survey to start shaping the workspace.</p>
          <Link href={appRoutes.surveyNew} className="button button--primary">
            Create new survey
          </Link>
        </div>
      </section>
    );
  }

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
                  {survey.defaultLanguage} · {survey.supportedLanguages.length} language
                  {survey.supportedLanguages.length > 1 ? "s" : ""} · {survey.questionCount} question
                  {survey.questionCount === 1 ? "" : "s"}
                </p>
              </div>

              <div className="survey-list__meta">
                <span className={`status-pill status-pill--${survey.status.toLowerCase()}`}>
                  {survey.status}
                </span>
                <span className="meta-pill">{survey.mappingCount} mapping entries</span>
              </div>
            </div>

            <div className="survey-list__footer">
              <div className="survey-list__timestamps">
                <span className="tag">Updated {new Date(survey.updatedAt).toLocaleDateString("en-GB")}</span>
                {survey.publishedAt ? (
                  <span className="tag">
                    Published {new Date(survey.publishedAt).toLocaleDateString("en-GB")}
                  </span>
                ) : null}
              </div>

              <div className="button-row">
                <Link href={appRoutes.surveyDetail(survey.id)} className="button button--secondary">
                  Open
                </Link>
                {survey.status === "Draft" ? (
                  <Link href={appRoutes.surveyEdit(survey.id)} className="button button--ghost">
                    Edit
                  </Link>
                ) : null}
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
