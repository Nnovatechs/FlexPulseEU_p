import { describe, expect, it } from "vitest";
import {
  buildTimestampIdCursorFilter,
  decodeCursor,
  encodeCursor,
  parsePageLimit,
  quotePostgrestFilterValue,
  shrinkItemsToFit,
} from "@/features/interoperability/api-pagination";

describe("postgrest cursor filters", () => {
  it("quotes ISO timestamps so reserved characters are not parsed as delimiters", () => {
    const timestamp = "2026-08-19T09:00:00.123+00:00";
    const id = "22222222-2222-4222-8222-222222222222";

    expect(quotePostgrestFilterValue(timestamp)).toBe(`"${timestamp}"`);
    expect(
      buildTimestampIdCursorFilter({
        timestampColumn: "responded_at",
        timestamp,
        idColumn: "id",
        id,
      }),
    ).toBe(
      `responded_at.lt."${timestamp}",and(responded_at.eq."${timestamp}",id.lt."${id}")`,
    );
  });
});

describe("page limits and cursors", () => {
  it("defaults limit to 50 and caps at 100", () => {
    expect(parsePageLimit(null)).toBe(50);
    expect(parsePageLimit("100")).toBe(100);
    expect(parsePageLimit("999")).toBe(100);
  });

  it("rejects non-positive limits", () => {
    try {
      parsePageLimit("0");
      throw new Error("expected invalid_request");
    } catch (error) {
      expect(error).toMatchObject({ code: "invalid_request", status: 400 });
    }
    try {
      parsePageLimit("nope");
      throw new Error("expected invalid_request");
    } catch (error) {
      expect(error).toMatchObject({ code: "invalid_request", status: 400 });
    }
  });

  it("round-trips a data cursor", () => {
    const cursor = {
      respondedAt: "2026-08-19T09:00:00.123+00:00",
      responseId: "22222222-2222-4222-8222-222222222222",
    };
    const encoded = encodeCursor(cursor);
    expect(
      decodeCursor(
        encoded,
        (value): value is typeof cursor =>
          typeof value === "object" &&
          value != null &&
          (value as { respondedAt?: unknown }).respondedAt === cursor.respondedAt &&
          (value as { responseId?: unknown }).responseId === cursor.responseId,
      ),
    ).toEqual(cursor);
  });

  it("keeps has_more and a cursor when a page is reduced to fit", () => {
    const items = [
      { id: "a", body: "one" },
      { id: "b", body: "two" },
    ];
    const fitted = shrinkItemsToFit({
      items,
      sourceHasMore: true,
      buildCursor: (item) => item.id,
      buildEnvelope: (page, meta) => ({ data: page, meta }),
    });
    expect(fitted.items).toEqual(items);
    expect(fitted.hasMore).toBe(true);
    expect(fitted.nextCursor).toBe("b");
  });
});
