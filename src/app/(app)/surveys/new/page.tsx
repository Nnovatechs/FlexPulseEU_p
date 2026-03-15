import Link from "next/link";
import { createSurveyDraftAction } from "@/features/surveys/actions";
import { surveyLanguageOptions } from "@/features/surveys/language-options";
import { PageHeader } from "@/components/layout/page-header";
import { appRoutes } from "@/lib/config/routes";

type NewSurveyPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function NewSurveyPage({ searchParams }: NewSurveyPageProps) {
  const params = (await searchParams) ?? {};
  const hasError = params.error === "missing-fields";

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Survey setup"
        title="Create a new survey"
        description="Start with the survey name and languages, then continue in the editor."
      />

      <section className="content-grid content-grid--form">
        <article className="surface-card">
          <h2>Draft definition</h2>
          {hasError ? (
            <p className="notice notice--error">
              Survey name and default language are required.
            </p>
          ) : null}

          <form action={createSurveyDraftAction} className="stack-form">
            <label className="field">
              <span>Survey name</span>
              <input
                name="name"
                placeholder="e.g. Household flexibility baseline"
                required
              />
            </label>

            <label className="field">
              <span>Default language</span>
              <select name="defaultLanguage" defaultValue="English" required>
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
                      defaultChecked={language === "English" || language === "Spanish"}
                    />
                    <span>{language}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="button-row">
              <button type="submit" className="button button--primary">
                Create survey
              </button>
              <Link href={appRoutes.surveys} className="button button--ghost">
                Cancel
              </Link>
            </div>
          </form>
        </article>

        <article className="surface-card">
          <h2>Next step</h2>
          <p>
            After this step, you will land in the survey editor to refine the
            title, description, languages, and survey structure.
          </p>

          <div className="callout-box">
            <strong>Initial setup</strong>
            <p>
              This first screen only sets the survey shell. The editor is where
              the working survey will take shape.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
