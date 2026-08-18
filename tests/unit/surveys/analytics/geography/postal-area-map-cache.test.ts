import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCountryMapDataCache,
  loadCountryMapData,
} from "@/app/(app)/surveys/[surveyId]/analytics-v2/postal-area-map-cache";

const ROOT = process.cwd();

afterEach(() => {
  clearCountryMapDataCache();
  vi.unstubAllGlobals();
});

describe("postal area map cache", () => {
  it("loads and projects each country only once", async () => {
    const topology = JSON.parse(
      readFileSync(path.join(ROOT, "public", "geography", "postal-areas", "v1", "IE.topo.json"), "utf8"),
    );
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => topology,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = loadCountryMapData("IE");
    const second = loadCountryMapData("IE");

    expect(first).toBe(second);
    const resolved = await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolved.shapes.length).toBeGreaterThan(0);
  });
});
