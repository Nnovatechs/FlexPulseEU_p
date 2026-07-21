const DEFAULT_RAW_LOCATION_RETENTION_HOURS = 72;
const MIN_RAW_LOCATION_RETENTION_HOURS = 1;
const MAX_RAW_LOCATION_RETENTION_HOURS = 30 * 24;

export function getRawLocationRetentionHours() {
  const rawValue = process.env.RAW_LOCATION_RETENTION_HOURS?.trim();

  if (!rawValue) {
    return DEFAULT_RAW_LOCATION_RETENTION_HOURS;
  }

  const hours = Number(rawValue);

  if (
    !Number.isInteger(hours) ||
    hours < MIN_RAW_LOCATION_RETENTION_HOURS ||
    hours > MAX_RAW_LOCATION_RETENTION_HOURS
  ) {
    throw new Error(
      `RAW_LOCATION_RETENTION_HOURS must be an integer between ${MIN_RAW_LOCATION_RETENTION_HOURS} and ${MAX_RAW_LOCATION_RETENTION_HOURS}.`,
    );
  }

  return hours;
}

export function getRawLocationRetentionLabel() {
  const hours = getRawLocationRetentionHours();

  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function buildRawLocationRetentionUntil(now = Date.now()) {
  const retentionMilliseconds = getRawLocationRetentionHours() * 60 * 60 * 1000;
  return new Date(now + retentionMilliseconds).toISOString();
}
