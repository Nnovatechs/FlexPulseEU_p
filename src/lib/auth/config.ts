export type SignupMode = "open" | "closed";

export function getSignupMode(): SignupMode {
  const configuredMode = process.env.SIGNUP_MODE?.trim().toLowerCase();

  if (configuredMode === "open" || configuredMode === "closed") {
    return configuredMode;
  }

  if (configuredMode) {
    throw new Error('SIGNUP_MODE must be either "open" or "closed".');
  }

  return process.env.VERCEL_ENV === "production" ? "closed" : "open";
}

export function isSignupEnabled() {
  return getSignupMode() === "open";
}
