import { describe, expect, it } from "vitest";
import { normalizePostalAreaKey } from "@/features/surveys/analytics/geography/postal-area-key";

describe("postal area key normalization", () => {
  it("normalizes Irish routing keys case-insensitively", () => {
    expect(normalizePostalAreaKey({ countryCode: "IE", rawCode: "d02" })).toMatchObject({
      status: "mapped",
      areaKey: "IE:postal_area:D02",
    });
    expect(normalizePostalAreaKey({ countryCode: "IE", rawCode: "D02 X285" })).toMatchObject({
      status: "mapped",
      areaKey: "IE:postal_area:D02",
    });
    expect(normalizePostalAreaKey({ countryCode: "IE", rawCode: "IE:postal_area:d02" })).toMatchObject({
      status: "mapped",
      areaKey: "IE:postal_area:D02",
    });
  });

  it("normalizes Spanish prefixes from current historical variants", () => {
    expect(normalizePostalAreaKey({ countryCode: "ES", rawCode: "28" })).toMatchObject({
      status: "mapped",
      areaKey: "ES:postal_area:28",
    });
    expect(normalizePostalAreaKey({ countryCode: "ES", rawCode: "28013" })).toMatchObject({
      status: "mapped",
      areaKey: "ES:postal_area:28",
    });
    expect(normalizePostalAreaKey({ countryCode: "ES", rawCode: "ES:postal_area:280" })).toMatchObject({
      status: "mapped",
      areaKey: "ES:postal_area:28",
    });
  });

  it("maps Corsica to a single French postal area and preserves supported overseas prefixes", () => {
    expect(normalizePostalAreaKey({ countryCode: "FR", rawCode: "20" })).toMatchObject({
      status: "mapped",
      areaKey: "FR:postal_area:20",
    });
    expect(normalizePostalAreaKey({ countryCode: "FR", rawCode: "2A" })).toMatchObject({
      status: "mapped",
      areaKey: "FR:postal_area:20",
    });
    expect(normalizePostalAreaKey({ countryCode: "FR", rawCode: "98714" })).toMatchObject({
      status: "mapped",
      areaKey: "FR:postal_area:987",
    });
  });

  it("returns unmapped for syntactically accepted but unsupported or excluded French prefixes", () => {
    expect(normalizePostalAreaKey({ countryCode: "FR", rawCode: "98000" })).toMatchObject({
      status: "unmapped",
      areaKey: null,
    });
    expect(normalizePostalAreaKey({ countryCode: "FR", rawCode: "98950" })).toMatchObject({
      status: "unmapped",
      areaKey: null,
    });
  });

  it("normalizes H90 consistently even though it stays unsupported by the V0 map catalog", () => {
    expect(normalizePostalAreaKey({ countryCode: "IE", rawCode: "H90" })).toMatchObject({
      status: "mapped",
      areaKey: "IE:postal_area:H90",
    });
  });
});
