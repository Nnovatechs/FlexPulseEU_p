import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import proj4 from "proj4";
import { XMLParser } from "fast-xml-parser";
import { topology } from "topojson-server";

type Position = [number, number];
type Ring = Position[];
type PolygonCoordinates = Ring[];
type MultiPolygonCoordinates = PolygonCoordinates[];

type GeoJsonGeometry =
  | { type: "Polygon"; coordinates: PolygonCoordinates }
  | { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates };

type PostalAreaFeatureProperties = {
  areaKey: string;
  countryCode: "ES" | "FR" | "IE";
  postalPrefix: string;
  label: string;
  scheme: "postal_prefix" | "eircode_routing_key";
};

type Feature = {
  type: "Feature";
  properties: PostalAreaFeatureProperties;
  geometry: GeoJsonGeometry;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

type GeographyManifestEntry = {
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

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "data", "geography", "sources", "v1");
const OUTPUT_DIR = path.join(ROOT, "public", "geography", "postal-areas", "v1");
const VERSION = "v1";
const XML_MAX_BUFFER = 1024 * 1024 * 512;

const SPAIN_SOURCE = {
  path: path.join(SOURCE_DIR, "es-lineas-limite-gml.zip"),
  url: "https://centrodedescargas.cnig.es/CentroDescargas/descargaDir",
  dataset: "CNIG Límites y Unidades Administrativas Actuales (GML)",
  retrievedAt: "2026-08-18T08:07:00.000Z",
  sourceCrs: "EPSG:4258",
  license: "CC BY 4.0 compatible IGN/CNIG licence",
  attribution: "© Organismo Autónomo Centro Nacional de Información Geográfica (CNIG)",
};

const FRANCE_SOURCE = {
  path: path.join(SOURCE_DIR, "fr-departements-1000m.geojson"),
  url: "https://etalab-datasets.geo.data.gouv.fr/contours-administratifs/2025/geojson/departements-1000m.geojson",
  dataset: "Contours administratifs 2025 départements 1000m",
  retrievedAt: "2026-08-18T08:08:00.000Z",
  sourceCrs: "EPSG:4326",
  license: "Licence Ouverte / Open Licence 2.0",
  attribution: "data.gouv.fr / IGN / INSEE",
};

const IRELAND_SOURCE = {
  path: path.join(SOURCE_DIR, "ie-eircode-area.json"),
  url: "https://cdn.cso.ie/static/map/en/eircode_area.json",
  dataset: "CSO Eircode routing areas",
  retrievedAt: "2026-08-18T08:08:30.000Z",
  sourceCrs: "EPSG:29903",
  license: "CSO copyright policy",
  attribution: "Central Statistics Office (CSO), Ireland",
};

const EUROPE_SOURCE = {
  path: path.join(SOURCE_DIR, "eu-countries-03m-4326.geojson"),
  url: "https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_03M_2024_4326.geojson",
  dataset: "Eurostat GISCO countries 2024 03M",
  retrievedAt: "2026-08-18T08:09:00.000Z",
  sourceCrs: "EPSG:4326",
  license: "Eurostat GISCO reuse rules",
  attribution: "Eurostat GISCO",
};

const FRANCE_THREE_DIGIT_ALLOWLIST = new Set([
  "971",
  "972",
  "973",
  "974",
  "975",
  "976",
  "977",
  "978",
  "986",
  "987",
  "988",
]);

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
});

proj4.defs(
  "EPSG:29903",
  "+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 +a=6377340.189 +rf=299.3249646 +units=m +no_defs",
);

