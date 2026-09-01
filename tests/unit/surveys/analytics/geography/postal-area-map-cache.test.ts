import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { geoArea } from "d3-geo";
import { feature } from "topojson-client";
import {
  clearCountryMapDataCache,
  loadCountryMapData,
  sanitizePostalAreaFeatures,
} from "@/app/(app)/surveys/[surveyId]/analytics-v2/postal-area-map-cache";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "public", "geography", "postal-areas", "v1");

afterEach(() => {
  clearCountryMapDataCache();
  vi.unstubAllGlobals();
});

function stubTopology(fileName: string) {
  const topology = JSON.parse(readFileSync(path.join(OUTPUT_DIR, fileName), "utf8"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => topology,
    })),
  );
  return topology;
}

describe("postal area map cache", () => {
  it("loads and projects each country only once", async () => {
    stubTopology("IE.topo.json");

    const first = loadCountryMapData("IE");
    const second = loadCountryMapData("IE");

    expect(first).toBe(second);
    const resolved = await first;
    expect(resolved.shapes.length).toBeGreaterThan(0);
  });

  it("rewinds inverted Spanish rings so the map frames Spain instead of the globe", async () => {
    const topology = stubTopology("ES.topo.json");
    const collection = feature(topology as never, topology.objects.postalAreas as never) as unknown as {
      features: Array<{
        type: "Feature";
        properties: { areaKey: string; label: string; postalPrefix: string };
        geometry: object;
      }>;
    };
    const invertedBefore = collection.features.filter((entry) => geoArea(entry as never) > 1);
    expect(invertedBefore.map((entry) => entry.properties.label).sort()).toEqual([
      "Bizkaia",
      "Girona",
      "Santa Cruz de Tenerife",
    ]);

    const sanitized = sanitizePostalAreaFeatures(collection.features);
    expect(sanitized.every((entry) => geoArea(entry as never) <= 0.01)).toBe(true);

    const resolved = await loadCountryMapData("ES");
    expect(resolved.shapes).toHaveLength(52);
    expect(resolved.shapes.some((shape) => shape.label === "Madrid")).toBe(true);
    expect(resolved.shapes.some((shape) => shape.label === "Barcelona")).toBe(true);
    expect(resolved.shapes.some((shape) => shape.label === "Bizkaia")).toBe(true);
  });
});
