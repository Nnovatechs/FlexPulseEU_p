type TurnstileVerificationResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export function isTurnstileProtectionEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(token: string) {
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
