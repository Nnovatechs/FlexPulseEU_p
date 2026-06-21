export function getInternalJobSecret() {
  const value = process.env.INTERNAL_JOB_SECRET;

  if (!value) {
    throw new Error("Missing required environment variable: INTERNAL_JOB_SECRET");
  }

  return value;
}

export function getInternalJobSecrets() {
  const values = [
    process.env.INTERNAL_JOB_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value));

  if (values.length === 0) {
    throw new Error("Missing required environment variable: INTERNAL_JOB_SECRET or CRON_SECRET");
  }

  return Array.from(new Set(values));
}
