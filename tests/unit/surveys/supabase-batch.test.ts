import { describe, expect, it, vi } from "vitest";
import {
  chunkIds,
  formatPostgrestError,
  isCancelledPostgrestError,
  readExactCount,
  selectAllPages,
  selectByIds,
} from "@/features/surveys/supabase-batch";

describe("supabase batch helpers", () => {
  it("chunks identifiers into bounded IN filters", () => {
    const ids = Array.from({ length: 450 }, (_, index) => `id-${index}`);

    expect(chunkIds(ids, 200)).toEqual([
      ids.slice(0, 200),
      ids.slice(200, 400),
      ids.slice(400),
    ]);
  });

  it("loads every identifier chunk in order", async () => {
    const ids = ["a", "b", "c", "d", "e"];
    const loadChunk = vi.fn(async (chunk: string[]) => chunk.map((id) => ({ id })));

    const rows = await selectByIds(ids, loadChunk, 2);

    expect(loadChunk).toHaveBeenCalledTimes(3);
    expect(rows.map((row) => row.id)).toEqual(ids);
  });

  it("pages until a short page is returned so default row caps cannot truncate the set", async () => {
    const pages = [
      Array.from({ length: 1000 }, (_, index) => index),
      Array.from({ length: 1 }, () => 1000),
    ];
    const loadPage = vi.fn(async (from: number) => {
      if (from === 0) {
        return pages[0];
      }
      if (from === 1000) {
        return pages[1];
      }
      return [];
    });

    const rows = await selectAllPages(loadPage, 1000);

    expect(loadPage).toHaveBeenCalledWith(0, 999);
    expect(loadPage).toHaveBeenCalledWith(1000, 1999);
    expect(rows).toHaveLength(1001);
  });

  it("prefers a numeric count even when PostgREST also returns an empty error", () => {
    expect(
      readExactCount(12, { message: "" }, "Failed to count survey responses"),
    ).toBe(12);
  });

  it("treats empty or aborted count errors as cancellation instead of an app failure", () => {
    expect(isCancelledPostgrestError({ message: "" })).toBe(true);
    expect(isCancelledPostgrestError({ message: "The user aborted a request" })).toBe(true);
    expect(formatPostgrestError({ message: "JWT expired", code: "PGRST301" })).toBe(
      "JWT expired — PGRST301",
    );

    expect(() =>
      readExactCount(null, { message: "" }, "Failed to count survey responses"),
    ).toThrowError(expect.objectContaining({ name: "AbortError" }));

    expect(() =>
      readExactCount(null, { message: "JWT expired", code: "PGRST301" }, "Failed to count survey responses"),
    ).toThrow("Failed to count survey responses: JWT expired — PGRST301");
  });
});
