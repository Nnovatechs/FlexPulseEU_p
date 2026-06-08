import { notFound } from "next/navigation";
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
    <main>
      <div className="sf-shell">
        <div className="sf-thankyou">
          <div className="sf-thankyou__icon" aria-hidden="true">✓</div>
          <p className="sf-thankyou__eyebrow">{copy.thankYouEyebrow}</p>
          <h1 className="sf-thankyou__title">{copy.thankYouTitle}</h1>
          <p className="sf-thankyou__sub">{copy.thankYouDescription}</p>
          <div className="sf-thankyou__card">
            <h3>{bundle?.survey_title ?? survey.name}</h3>
            <p>{copy.thankYouBody}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
