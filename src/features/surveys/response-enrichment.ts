import type { PostalCodeInputStatus } from "./postal-code";
import { classifyPostalCodeInput } from "./postal-code";

type OpenMeteoGeocodingResult = {
  id?: number;
  name?: string;
  country?: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
  admin1_id?: number;
  admin2_id?: number;
  admin3_id?: number;
  admin4_id?: number;
  postcodes?: string[];
  timezone?: string;
};
export { classifyPostalCodeInput };
export type { PostalCodeClassification, PostalCodeInputStatus } from "./postal-code";

export type NormalizedLocationLevel = {
  kind: "country" | "region" | "city" | "district" | "neighbourhood" | "place" | "postal_area";
  code: string;
  label: string;
  providerId: number | null;
  centroidLat: number | null;
  centroidLon: number | null;
};

export type NormalizedLocationSnapshot = {
  provider: "open_meteo_geocoding" | "fallback";
  postalAreaMask: string | null;
  postalInputStatus: PostalCodeInputStatus;
  resolvedPlace: {
    providerId: number | null;
    name: string | null;
    timezone: string | null;
    centroidLat: number | null;
    centroidLon: number | null;
  } | null;
  levels: NormalizedLocationLevel[];
  bestAvailableKind: NormalizedLocationLevel["kind"] | null;
};

export type NormalizedSurveyLocation = {
  normalizedCountryCode: string | null;
  locationAggCode: string | null;
  locationAggLabel: string | null;
  locationGranularity: string | null;
  centroidLat: number | null;
  centroidLon: number | null;
  normalizedLocationJson: NormalizedLocationSnapshot;
};

export type HistoricalWeatherObservation = {
  observedAt: string;
  temperatureOutdoorC: number | null;
  humidityPct: number | null;
  payload: Record<string, unknown>;
};

function withCountryPrefix(countryCode: string | null, suffix: string) {
  return countryCode ? `${countryCode}:${suffix}` : suffix;
}

async function fetchNearestHourlyWeatherObservation(
  url: URL,
  responseDate: Date,
  source: "open_meteo_archive" | "open_meteo_forecast",
): Promise<HistoricalWeatherObservation | null> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    hourly?: {
      time?: string[];
      temperature_2m?: Array<number | null>;
      relative_humidity_2m?: Array<number | null>;
    };
  };

  const times = payload.hourly?.time ?? [];
  const temperatures = payload.hourly?.temperature_2m ?? [];
  const humidities = payload.hourly?.relative_humidity_2m ?? [];

  if (times.length === 0) {
    return null;
  }

  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (let index = 0; index < times.length; index += 1) {
    const candidate = Date.parse(`${times[index]}:00Z`);
    if (Number.isNaN(candidate)) {
      continue;
    }

    const delta = Math.abs(candidate - responseDate.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }

  return {
    observedAt: `${times[bestIndex]}:00Z`,
    temperatureOutdoorC: temperatures[bestIndex] ?? null,
    humidityPct: humidities[bestIndex] ?? null,
    payload: {
      source,
      matched_hour_index: bestIndex,
      matched_hour_time: times[bestIndex] ?? null,
    },
  };
}

function slugifyCodePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function maskPostalArea(postalCode: string | null) {
  if (!postalCode) {
    return null;
  }

  const compact = postalCode.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 3) {
    return `${compact}*`;
  }

  return `${compact.slice(0, 3)}*`;
}

function normalizePostalCode(value: string | null) {
  if (!value) {
    return null;
  }

  const compact = value.replace(/[\s-]+/g, "").toUpperCase();
  return compact || null;
}

function matchesGeocodedPostalCode(
  result: OpenMeteoGeocodingResult,
  normalizedPostalCode: string,
) {
  const resultPostcodes = (result.postcodes ?? [])
    .map((value) => normalizePostalCode(value))
    .filter((value): value is string => Boolean(value));

  if (resultPostcodes.length === 0) {
    return true;
  }

  return resultPostcodes.includes(normalizedPostalCode);
}

