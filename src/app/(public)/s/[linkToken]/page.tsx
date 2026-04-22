import { notFound } from "next/navigation";
import { PublicSurveyForm } from "@/components/surveys/public-survey-form";
import { submitPublicSurveyResponseAction } from "@/features/surveys/public-actions";
import { getPublicSurveyCopy } from "@/features/surveys/public-copy";
import { getPublicSurveyRuntimeByLinkToken } from "@/features/surveys/use-cases";

type PublicSurveyLinkPageProps = {
  params: Promise<{ linkToken: string }>;
  searchParams?: Promise<{ lang?: string }>;
};

export default async function PublicSurveyLinkPage({
  params,
  searchParams,
}: PublicSurveyLinkPageProps) {
  const { linkToken } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const runtime = await getPublicSurveyRuntimeByLinkToken(linkToken);

  if (!runtime) {
    notFound();
  }

  const { survey } = runtime;

  const hasExplicitLangParam = Boolean(
    resolvedSearchParams.lang &&
      survey.supported_languages.includes(resolvedSearchParams.lang),
  );
  const initialLanguage = hasExplicitLangParam
    ? (resolvedSearchParams.lang as string)
    : survey.default_language;

  const responseContext = survey.definition_json.survey_meta.response_context;

  const allBundles = survey.definition_json.translations;
  const allCopy = Object.fromEntries(
    survey.supported_languages.map((lang) => [lang, getPublicSurveyCopy(lang)]),
  );

  return (
    <main>
      {survey.definition_json.questions.length > 0 ? (
        <PublicSurveyForm
          linkToken={linkToken}
          defaultLanguage={survey.default_language}
          initialLanguage={initialLanguage}
          hasExplicitLangParam={hasExplicitLangParam}
          supportedLanguages={survey.supported_languages}
          questions={survey.definition_json.questions}
          allBundles={allBundles}
          allCopy={allCopy}
          responseContext={responseContext}
          submitAction={submitPublicSurveyResponseAction}
        />
      ) : (
        <div className="sf-shell">
          <div className="sf-container">
            <section className="surface-card">
              <div className="empty-state empty-state--inline">
                <h3>No questions available</h3>
                <p>This published survey does not expose any respondent questions yet.</p>
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
