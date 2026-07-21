type TurnstileVerificationResponse = {
  success: boolean;
  "error-codes"?: string[];
};

function isTurnstileRequired() {
  const explicitRequirement = process.env.TURNSTILE_REQUIRED?.trim().toLowerCase();

  return (
    process.env.VERCEL_ENV === "production" ||
    explicitRequirement === "1" ||
    explicitRequirement === "true"
  );
}

export function isTurnstileProtectionEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY,
  );
}

export function getTurnstileSiteKey() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (isTurnstileRequired() && (!siteKey || !secretKey)) {
    throw new Error(
      "Turnstile protection is required but both Turnstile keys are not configured.",
    );
  }

  return siteKey && secretKey ? siteKey : undefined;
}

export async function verifyTurnstileToken(token: string) {
  getTurnstileSiteKey();

  if (!isTurnstileProtectionEnabled()) {
    return;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return;
  }

  if (!token.trim()) {
    throw new Error("Turnstile verification is required.");
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body,
    },
  );

  if (!response.ok) {
    throw new Error("Turnstile verification could not be completed.");
  }

  const result = (await response.json()) as TurnstileVerificationResponse;
  if (!result.success) {
    throw new Error("Turnstile verification failed.");
  }
}
