import { createSurveyDraftAction } from "@/features/surveys/actions";
import { surveyLanguageOptions } from "@/features/surveys/language-options";
import { PageHeader } from "@/components/layout/page-header";
import { PendingNavLink } from "@/components/pending-nav-link";
import {
  FormPendingOverlay,
  PendingSubmitButton,
} from "@/components/pending-view-overlay";
import { creatingSurveyCopy } from "@/lib/navigation/pending-navigation";
import { appRoutes } from "@/lib/config/routes";

type NewSurveyPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function NewSurveyPage({ searchParams }: NewSurveyPageProps) {
  const params = (await searchParams) ?? {};
  const error = params.error;
  const hasMissingFieldsError = error === "missing-fields";
  const hasUnsupportedLanguageError = error === "unsupported-language";

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
          {hasMissingFieldsError ? (
            <p className="notice notice--error">
              Survey name and default language are required.
            </p>
          ) : null}
          {hasUnsupportedLanguageError ? (
            <p className="notice notice--error">
              The submitted language selection is not supported. Reload the page
              and select a language again.
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
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>

            <div className="button-row">
              <PendingSubmitButton className="button button--primary">
                Create survey
              </PendingSubmitButton>
              <PendingNavLink href={appRoutes.surveys} className="button button--ghost">
                Cancel
              </PendingNavLink>
            </div>
            <FormPendingOverlay
              title={creatingSurveyCopy.title}
              description={creatingSurveyCopy.description}
            />
          </form>
        </article>
      </section>
    </div>
  );
}
