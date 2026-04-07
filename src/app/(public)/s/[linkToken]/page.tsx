import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PublicSurveyForm } from "@/components/surveys/public-survey-form";
import { submitPublicSurveyResponseAction } from "@/features/surveys/public-actions";
import type { SurveyLanguageCode } from "@/features/surveys/generator-types";
import { getPublicSurveyCopy } from "@/features/surveys/public-copy";
import { getPublicSurveyRuntimeByLinkToken } from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

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
  const selectedLanguage =
    resolvedSearchParams.lang &&
    survey.supported_languages.includes(resolvedSearchParams.lang)
      ? resolvedSearchParams.lang
      : survey.default_language;
  const bundle =
    survey.definition_json.translations[selectedLanguage] ??
    survey.definition_json.translations[survey.default_language];
  const responseContext = survey.definition_json.survey_meta.response_context;
  const copy = getPublicSurveyCopy(selectedLanguage);

  return (
    <main className="public-survey-shell">
      <section className="public-survey-container">
        <PageHeader
          eyebrow={copy.openSurveyEyebrow}
          title={bundle?.survey_title ?? survey.name}
          description={
            bundle?.survey_description ?? copy.openSurveyDescription
          }
        />

        {survey.supported_languages.length > 1 ? (
          <nav className="preview-tab__lang-nav" aria-label="Survey language">
            {survey.supported_languages.map((language: SurveyLanguageCode) => (
              <Link
                key={language}
                href={`${appRoutes.publicSurveyLink(linkToken)}?lang=${encodeURIComponent(language)}`}
                className={`preview-tab__lang-tab${
                  selectedLanguage === language ? " preview-tab__lang-tab--active" : ""
                }`}
              >
                {language}
              </Link>
            ))}
          </nav>
        ) : null}

        {survey.definition_json.questions.length > 0 ? (
          <PublicSurveyForm
            linkToken={linkToken}
            selectedLanguage={selectedLanguage}
            questions={survey.definition_json.questions}
            bundle={bundle}
            responseContext={responseContext}
            copy={copy}
            submitAction={submitPublicSurveyResponseAction}
          />
        ) : (
          <section className="surface-card">
            <div className="empty-state empty-state--inline">
              <h3>No questions available</h3>
              <p>This published survey does not expose any respondent questions yet.</p>
            </div>
          </section>
        )}

      </section>
    </main>
  );
}