function readJson<T>(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function sha256File(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function ensureDir(directory: string) {
  mkdirSync(directory, { recursive: true });
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function ensureClosedRing(ring: Ring) {
  if (ring.length === 0) {
    return ring;
  }
  const [firstLon, firstLat] = ring[0];
  const [lastLon, lastLat] = ring[ring.length - 1];
  if (firstLon === lastLon && firstLat === lastLat) {
    return ring;
  }
  return [...ring, ring[0]];
}

function parseLatLonPosList(posList: string): Ring {
  const parts = posList
    .trim()
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const ring: Ring = [];
  for (let index = 0; index < parts.length; index += 2) {
    const lat = parts[index];
    const lon = parts[index + 1];
    if (lon == null) {
      continue;
    }
    ring.push([lon, lat]);
  }
  return ensureClosedRing(ring);
}

function parseProjectedPosList(posList: string): Ring {
  const parts = posList
    .trim()
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const ring: Ring = [];
  for (let index = 0; index < parts.length; index += 2) {
    const x = parts[index];
    const y = parts[index + 1];
    if (y == null) {
      continue;
    }
    const [lon, lat] = proj4("EPSG:29903", "EPSG:4326", [x, y]) as [number, number];
    ring.push([lon, lat]);
  }
  return ensureClosedRing(ring);
}

function polygonFromGmlPolygon(polygon: {
  exterior?: { LinearRing?: { posList?: string } };
  interior?: Array<{ LinearRing?: { posList?: string } }> | { LinearRing?: { posList?: string } };
}): PolygonCoordinates {
  const exterior = polygon.exterior?.LinearRing?.posList;
  if (!exterior) {
    return [];
  }

  return [
    parseLatLonPosList(exterior),
    ...asArray(polygon.interior)
      .map((ring) => ring?.LinearRing?.posList)
      .filter((value): value is string => Boolean(value))
      .map(parseLatLonPosList),
  ];
}

function multiSurfaceToGeometry(multiSurface: {
  surfaceMember?: Array<{ Polygon?: unknown }> | { Polygon?: unknown };
}): GeoJsonGeometry {
  const polygons = asArray(multiSurface.surfaceMember)
    .map((member) => member?.Polygon)
    .filter(Boolean)
    .map((polygon) => polygonFromGmlPolygon(polygon as never))
    .filter((coords) => coords.length > 0);

  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}

function projectGeoJsonGeometry(geometry: {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}): GeoJsonGeometry {
  if (geometry.type === "Polygon") {
    const coordinates = geometry.coordinates as number[][][];
    return {
      type: "Polygon",
      coordinates: coordinates.map((ring) =>
        ensureClosedRing(ring.map(([x, y]) => proj4("EPSG:29903", "EPSG:4326", [x, y]) as Position)),
      ),
    };
  }

  const coordinates = geometry.coordinates as number[][][][];
  return {
    type: "MultiPolygon",
    coordinates: coordinates.map((polygon) =>
      polygon.map((ring) =>
        ensureClosedRing(ring.map(([x, y]) => proj4("EPSG:29903", "EPSG:4326", [x, y]) as Position)),
      ),
    ),
  };
}

function flattenToPolygons(geometry: { type: string; coordinates: unknown }): MultiPolygonCoordinates {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates as PolygonCoordinates];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates as MultiPolygonCoordinates;
  }
  return [];
}

function buildSpainFeatures(): FeatureCollection {
  const xml = execFileSync("unzip", ["-p", SPAIN_SOURCE.path, "au_AdministrativeUnit_3rdOrder0.gml"], {
    encoding: "utf8",
    maxBuffer: XML_MAX_BUFFER,
  });
  const data = XML_PARSER.parse(xml) as {
    FeatureCollection: {
      member: Array<{
        AdministrativeUnit: {
          nationalCode: string;
          name: { GeographicalName: { spelling: { SpellingOfName: { text: string } } } };
          geometry: { MultiSurface: { surfaceMember: unknown } };
        };
      }>;
    };
  };

  const features = data.FeatureCollection.member
    .map((member) => member.AdministrativeUnit)
    .map((unit) => {
      const label = unit.name.GeographicalName.spelling.SpellingOfName.text;
      const postalPrefix = String(unit.nationalCode).slice(4, 6);
      return {
        label,
        postalPrefix,
        geometry: multiSurfaceToGeometry(unit.geometry.MultiSurface as { surfaceMember?: { Polygon?: unknown }[] | { Polygon?: unknown } }),
      };
    })
    .filter((feature) => feature.postalPrefix !== "54")
    .map(
      (feature): Feature => ({
        type: "Feature",
        properties: {
          areaKey: `ES:postal_area:${feature.postalPrefix}`,
          countryCode: "ES",
          postalPrefix: feature.postalPrefix,
          label: feature.label,
          scheme: "postal_prefix",
        },
        geometry: feature.geometry,
      }),
    );

  return { type: "FeatureCollection", features };
}

function buildFranceFeatures(): FeatureCollection {
  const data = readJson<{
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: { code: string; nom: string };
      geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
    }>;
  }>(FRANCE_SOURCE.path);

  const corsicaPolygons: MultiPolygonCoordinates = [];
  const features: Feature[] = [];

  for (const sourceFeature of data.features) {
    const postalPrefix = String(sourceFeature.properties.code).toUpperCase();
    if (postalPrefix === "2A" || postalPrefix === "2B") {
      corsicaPolygons.push(...flattenToPolygons(sourceFeature.geometry));
      continue;
    }

    if (postalPrefix === "984" || postalPrefix === "989") {
      continue;
    }

    const isMetropolitan = /^\d{2}$/.test(postalPrefix);
    const isAllowedOverseas = FRANCE_THREE_DIGIT_ALLOWLIST.has(postalPrefix);
    if (!isMetropolitan && !isAllowedOverseas) {
      continue;
    }

    features.push({
      type: "Feature",
      properties: {
        areaKey: `FR:postal_area:${postalPrefix}`,
        countryCode: "FR",
        postalPrefix,
        label: sourceFeature.properties.nom,
        scheme: "postal_prefix",
      },
      geometry:
        sourceFeature.geometry.type === "Polygon"
          ? { type: "Polygon", coordinates: sourceFeature.geometry.coordinates as PolygonCoordinates }
          : { type: "MultiPolygon", coordinates: sourceFeature.geometry.coordinates as MultiPolygonCoordinates },
    });
  }

  features.push({
    type: "Feature",
    properties: {
      areaKey: "FR:postal_area:20",
      countryCode: "FR",
      postalPrefix: "20",
      label: "Corse",
      scheme: "postal_prefix",
    },
    geometry: { type: "MultiPolygon", coordinates: corsicaPolygons },
  });

  return {
    type: "FeatureCollection",
    features: features.sort((left, right) => left.properties.areaKey.localeCompare(right.properties.areaKey)),
  };
}

