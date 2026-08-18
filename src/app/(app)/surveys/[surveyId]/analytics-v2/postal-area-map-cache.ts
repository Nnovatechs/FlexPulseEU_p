"use client";

import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";

export type CountryCode = "ES" | "FR" | "IE";

export type CountryMapShape = {
  areaKey: string;
  label: string;
  postalPrefix: string;
  path: string;
};

export type CountryMapData = {
  countryCode: CountryCode;
  shapes: CountryMapShape[];
  viewBox: string;
};

type TopologyPayload = {
  type: "Topology";
  objects: {
    postalAreas: object;
  };
};

const countryMapPromiseCache = new Map<CountryCode, Promise<CountryMapData>>();

async function buildCountryMapData(countryCode: CountryCode): Promise<CountryMapData> {
  const response = await fetch(`/geography/postal-areas/v1/${countryCode}.topo.json`);
  if (!response.ok) {
    throw new Error(`Could not load ${countryCode} postal geometry.`);
  }
  const topology = (await response.json()) as TopologyPayload;
  const collection = feature(topology as never, topology.objects.postalAreas as never) as unknown as {
    features: Array<{
      properties: {
        areaKey: string;
        label: string;
        postalPrefix: string;
      };
      geometry: object;
    }>;
  };
  const width = 640;
  const height = countryCode === "FR" ? 520 : 420;
  const projection = geoMercator().fitExtent(
    [
      [14, 14],
      [width - 14, height - 14],
    ],
    collection as never,
  );
  const pathGenerator = geoPath(projection);
  return {
    countryCode,
    viewBox: `0 0 ${width} ${height}`,
    shapes: collection.features
      .map((entry) => ({
        areaKey: entry.properties.areaKey,
        label: entry.properties.label,
        postalPrefix: entry.properties.postalPrefix,
        path: pathGenerator(entry as never) ?? "",
      }))
      .filter((entry) => entry.path.length > 0),
  };
}

export function loadCountryMapData(countryCode: CountryCode) {
  const cached = countryMapPromiseCache.get(countryCode);
  if (cached) {
    return cached;
  }
  const created = buildCountryMapData(countryCode);
  countryMapPromiseCache.set(countryCode, created);
  return created;
}

export function clearCountryMapDataCache() {
  countryMapPromiseCache.clear();
}
