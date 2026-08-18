import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { feature } from "topojson-client";
import {
  readPostalAreaProperties,
  readPostalGeographyManifest,
} from "@/features/surveys/analytics/geography/postal-area-artifacts";

type TopologyGeometryCollection = {
  type: "Topology";
  objects: Record<string, { type: "GeometryCollection" }>;
};

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "public", "geography", "postal-areas", "v1");
const SOURCE_DIR = path.join(ROOT, "data", "geography", "sources", "v1");

function readJson<T>(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function sha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function flattenCoordinates(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) {
    return [];
  }
  if (value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    return [value as [number, number]];
  }
  return value.flatMap(flattenCoordinates);
}

function sampleCoordinates(coordinates: Array<[number, number]>) {
  if (coordinates.length <= 60) {
    return coordinates;
  }
  const sampled: Array<[number, number]> = [];
  const step = Math.max(1, Math.floor(coordinates.length / 60));
  for (let index = 0; index < coordinates.length; index += step) {
    sampled.push(coordinates[index]!);
  }
  sampled.push(coordinates[coordinates.length - 1]!);
  return sampled;
}

describe("postal geography artifacts", () => {
  it("keeps the manifest aligned with the generated artifacts and source hashes", () => {
    const manifest = readPostalGeographyManifest();
    const index = readJson<{
      version: string;
      countries: Record<"ES" | "FR" | "IE", Array<{ areaKey: string }>>;
    }>(path.join(OUTPUT_DIR, "postal-area-index.json"));
    expect(manifest.map((entry) => [entry.countryCode, entry.featureCount])).toEqual([
      ["ES", 52],
      ["FR", 106],
      ["IE", 139],
      ["EU", expect.any(Number)],
    ]);
    expect(index.version).toBe("v1");
    expect(index.countries.ES).toHaveLength(52);
    expect(index.countries.FR).toHaveLength(106);
    expect(index.countries.IE).toHaveLength(139);

    const sourceByCountry = new Map([
      ["ES", "es-lineas-limite-gml.zip"],
      ["FR", "fr-departements-1000m.geojson"],
      ["IE", "ie-eircode-area.json"],
      ["EU", "eu-countries-03m-4326.geojson"],
    ]);

    for (const entry of manifest) {
      const sourceName = sourceByCountry.get(entry.countryCode);
      expect(sourceName).toBeTruthy();
      expect(sha256(path.join(SOURCE_DIR, sourceName!))).toBe(entry.sourceSha256);
    }
  });

  it("builds the expected canonical keys for Ireland, Spain and France", () => {
    expect(readPostalAreaProperties("IE")).toHaveLength(139);
    expect(readPostalAreaProperties("ES")).toHaveLength(52);
    expect(readPostalAreaProperties("FR")).toHaveLength(106);

    const franceKeys = new Set(readPostalAreaProperties("FR").map((entry) => entry.areaKey));
    expect(franceKeys.has("FR:postal_area:20")).toBe(true);
    expect(franceKeys.has("FR:postal_area:2A")).toBe(false);
    expect(franceKeys.has("FR:postal_area:2B")).toBe(false);
    expect(franceKeys.has("FR:postal_area:980")).toBe(false);
    expect(franceKeys.has("FR:postal_area:989")).toBe(false);
  });

  it("keeps geometries non-empty and within EPSG:4326 bounds", { timeout: 15_000 }, () => {
    for (const fileName of ["ES.topo.json", "FR.topo.json", "IE.topo.json", "europe-outline.topo.json"]) {
      const topology = readJson<TopologyGeometryCollection>(path.join(OUTPUT_DIR, fileName));
      const objectName = Object.keys(topology.objects)[0]!;
      const collection = feature(topology as never, topology.objects[objectName] as never) as unknown as {
        features: Array<{ geometry: { coordinates: unknown; type: string } }>;
      };

      expect(collection.features.length).toBeGreaterThan(0);
      for (const item of collection.features) {
        const coordinates = sampleCoordinates(flattenCoordinates(item.geometry.coordinates));
        expect(coordinates.length).toBeGreaterThan(0);
        for (const [lon, lat] of coordinates) {
          expect(Number.isFinite(lon)).toBe(true);
          expect(Number.isFinite(lat)).toBe(true);
          expect(lon).toBeGreaterThanOrEqual(-180);
          expect(lon).toBeLessThanOrEqual(180);
          expect(lat).toBeGreaterThanOrEqual(-90);
          expect(lat).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it("preserves multi-part island geometries", () => {
    const spain = readJson<TopologyGeometryCollection>(path.join(OUTPUT_DIR, "ES.topo.json"));
    const spainFeatures = feature(spain as never, spain.objects.postalAreas as never) as unknown as {
      features: Array<{ properties: { areaKey: string }; geometry: { type: string } }>;
    };
    expect(
      spainFeatures.features.find((item) => item.properties.areaKey === "ES:postal_area:07")?.geometry.type,
    ).toBe("MultiPolygon");

    const france = readJson<TopologyGeometryCollection>(path.join(OUTPUT_DIR, "FR.topo.json"));
    const franceFeatures = feature(france as never, france.objects.postalAreas as never) as unknown as {
      features: Array<{ properties: { areaKey: string }; geometry: { type: string } }>;
    };
    expect(
      franceFeatures.features.find((item) => item.properties.areaKey === "FR:postal_area:20")?.geometry.type,
    ).toBe("MultiPolygon");
  });

  it("keeps official readable routing-area labels for Ireland", () => {
    const labels = new Map(readPostalAreaProperties("IE").map((entry) => [entry.areaKey, entry.label]));
    expect(labels.get("IE:postal_area:A63")).toBe("Greystones");
  });
});
