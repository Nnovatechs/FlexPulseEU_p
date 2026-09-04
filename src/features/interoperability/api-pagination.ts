import { API_DEFAULT_PAGE_LIMIT, API_MAX_JSON_BYTES, API_MAX_PAGE_LIMIT } from "./api-types";
import { invalidRequest, recordTooLarge } from "./api-errors";
import { measureJsonBytes } from "./api-response";

export function parsePageLimit(rawValue: string | null) {
  if (!rawValue) {
    return API_DEFAULT_PAGE_LIMIT;
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw invalidRequest("The limit parameter must be a positive integer.");
  }
  return Math.min(parsed, API_MAX_PAGE_LIMIT);
}

export function encodeCursor<T extends object>(value: T) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function quotePostgrestFilterValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildTimestampIdCursorFilter(input: {
  timestampColumn: string;
  timestamp: string;
  idColumn: string;
  id: string;
}) {
  const timestamp = quotePostgrestFilterValue(input.timestamp);
  const id = quotePostgrestFilterValue(input.id);
  return `${input.timestampColumn}.lt.${timestamp},and(${input.timestampColumn}.eq.${timestamp},${input.idColumn}.lt.${id})`;
}

export function decodeCursor<T>(rawValue: string | null, guard: (value: unknown) => value is T): T | null {
  if (!rawValue) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(rawValue, "base64url").toString("utf8")) as unknown;
    if (!guard(parsed)) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw invalidRequest("The cursor parameter is invalid.");
  }
}

export function shrinkItemsToFit<T>(input: {
  items: T[];
  sourceHasMore: boolean;
  buildEnvelope: (items: T[], meta: { nextCursor: string | null; hasMore: boolean }) => unknown;
  buildCursor: (lastItem: T) => string;
}) {
  if (input.items.length === 0) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  const singleEnvelope = input.buildEnvelope([input.items[0]], {
    nextCursor: input.sourceHasMore || input.items.length > 1 ? input.buildCursor(input.items[0]) : null,
    hasMore: input.sourceHasMore || input.items.length > 1,
  });
  if (measureJsonBytes(singleEnvelope) > API_MAX_JSON_BYTES) {
    throw recordTooLarge();
  }

  for (let size = input.items.length; size >= 1; size -= 1) {
    const sliced = input.items.slice(0, size);
    const hasMore = input.sourceHasMore || size < input.items.length;
    const nextCursor = hasMore ? input.buildCursor(sliced[sliced.length - 1]) : null;
    const envelope = input.buildEnvelope(sliced, { nextCursor, hasMore });
    if (measureJsonBytes(envelope) <= API_MAX_JSON_BYTES) {
      return {
        items: sliced,
        nextCursor,
        hasMore,
      };
    }
  }

  throw recordTooLarge();
}
