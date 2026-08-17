export const SEGMENT_CELL_MIN_N = 5;

export type SegmentCellDisclosure = "visible" | "suppressed";

export function isSmallIdentifiableCount(n: number) {
  return n > 0 && n < SEGMENT_CELL_MIN_N;
}

export function suppressSegmentBreakdown(selectedN: number) {
  return isSmallIdentifiableCount(selectedN);
}

export function applyExclusiveCellDisclosure(cells: Array<{ key: string; count: number }>) {
  const suppressed = new Set<string>();
  for (const cell of cells) {
    if (isSmallIdentifiableCount(cell.count)) {
      suppressed.add(cell.key);
    }
  }

  const visiblePositive = cells.filter((cell) => cell.count > 0 && !suppressed.has(cell.key));
  if (suppressed.size > 0 && visiblePositive.length === 1) {
    suppressed.add(visiblePositive[0].key);
  }

  return suppressed;
}

export function discloseExclusiveCounts(
  cells: Array<{ key: string; count: number }>,
  selectedN: number,
) {
  if (suppressSegmentBreakdown(selectedN)) {
    return new Set(cells.map((cell) => cell.key));
  }
  return applyExclusiveCellDisclosure(cells);
}
