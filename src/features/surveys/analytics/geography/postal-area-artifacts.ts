import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupportedPostalAreaCountryCode } from "./postal-area-key";

type PostalAreaFeatureProperties = {
  areaKey: string;
  countryCode: SupportedPostalAreaCountryCode;
  postalPrefix: string;
  label: string;
  scheme: "postal_prefix" | "eircode_routing_key";
};

type ManifestEntry = {
  countryCode: string;
  version: string;
  sourceUrl: string;
  sourceDataset: string;
  retrievedAt: string;
  sourceSha256: string;
  sourceCrs: string;
  targetCrs: "EPSG:4326";
  featureCount: number;
  license: string;
  attribution: string;
};

type PostalAreaIndexFile = {
  version: string;
  countries: Record<SupportedPostalAreaCountryCode, PostalAreaFeatureProperties[]>;
};

const POSTAL_GEOGRAPHY_VERSION = "v1";
const BASE_DIR = path.join(process.cwd(), "public", "geography", "postal-areas", POSTAL_GEOGRAPHY_VERSION);

const manifestCache = new Map<string, ManifestEntry[]>();
const indexCache = new Map<string, PostalAreaIndexFile>();
const keySetCache = new Map<SupportedPostalAreaCountryCode, Set<string>>();

function readJsonFile<T>(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function getPostalGeographyVersion() {
  return POSTAL_GEOGRAPHY_VERSION;
}

export function readPostalGeographyManifest() {
  const cached = manifestCache.get(POSTAL_GEOGRAPHY_VERSION);
  if (cached) {
    return cached;
  }
  const manifest = readJsonFile<ManifestEntry[]>(path.join(BASE_DIR, "manifest.json"));
  manifestCache.set(POSTAL_GEOGRAPHY_VERSION, manifest);
  return manifest;
}

function readPostalAreaIndex() {
  const cached = indexCache.get(POSTAL_GEOGRAPHY_VERSION);
  if (cached) {
    return cached;
  }
  const index = readJsonFile<PostalAreaIndexFile>(path.join(BASE_DIR, "postal-area-index.json"));
  indexCache.set(POSTAL_GEOGRAPHY_VERSION, index);
  return index;
}

export function readPostalAreaProperties(countryCode: SupportedPostalAreaCountryCode) {
  return readPostalAreaIndex().countries[countryCode];
}

export function readSupportedPostalAreaKeys(countryCode: SupportedPostalAreaCountryCode) {
  const cached = keySetCache.get(countryCode);
  if (cached) {
    return cached;
  }
  const created = new Set(readPostalAreaProperties(countryCode).map((entry) => entry.areaKey));
  keySetCache.set(countryCode, created);
  return created;
}
