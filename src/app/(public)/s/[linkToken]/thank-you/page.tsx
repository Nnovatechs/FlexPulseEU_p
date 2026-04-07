import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getPublicSurveyCopy } from "@/features/surveys/public-copy";
import { getPublicSurveyRuntimeByLinkToken } from "@/features/surveys/use-cases";

type PublicSurveyThankYouPageProps = {
  params: Promise<{ linkToken: string }>;
  searchParams?: Promise<{ lang?: string }>;
};

export default async function PublicSurveyThankYouPage({
  params,
  searchParams,
}: PublicSurveyThankYouPageProps) {
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
  const copy = getPublicSurveyCopy(selectedLanguage);

  return (
    <main className="public-survey-shell">
      <section className="public-survey-container">
        <PageHeader
          eyebrow={copy.thankYouEyebrow}
          title={copy.thankYouTitle}
          description={copy.thankYouDescription}
        />

        <section className="surface-card public-thank-you">
          <h2>{bundle?.survey_title ?? survey.name}</h2>
          <p>{copy.thankYouBody}</p>
          <p className="muted">{copy.thankYouProcessing}</p>
        </section>
      </section>
    </main>
  );
}
