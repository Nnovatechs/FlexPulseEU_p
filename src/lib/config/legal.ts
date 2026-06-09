import { appRoutes } from "./routes";

export type LegalConfig = {
  controllerName: string;
  controllerContactEmail: string;
  controllerCountry: string;
  processorName: string;
  privacyEmail: string;
  privacyUrl: string;
  cookiesUrl: string;
};

function getEnv(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

export function getLegalConfig(): LegalConfig {
  const controllerContactEmail = getEnv("LEGAL_CONTROLLER_CONTACT_EMAIL", "");
  const privacyEmail = getEnv("LEGAL_PRIVACY_EMAIL", controllerContactEmail);

  return {
    controllerName: getEnv("LEGAL_CONTROLLER_NAME", "Survey operator"),
    controllerContactEmail,
    controllerCountry: getEnv("LEGAL_CONTROLLER_COUNTRY", "European Union"),
    processorName: getEnv("LEGAL_PROCESSOR_NAME", "FlexPulseEU"),
    privacyEmail,
    privacyUrl: getEnv("LEGAL_PRIVACY_URL", appRoutes.privacy),
    cookiesUrl: getEnv("LEGAL_COOKIES_URL", appRoutes.cookies),
  };
}