function buildLocationLevel(input: {
  countryCode: string | null;
  kind: NormalizedLocationLevel["kind"];
  label: string;
  providerId?: number;
  centroidLat?: number | null;
  centroidLon?: number | null;
}): NormalizedLocationLevel {
  return {
    kind: input.kind,
    code: input.providerId
      ? withCountryPrefix(input.countryCode, `${input.kind}:${input.providerId}`)
      : withCountryPrefix(input.countryCode, `${input.kind}:${slugifyCodePart(input.label)}`),
    label: input.label,
    providerId: input.providerId ?? null,
    centroidLat: input.centroidLat ?? null,
    centroidLon: input.centroidLon ?? null,
  };
}

function dedupeLocationLevels(levels: NormalizedLocationLevel[]) {
  const seen = new Set<string>();
  return levels.filter((level) => {
    const key = `${level.kind}:${level.code}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function geocodePostalCodeWithOpenMeteo(input: {
  countryCode: string;
  postalCode: string;
}): Promise<OpenMeteoGeocodingResult | null> {
  const query = new URL("https://geocoding-api.open-meteo.com/v1/search");
  query.searchParams.set("name", input.postalCode);
  query.searchParams.set("count", "1");
  query.searchParams.set("format", "json");
  query.searchParams.set("language", "en");
  query.searchParams.set("countryCode", input.countryCode);

  const response = await fetch(query, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    results?: OpenMeteoGeocodingResult[];
  };

  const result = payload.results?.[0] ?? null;
  if (!result) {
    return null;
  }

  const normalizedCountryCode = input.countryCode.trim().toUpperCase();
  if (
    result.country_code?.trim().toUpperCase() &&
    result.country_code.trim().toUpperCase() !== normalizedCountryCode
  ) {
    return null;
  }

  const normalizedPostalCode = normalizePostalCode(input.postalCode);
  if (normalizedPostalCode && !matchesGeocodedPostalCode(result, normalizedPostalCode)) {
    return null;
  }

  return result;
}

export function deriveNormalizedSurveyLocation(input: {
  countryCode: string | null;
  postalCode: string | null;
  geocodedLocation: OpenMeteoGeocodingResult | null;
  postalInputStatus?: PostalCodeInputStatus;
}): NormalizedSurveyLocation {
  const postalInputStatus =
    input.postalInputStatus ?? (input.postalCode ? "full" : "missing");
  const normalizedCountryCode =
    input.geocodedLocation?.country_code?.toUpperCase() ??
    input.countryCode?.trim().toUpperCase() ??
    null;
  const fallbackPostalArea =
    postalInputStatus === "full" ||
    postalInputStatus === "partial" ||
    postalInputStatus === "prefix"
      ? maskPostalArea(input.postalCode)
      : null;

  if (!input.geocodedLocation) {
    const levels = dedupeLocationLevels([
      ...(normalizedCountryCode
        ? [
            buildLocationLevel({
              countryCode: normalizedCountryCode,
              kind: "country",
              label: normalizedCountryCode,
            }),
          ]
        : []),
      ...(fallbackPostalArea
        ? [
            buildLocationLevel({
              countryCode: normalizedCountryCode,
              kind: "postal_area",
              label: fallbackPostalArea,
            }),
          ]
        : []),
    ]);
    const bestLevel = levels.find((level) => level.kind === "postal_area") ?? levels[0] ?? null;

    return {
      normalizedCountryCode,
      locationAggCode: bestLevel?.code ?? null,
      locationAggLabel: bestLevel?.label ?? null,
      locationGranularity: bestLevel?.kind ?? null,
      centroidLat: bestLevel?.centroidLat ?? null,
      centroidLon: bestLevel?.centroidLon ?? null,
      normalizedLocationJson: {
        provider: "fallback",
        postalAreaMask: fallbackPostalArea,
        postalInputStatus,
        resolvedPlace: null,
        levels,
        bestAvailableKind: bestLevel?.kind ?? null,
      },
    };
  }

  const location = input.geocodedLocation;
  const levels = dedupeLocationLevels([
    ...(normalizedCountryCode
      ? [
          buildLocationLevel({
            countryCode: normalizedCountryCode,
            kind: "country",
            label: location.country ?? normalizedCountryCode,
          }),
        ]
      : []),
    ...(location.admin1?.trim()
      ? [
          buildLocationLevel({
            countryCode: normalizedCountryCode,
            kind: "region",
            label: location.admin1,
            providerId: location.admin1_id,
            centroidLat: location.latitude,
            centroidLon: location.longitude,
          }),
        ]
      : []),
    ...(location.admin2?.trim()
      ? [
          buildLocationLevel({
            countryCode: normalizedCountryCode,
            kind: "city",
            label: location.admin2,
            providerId: location.admin2_id,
            centroidLat: location.latitude,
            centroidLon: location.longitude,
          }),
        ]
      : []),
    ...(location.admin3?.trim()
      ? [
          buildLocationLevel({
            countryCode: normalizedCountryCode,
            kind: "district",
            label: location.admin3,
            providerId: location.admin3_id,
            centroidLat: location.latitude,
            centroidLon: location.longitude,
          }),
        ]
      : []),
    ...(location.admin4?.trim()
      ? [
          buildLocationLevel({
            countryCode: normalizedCountryCode,
            kind: "neighbourhood",
            label: location.admin4,
            providerId: location.admin4_id,
            centroidLat: location.latitude,
            centroidLon: location.longitude,
          }),
        ]
      : []),
    ...(location.name?.trim()
      ? [
          buildLocationLevel({
            countryCode: normalizedCountryCode,
            kind: "place",
            label: location.name,
            providerId: location.id,
            centroidLat: location.latitude,
            centroidLon: location.longitude,
          }),
        ]
      : []),
    ...(fallbackPostalArea
      ? [
          buildLocationLevel({
            countryCode: normalizedCountryCode,
            kind: "postal_area",
            label: fallbackPostalArea,
          }),
        ]
      : []),
  ]);

  const bestLevel =
    levels.find((level) => level.kind === "neighbourhood") ??
    levels.find((level) => level.kind === "district") ??
    levels.find((level) => level.kind === "city") ??
    levels.find((level) => level.kind === "place") ??
    levels.find((level) => level.kind === "region") ??
    levels.find((level) => level.kind === "postal_area") ??
    levels.find((level) => level.kind === "country") ??
    null;

  return {
    normalizedCountryCode,
    locationAggCode: bestLevel?.code ?? null,
    locationAggLabel: bestLevel?.label ?? null,
    locationGranularity: bestLevel?.kind ?? null,
    centroidLat: bestLevel?.centroidLat ?? location.latitude,
    centroidLon: bestLevel?.centroidLon ?? location.longitude,
    normalizedLocationJson: {
      provider: "open_meteo_geocoding",
      postalAreaMask: fallbackPostalArea,
      postalInputStatus,
      resolvedPlace: {
        providerId: location.id ?? null,
        name: location.name ?? null,
        timezone: location.timezone ?? null,
        centroidLat: location.latitude,
        centroidLon: location.longitude,
      },
      levels,
      bestAvailableKind: bestLevel?.kind ?? null,
    },
  };
}

export async function fetchHistoricalWeatherWithOpenMeteo(input: {
  latitude: number;
  longitude: number;
  respondedAt: string;
}): Promise<HistoricalWeatherObservation | null> {
  const responseDate = new Date(input.respondedAt);
  const date = responseDate.toISOString().slice(0, 10);

  const archiveUrl = new URL("https://archive-api.open-meteo.com/v1/archive");
  archiveUrl.searchParams.set("latitude", String(input.latitude));
  archiveUrl.searchParams.set("longitude", String(input.longitude));
  archiveUrl.searchParams.set("start_date", date);
  archiveUrl.searchParams.set("end_date", date);
  archiveUrl.searchParams.set("hourly", "temperature_2m,relative_humidity_2m");
  archiveUrl.searchParams.set("timezone", "UTC");

  const archiveObservation = await fetchNearestHourlyWeatherObservation(
    archiveUrl,
    responseDate,
    "open_meteo_archive",
  );

  if (archiveObservation) {
    return archiveObservation;
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(input.latitude));
  forecastUrl.searchParams.set("longitude", String(input.longitude));
  forecastUrl.searchParams.set("hourly", "temperature_2m,relative_humidity_2m");
  forecastUrl.searchParams.set("timezone", "UTC");
  forecastUrl.searchParams.set("past_days", "2");
  forecastUrl.searchParams.set("forecast_days", "1");

  return fetchNearestHourlyWeatherObservation(
    forecastUrl,
    responseDate,
    "open_meteo_forecast",
  );
}
