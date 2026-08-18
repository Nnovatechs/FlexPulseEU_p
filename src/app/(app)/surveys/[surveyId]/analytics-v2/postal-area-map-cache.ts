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

type CountryFeature = {
  type: "Feature";
  properties: {
    areaKey: string;
    label: string;
    postalPrefix: string;
  };
  geometry: object;
};

type Frame = [[number, number], [number, number]];

type TopologyPayload = {
  type: "Topology";
  objects: {
    postalAreas: object;
  };
};

const countryMapPromiseCache = new Map<CountryCode, Promise<CountryMapData>>();

function projectShapes(features: CountryFeature[], frame: Frame) {
  if (features.length === 0) {
    return [];
  }
  const projection = geoMercator().fitExtent(frame, {
    type: "FeatureCollection",
    features,
  } as never);
  const pathGenerator = geoPath(projection);
  return features
    .map((entry) => ({
      areaKey: entry.properties.areaKey,
      label: entry.properties.label,
      postalPrefix: entry.properties.postalPrefix,
      path: pathGenerator(entry as never) ?? "",
    }))
    .filter((entry) => entry.path.length > 0);
}

function buildFranceInsetFrames(): Frame[] {
  const frames: Frame[] = [];
  const cellWidth = 88;
  const cellHeight = 64;
  const gap = 12;
  const startX = 438;
  const startY = 18;
  for (let index = 0; index < 12; index += 1) {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = startX + column * (cellWidth + gap);
    const y = startY + row * (cellHeight + gap);
    frames.push([
      [x, y],
      [x + cellWidth, y + cellHeight],
    ]);
  }
  return frames;
}

function buildFranceMapData(features: CountryFeature[]): CountryMapData {
  const width = 640;
  const height = 520;
  const mainland = features.filter((entry) => entry.properties.postalPrefix.length === 2);
  const overseas = features
    .filter((entry) => entry.properties.postalPrefix.length === 3)
    .sort((left, right) => left.properties.postalPrefix.localeCompare(right.properties.postalPrefix));
  const shapes = [
    ...projectShapes(mainland, [
      [14, 24],
      [420, height - 18],
    ]),
  ];
  const frames = buildFranceInsetFrames();
  overseas.forEach((feature, index) => {
    const frame = frames[index];
    if (!frame) {
      return;
    }
    shapes.push(...projectShapes([feature], frame));
  });
  return {
    countryCode: "FR",
    viewBox: `0 0 ${width} ${height}`,
    shapes,
  };
}

async function buildCountryMapData(countryCode: CountryCode): Promise<CountryMapData> {
  const response = await fetch(`/geography/postal-areas/v1/${countryCode}.topo.json`);
  if (!response.ok) {
    throw new Error(`Could not load ${countryCode} postal geometry.`);
  }
  const topology = (await response.json()) as TopologyPayload;
  const collection = feature(topology as never, topology.objects.postalAreas as never) as unknown as {
    features: CountryFeature[];
  };
  if (countryCode === "FR") {
    return buildFranceMapData(collection.features);
  }
  const width = 640;
  const height = 420;
  return {
    countryCode,
    viewBox: `0 0 ${width} ${height}`,
    shapes: projectShapes(collection.features, [
      [14, 14],
      [width - 14, height - 14],
    ]),
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
