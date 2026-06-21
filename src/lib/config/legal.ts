import { appRoutes } from "./routes";

export type LegalConfig = {
  controllerName: string;
  controllerContactEmail: string;
  controllerCountry: string;
  processorName: string;
  privacyEmail: string;
  privacyUrl: string;
  cookiesUrl: string;
  consentVersion: string;
  privacyNoticeVersion: string;
  cookieNoticeVersion: string;
};

function getEnv(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

export const LEGAL_CONSENT_SOURCE = "public_survey_form";
const DEFAULT_LEGAL_NOTICE_VERSION = "d2-2026-06-21";

export function getLegalConfig(): LegalConfig {
  const controllerContactEmail = getEnv("LEGAL_CONTROLLER_CONTACT_EMAIL", "");
  const privacyEmail = getEnv("LEGAL_PRIVACY_EMAIL", controllerContactEmail);
  const consentVersion = getEnv("LEGAL_CONSENT_VERSION", DEFAULT_LEGAL_NOTICE_VERSION);

  return {
    controllerName: getEnv("LEGAL_CONTROLLER_NAME", "Survey operator"),
    controllerContactEmail,
    controllerCountry: getEnv("LEGAL_CONTROLLER_COUNTRY", "European Union"),
    processorName: getEnv("LEGAL_PROCESSOR_NAME", "FlexPulseEU"),
    privacyEmail,
    privacyUrl: getEnv("LEGAL_PRIVACY_URL", appRoutes.privacy),
    cookiesUrl: getEnv("LEGAL_COOKIES_URL", appRoutes.cookies),
    consentVersion,
    privacyNoticeVersion: getEnv("LEGAL_PRIVACY_NOTICE_VERSION", consentVersion),
    cookieNoticeVersion: getEnv("LEGAL_COOKIE_NOTICE_VERSION", consentVersion),
  };
}
