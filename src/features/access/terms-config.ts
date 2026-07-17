export const TERMS_DOCUMENT_VERSION = "1.0";

export function isTermsAcceptanceRequired() {
  const configuredValue = process.env.TERMS_REQUIRED?.trim().toLowerCase();
  return configuredValue === "1" || configuredValue === "true";
}
