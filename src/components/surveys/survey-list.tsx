import { PendingNavLink } from "@/components/pending-nav-link";
import { SurveyDuplicateAction } from "@/components/surveys/survey-duplicate-action";
import { SurveyLifecycleAction } from "@/components/surveys/survey-lifecycle-action";
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
          <PendingNavLink href={appRoutes.surveyNew} className="button button--primary">
            Create new survey
          </PendingNavLink>
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
                <h3>{survey.internalName}</h3>
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
                <span className="meta-pill">
                  {survey.responsesCount} respondent{survey.responsesCount === 1 ? "" : "s"}
                </span>
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
                <PendingNavLink href={appRoutes.surveyDetail(survey.id)} className="button button--secondary">
                  Open
                </PendingNavLink>
                {survey.status === "Draft" ? (
                  <PendingNavLink href={appRoutes.surveyEdit(survey.id)} className="button button--ghost">
                    Edit
                  </PendingNavLink>
                ) : null}
                <SurveyDuplicateAction surveyId={survey.id} />
                <PendingNavLink
                  href={appRoutes.surveyAnalyticsV2(survey.id)}
                  className="button button--ghost"
                >
                  Analytics
                </PendingNavLink>
                {survey.status === "Draft" || survey.status === "Published" ? (
                  <SurveyLifecycleAction
                    surveyId={survey.id}
                    surveyTitle={survey.internalName}
                    status={survey.status}
                  />
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
