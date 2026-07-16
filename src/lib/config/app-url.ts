const LOCAL_APP_URL = "http://localhost:3000";

export function getAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || LOCAL_APP_URL;
  const url = new URL(configuredUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use http or https.");
  }

  return url.origin;
}
