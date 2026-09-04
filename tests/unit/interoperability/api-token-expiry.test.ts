import { describe, expect, it } from "vitest";
import { datetimeLocalToIso } from "@/features/interoperability/api-token-expiry";

describe("datetimeLocalToIso", () => {
  it("returns an empty string when the field is blank", () => {
    expect(datetimeLocalToIso("")).toBe("");
    expect(datetimeLocalToIso("   ")).toBe("");
  });

  it("keeps an explicit UTC instant", () => {
    expect(datetimeLocalToIso("2026-09-03T16:00:00.000Z")).toBe("2026-09-03T16:00:00.000Z");
  });

  it("turns a datetime-local value into a real ISO instant", () => {
    const iso = datetimeLocalToIso("2026-09-03T18:00");
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
    expect(iso.endsWith("Z")).toBe(true);
  });
});
