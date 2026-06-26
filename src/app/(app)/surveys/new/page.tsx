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
        breadcrumbs={[
          { label: "Surveys", href: appRoutes.dashboard },
          { label: "New survey" },
        ]}
        eyebrow="New survey"
        title="Create a survey"
        description="Give the survey a name and choose its primary language. You can refine everything else in the editor."
      />

      <section className="content-grid content-grid--narrow">
        <article className="surface-card">
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
                autoFocus
              />
            </label>

            <label className="field">
              <span>Primary language</span>
              <select name="defaultLanguage" defaultValue="English" required>
                {surveyLanguageOptions.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </label>

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
      </section>
    </div>
  );
}