function buildIrelandFeatures(): FeatureCollection {
  const data = readJson<{
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: { AREA_ID: string; AREA_NAME?: string };
      geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
    }>;
  }>(IRELAND_SOURCE.path);

  return {
    type: "FeatureCollection",
    features: data.features
      .filter((feature) => feature.properties.AREA_ID !== "NI")
      .map(
        (feature): Feature => ({
          type: "Feature",
          properties: {
            areaKey: `IE:postal_area:${feature.properties.AREA_ID.toUpperCase()}`,
            countryCode: "IE",
            postalPrefix: feature.properties.AREA_ID.toUpperCase(),
            label:
              feature.properties.AREA_ID.toUpperCase() === feature.properties.AREA_NAME?.toUpperCase()
                ? feature.properties.AREA_ID.toUpperCase()
                : String(feature.properties.AREA_NAME ?? feature.properties.AREA_ID)
                    .split(":")
                    .slice(1)
                    .join(":")
                    .trim() || feature.properties.AREA_ID.toUpperCase(),
            scheme: "eircode_routing_key",
          },
          geometry: projectGeoJsonGeometry(feature.geometry),
        }),
      )
      .sort((left, right) => left.properties.areaKey.localeCompare(right.properties.areaKey)),
  };
}

function buildEuropeOutline() {
  const data = readJson<{
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: { CNTR_ID: string; NAME_ENGL: string };
      geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
    }>;
  }>(EUROPE_SOURCE.path);

  const features = data.features.filter((feature) => {
    const polygons = flattenToPolygons(feature.geometry);
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          if (lon >= -32 && lon <= 45 && lat >= 25 && lat <= 73) {
            return true;
          }
        }
      }
    }
    return false;
  });

  return {
    type: "FeatureCollection" as const,
    features: features.map((feature) => ({
      type: "Feature" as const,
      properties: {
        areaKey: feature.properties.CNTR_ID,
        countryCode: "ES" as const,
        postalPrefix: feature.properties.CNTR_ID,
        label: feature.properties.NAME_ENGL,
        scheme: "postal_prefix" as const,
      },
      geometry:
        feature.geometry.type === "Polygon"
          ? { type: "Polygon" as const, coordinates: feature.geometry.coordinates as PolygonCoordinates }
          : { type: "MultiPolygon" as const, coordinates: feature.geometry.coordinates as MultiPolygonCoordinates },
    })),
  };
}

