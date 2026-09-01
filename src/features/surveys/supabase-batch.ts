export const SUPABASE_IN_FILTER_CHUNK = 200;
export const SUPABASE_PAGE_SIZE = 1000;

export type PostgrestCountError = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function formatPostgrestError(error: PostgrestCountError): string {
  return [error.message, error.code, error.details, error.hint]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" — ");
}

export function isCancelledPostgrestError(error: PostgrestCountError | null): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").trim().toLowerCase();
  return (
    message === "" ||
    message.includes("abort") ||
    message === "failed to fetch" ||
    message.includes("fetch failed")
  );
}

export function readExactCount(
  count: number | null,
  error: PostgrestCountError | null,
  fallbackMessage: string,
): number {
  if (typeof count === "number") {
    return count;
  }

  if (!error) {
    return 0;
  }

  if (isCancelledPostgrestError(error)) {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    throw abortError;
  }

  const detail = formatPostgrestError(error);
  throw new Error(detail ? `${fallbackMessage}: ${detail}` : fallbackMessage);
}

export function chunkIds(ids: string[], size = SUPABASE_IN_FILTER_CHUNK): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

export async function selectByIds<T>(
  ids: string[],
  loadChunk: (chunk: string[]) => Promise<T[]>,
  chunkSize = SUPABASE_IN_FILTER_CHUNK,
): Promise<T[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows: T[] = [];
  for (const chunk of chunkIds(ids, chunkSize)) {
    rows.push(...(await loadChunk(chunk)));
  }
  return rows;
}

export async function selectAllPages<T>(
  loadPage: (from: number, to: number) => Promise<T[]>,
  pageSize = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const page = await loadPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return rows;
}
