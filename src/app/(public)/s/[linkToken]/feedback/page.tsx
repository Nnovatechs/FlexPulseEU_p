import { notFound } from "next/navigation";
import { PublicSurveyVisibility } from "@/components/surveys/public-survey-visibility";
import { getSurveyFeedbackQuestions } from "@/features/surveys/feedback";
import { submitPublicSurveyFeedbackAction } from "@/features/surveys/feedback-actions";
import { getPublicSurveyFeedbackPageData } from "@/features/surveys/feedback-repository";

type PublicSurveyFeedbackPageProps = {
  params: Promise<{ linkToken: string }>;
  searchParams?: Promise<{ responseId?: string }>;
};

export default async function PublicSurveyFeedbackPage({
  params,
  searchParams,
}: PublicSurveyFeedbackPageProps) {
  const { linkToken } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const responseId = resolvedSearchParams.responseId?.trim() ?? "";
  if (!responseId) {
    notFound();
  }

  const pageData = await getPublicSurveyFeedbackPageData({ linkToken, responseId });
  if (!pageData) {
    notFound();
  }

  const questions = getSurveyFeedbackQuestions();

  return (
    <main>
      <div className="sf-shell">
        <div className="sf-container">
          <header className="sf-survey-header">
            <p className="sf-survey-eyebrow">Survey feedback</p>
            <h1 className="sf-survey-title">Survey feedback</h1>
            <p className="sf-survey-desc">
              These questions are about the questionnaire itself. Your honest feedback
              is very important for us.
            </p>
          </header>

          <form action={submitPublicSurveyFeedbackAction} className="sf-feedback-form">
            <input type="hidden" name="linkToken" value={linkToken} />
            <input type="hidden" name="responseId" value={responseId} />

            <section className="sf-feedback-note">
              <p>
                These answers will not affect your previous responses. Please do not
                include personal information in your answers.
              </p>
            </section>

            <section className="sf-feedback-questions">
              {questions.map((question, index) =>
                question.type === "rating" ? (
                  <article key={question.id} className="sf-question">
                    <p className="sf-question__index">Question {index + 1}</p>
                    <h2 className="sf-question__title">{question.prompt}</h2>
                    <p className="sf-question__desc">
                      {question.minLabel} to {question.maxLabel}
                    </p>
                    <div className="sf-feedback-rating" role="radiogroup" aria-label={question.prompt}>
                      {Array.from({ length: 5 }, (_, optionIndex) => {
                        const value = String(optionIndex + 1);
                        return (
                          <label key={value} className="sf-feedback-rating__option">
                            <input type="radio" name="easeRating" value={value} required />
                            <span>{value}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="sf-feedback-rating__labels muted">
                      <span>{question.minLabel}</span>
                      <span>{question.maxLabel}</span>
                    </div>
                  </article>
                ) : (
                  <article key={question.id} className="sf-question">
                    <p className="sf-question__index">Question {index + 1}</p>
                    <h2 className="sf-question__title">{question.prompt}</h2>
                    {question.helpText ? (
                      <p className="sf-question__desc">{question.helpText}</p>
                    ) : null}
                    <textarea
                      className="sf-feedback-textarea"
                      name={
                        question.id === "unclear_questions_text"
                          ? "unclearQuestionsText"
                          : question.id === "energy_flexibility_programme_text"
                            ? "energyFlexibilityProgrammeText"
                            : question.id === "automated_control_text"
                              ? "automatedControlText"
                              : question.id === "leading_questions_text"
                                ? "leadingQuestionsText"
                                : "overlapOrTechnicalText"
                      }
                      rows={4}
                      required
                    />
                  </article>
                ),
              )}
            </section>

            {pageData.questionReferences.length > 0 ? (
              <details className="sf-feedback-reference">
                <summary>Show answered questions for reference</summary>
                <div className="sf-feedback-reference__list">
                  {pageData.questionReferences.map((question) => (
                    <div key={question.questionKey} className="sf-feedback-reference__item">
                      <strong>{question.index}.</strong> <span>{question.title}</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            <div className="sf-actions">
              <button type="submit" className="button button--primary">
                Submit feedback
              </button>
            </div>
          </form>

          <PublicSurveyVisibility compact />
        </div>
      </div>
    </main>
  );
}