function toTopology(collection: FeatureCollection, objectName: string) {
  return topology({ [objectName]: collection }, 1e5);
}

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function assertFeatureCollection(label: string, collection: FeatureCollection, expectedCount: number) {
  if (collection.features.length !== expectedCount) {
    throw new Error(`${label} feature count mismatch: expected ${expectedCount}, got ${collection.features.length}.`);
  }
  for (const feature of collection.features) {
    if (
      (feature.geometry.type === "Polygon" && feature.geometry.coordinates.length === 0) ||
      (feature.geometry.type === "MultiPolygon" && feature.geometry.coordinates.length === 0)
    ) {
      throw new Error(`${label} contains an empty geometry for ${feature.properties.areaKey}.`);
    }
  }
}

function main() {
  ensureDir(OUTPUT_DIR);

  const spain = buildSpainFeatures();
  const france = buildFranceFeatures();
  const ireland = buildIrelandFeatures();
  const europe = buildEuropeOutline();

  assertFeatureCollection("Spain", spain, 52);
  assertFeatureCollection("France", france, 106);
  assertFeatureCollection("Ireland", ireland, 139);

  writeJson(path.join(OUTPUT_DIR, "ES.topo.json"), toTopology(spain, "postalAreas"));
  writeJson(path.join(OUTPUT_DIR, "FR.topo.json"), toTopology(france, "postalAreas"));
  writeJson(path.join(OUTPUT_DIR, "IE.topo.json"), toTopology(ireland, "postalAreas"));
  writeJson(path.join(OUTPUT_DIR, "europe-outline.topo.json"), toTopology(europe, "countries"));

  const manifest: GeographyManifestEntry[] = [
    {
      countryCode: "ES",
      version: VERSION,
      sourceUrl: SPAIN_SOURCE.url,
      sourceDataset: SPAIN_SOURCE.dataset,
      retrievedAt: SPAIN_SOURCE.retrievedAt,
      sourceSha256: sha256File(SPAIN_SOURCE.path),
      sourceCrs: SPAIN_SOURCE.sourceCrs,
      targetCrs: "EPSG:4326",
      featureCount: spain.features.length,
      license: SPAIN_SOURCE.license,
      attribution: SPAIN_SOURCE.attribution,
    },
    {
      countryCode: "FR",
      version: VERSION,
      sourceUrl: FRANCE_SOURCE.url,
      sourceDataset: FRANCE_SOURCE.dataset,
      retrievedAt: FRANCE_SOURCE.retrievedAt,
      sourceSha256: sha256File(FRANCE_SOURCE.path),
      sourceCrs: FRANCE_SOURCE.sourceCrs,
      targetCrs: "EPSG:4326",
      featureCount: france.features.length,
      license: FRANCE_SOURCE.license,
      attribution: FRANCE_SOURCE.attribution,
    },
    {
      countryCode: "IE",
      version: VERSION,
      sourceUrl: IRELAND_SOURCE.url,
      sourceDataset: IRELAND_SOURCE.dataset,
      retrievedAt: IRELAND_SOURCE.retrievedAt,
      sourceSha256: sha256File(IRELAND_SOURCE.path),
      sourceCrs: IRELAND_SOURCE.sourceCrs,
      targetCrs: "EPSG:4326",
      featureCount: ireland.features.length,
      license: IRELAND_SOURCE.license,
      attribution: IRELAND_SOURCE.attribution,
    },
    {
      countryCode: "EU",
      version: VERSION,
      sourceUrl: EUROPE_SOURCE.url,
      sourceDataset: EUROPE_SOURCE.dataset,
      retrievedAt: EUROPE_SOURCE.retrievedAt,
      sourceSha256: sha256File(EUROPE_SOURCE.path),
      sourceCrs: EUROPE_SOURCE.sourceCrs,
      targetCrs: "EPSG:4326",
      featureCount: europe.features.length,
      license: EUROPE_SOURCE.license,
      attribution: EUROPE_SOURCE.attribution,
    },
  ];

  writeJson(path.join(OUTPUT_DIR, "manifest.json"), manifest);
  console.log("Prepared postal geography artifacts in", OUTPUT_DIR);
}

main();
