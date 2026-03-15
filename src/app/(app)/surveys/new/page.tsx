import Link from "next/link";
import { createSurveyDraftAction } from "@/features/surveys/actions";
import { PageHeader } from "@/components/layout/page-header";
import { appRoutes } from "@/lib/config/routes";

const languageOptions = ["English", "Croatian", "French", "Spanish", "Italian"];

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
        description="Create a real draft in Supabase. This step only captures the survey shell so you can start editing immediately."
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
                {languageOptions.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>Supported languages</span>
              <div className="chip-grid">
                {languageOptions.map((language) => (
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
                Create draft in database
              </button>
              <Link href={appRoutes.surveys} className="button button--ghost">
                Cancel
              </Link>
            </div>
          </form>
        </article>

        <article className="surface-card">
          <h2>What happens next</h2>
          <p>
            When you submit this form, the application creates a real row in the
            `surveys` table and redirects you to the edit page for that draft.
          </p>

          <div className="callout-box">
            <strong>Current scope</strong>
            <p>
              Questions, ontology concepts, and advanced validation will come in
              the next phase. Right now we are creating the real persistent
              survey shell and removing the old placeholders.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
