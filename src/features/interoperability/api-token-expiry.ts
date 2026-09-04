export function datetimeLocalToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
}
