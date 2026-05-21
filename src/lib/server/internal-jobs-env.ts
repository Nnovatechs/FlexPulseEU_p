export function getInternalJobSecret() {
  const value = process.env.INTERNAL_JOB_SECRET;

  if (!value) {
    throw new Error("Missing required environment variable: INTERNAL_JOB_SECRET");
  }

  return value;
}
