export const SUPABASE_IN_FILTER_CHUNK = 200;
export const SUPABASE_PAGE_SIZE = 1000;

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
