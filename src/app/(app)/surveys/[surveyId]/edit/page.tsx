import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionList } from "@/components/surveys/question-list";
import { updateSurveySettingsAction } from "@/features/surveys/actions";
import { surveyLanguageOptions } from "@/features/surveys/language-options";
import { getOwnedSurveyById } from "@/features/surveys/generator-repository";
import { appRoutes } from "@/lib/config/routes";

type SurveyEditPageProps = {
  params: Promise<{ surveyId: string }>;
  searchParams?: Promise<{ created?: string; saved?: string; error?: string }>;
};

export default async function SurveyEditPage({
  params,
  searchParams,
}: SurveyEditPageProps) {
  const { surveyId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  let survey;

  try {
    survey = await getOwnedSurveyById(surveyId);
  } catch {
    survey = null;
  }

  if (!survey) {
    notFound();
  }

  const activeTranslations =
    survey.definition_json.translations[survey.default_language] ?? null;
  const createdMessage = resolvedSearchParams.created === "1";
  const savedMessage = resolvedSearchParams.saved === "1";
  const hasError = resolvedSearchParams.error === "missing-fields";

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Survey editor"
        title={activeTranslations?.survey_title?.trim() || survey.name}
        description="Refine the survey settings here before moving into the question and mapping design."
        actions={
          <div className="button-row">
            <Link href={appRoutes.surveyDetail(survey.id)} className="button button--ghost">
              Open overview
            </Link>
            <Link
              href={appRoutes.surveyAnalytics(survey.id)}
              className="button button--primary"
            >
              Open review
            </Link>
          </div>
        }
      />

      {createdMessage ? (
        <div className="notice notice--info" role="status">
          Survey created. Continue with the editor below.
        </div>
      ) : null}

      {savedMessage ? (
        <div className="notice notice--info" role="status">
          Survey settings saved.
        </div>
      ) : null}

      {hasError ? (
        <div className="notice notice--error" role="alert">
          Survey name and default language are required.
        </div>
      ) : null}

      <section className="content-grid content-grid--editor">
        <article className="surface-card">
          <h2>Survey settings</h2>
          <form action={updateSurveySettingsAction} className="stack-form">
            <input type="hidden" name="surveyId" value={survey.id} />

            <label className="field">
              <span>Internal name</span>
              <input name="name" defaultValue={survey.name} required />
            </label>

            <label className="field">
              <span>Survey title</span>
              <input
                name="surveyTitle"
                defaultValue={activeTranslations?.survey_title ?? ""}
                placeholder="Title shown to respondents"
              />
            </label>

            <label className="field">
              <span>Description</span>
              <textarea
                name="surveyDescription"
                defaultValue={activeTranslations?.survey_description ?? ""}
                rows={4}
                placeholder="Short introduction or context for this survey"
              />
            </label>

            <label className="field">
              <span>Default language</span>
              <select
                name="defaultLanguage"
                defaultValue={survey.default_language}
                required
              >
                {surveyLanguageOptions.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>Supported languages</span>
              <div className="chip-grid">
                {surveyLanguageOptions.map((language) => (
                  <label key={language} className="choice-chip">
                    <input
                      type="checkbox"
                      name="supportedLanguages"
                      value={language}
                      defaultChecked={survey.supported_languages.includes(language)}
                    />
                    <span>{language}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="button-row">
              <button type="submit" className="button button--primary">
                Save survey settings
              </button>
              <Link href={appRoutes.surveyDetail(survey.id)} className="button button--ghost">
                Cancel
              </Link>
            </div>
          </form>
        </article>

        <article className="surface-card">
          <h2>Structure overview</h2>
          <div className="stack-list">
            <div className="analytics-row">
              <strong>Status</strong>
              <span>{survey.status}</span>
            </div>
            <div className="analytics-row">
              <strong>Questions</strong>
              <span>{survey.definition_json.questions.length}</span>
            </div>
            <div className="analytics-row">
              <strong>Mappings</strong>
              <span>{survey.mapping_contract_json.mappings.length}</span>
            </div>
            <div className="analytics-row">
              <strong>Languages</strong>
              <span>{survey.supported_languages.join(", ")}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="surface-card">
        <div className="editor-section__header">
          <div>
            <h2>Questions</h2>
            <p>
              This section will become the survey builder. For now, the editor
              already manages the survey metadata and language setup.
            </p>
          </div>
        </div>

        {survey.definition_json.questions.length > 0 ? (
          <QuestionList
            questions={survey.definition_json.questions
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((question) => {
                const questionTranslations =
                  activeTranslations?.questions[question.question_key];

                return {
                  id: question.question_key,
                  key: question.question_key,
                  title: questionTranslations?.title?.trim() || question.question_key,
                  description: questionTranslations?.description?.trim() || "",
                  type: question.type.replaceAll("_", " "),
                  required: question.required,
                };
              })}
          />
        ) : (
          <div className="empty-state empty-state--inline">
            <h3>No questions yet</h3>
            <p>
              The survey shell is ready. The next design step is to define the
              question model and how questions should be composed inside this editor.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
