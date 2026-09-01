export type SupportedPostalAreaCountryCode = "ES" | "FR" | "IE";

export type PostalAreaScheme = "postal_prefix" | "eircode_routing_key";

export type NormalizePostalAreaKeyResult =
  | {
      status: "mapped";
      areaKey: string;
      countryCode: SupportedPostalAreaCountryCode;
      postalPrefix: string;
      scheme: PostalAreaScheme;
    }
  | {
      status: "unmapped";
      areaKey: null;
      countryCode: SupportedPostalAreaCountryCode | null;
      postalPrefix: null;
      scheme: PostalAreaScheme | null;
    };

const FRENCH_THREE_DIGIT_POSTAL_AREAS = new Set([
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

function normalizeCountryCode(value: string | null | undefined): SupportedPostalAreaCountryCode | null {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "ES" || normalized === "FR" || normalized === "IE") {
    return normalized;
  }
  return null;
}

function compactRawValue(value: string) {
  return value.trim().toUpperCase().replace(/[\s_-]+/g, "").replace(/\*+$/g, "");
}

function inferCountryAndValue(raw: string, fallbackCountryCode: SupportedPostalAreaCountryCode | null) {
  const match = /^([A-Z]{2}):POSTAL_AREA:([A-Z0-9*_-]+)$/i.exec(raw.trim());
  if (!match) {
    return {
      countryCode: fallbackCountryCode,
      value: compactRawValue(raw),
    };
  }

  return {
    countryCode: normalizeCountryCode(match[1]) ?? fallbackCountryCode,
    value: compactRawValue(match[2]),
  };
}

function mapped(
  countryCode: SupportedPostalAreaCountryCode,
  postalPrefix: string,
  scheme: PostalAreaScheme,
): NormalizePostalAreaKeyResult {
  return {
    status: "mapped",
    areaKey: `${countryCode}:postal_area:${postalPrefix}`,
    countryCode,
    postalPrefix,
    scheme,
  };
}

function unmapped(countryCode: SupportedPostalAreaCountryCode | null): NormalizePostalAreaKeyResult {
  return {
    status: "unmapped",
    areaKey: null,
    countryCode,
    postalPrefix: null,
    scheme: null,
  };
}

function normalizeSpanishPostalArea(value: string) {
  if (/^\d{2}$/.test(value)) {
    return value;
  }
  if (/^\d{3,5}$/.test(value)) {
    return value.slice(0, 2);
  }
  return null;
}

function normalizeFrenchPostalArea(value: string) {
  if (value === "980" || value === "00" || value === "98" || value === "97") {
    return null;
  }
  if (value === "20" || value === "2A" || value === "2B") {
    return "20";
  }
  if (/^2A\d{0,3}$/i.test(value) || /^2B\d{0,3}$/i.test(value)) {
    return "20";
  }
  if (/^\d{2}$/.test(value)) {
    return value;
  }
  if (/^\d{3}$/.test(value)) {
    if (value.startsWith("97") || value.startsWith("98")) {
      return value;
    }
    return value.slice(0, 2);
  }
  if (/^\d{5}$/.test(value)) {
    const threeDigit = value.slice(0, 3);
    if (threeDigit === "980") {
      return null;
    }
    if (threeDigit.startsWith("97") || threeDigit.startsWith("98")) {
      return threeDigit;
    }
    return value.slice(0, 2);
  }
  return null;
}

function normalizeIrishPostalArea(value: string) {
  if (/^[A-Z]\d{2}$/.test(value)) {
    return value;
  }
  if (/^[A-Z]\d{2}[A-Z0-9]{4}$/.test(value)) {
    return value.slice(0, 3);
  }
  return null;
}

export function normalizePostalAreaKey(input: {
  countryCode: string | null | undefined;
  rawCode: string | null | undefined;
}): NormalizePostalAreaKeyResult {
  if (!input.rawCode?.trim()) {
    return unmapped(normalizeCountryCode(input.countryCode));
  }

  const fallbackCountryCode = normalizeCountryCode(input.countryCode);
  const inferred = inferCountryAndValue(input.rawCode, fallbackCountryCode);
  const countryCode = inferred.countryCode;
  if (!countryCode) {
    return unmapped(null);
  }

  if (countryCode === "ES") {
    const postalPrefix = normalizeSpanishPostalArea(inferred.value);
    return postalPrefix ? mapped("ES", postalPrefix, "postal_prefix") : unmapped("ES");
  }

  if (countryCode === "FR") {
    const postalPrefix = normalizeFrenchPostalArea(inferred.value);
    if (!postalPrefix) {
      return unmapped("FR");
    }
    if (postalPrefix.length === 3 && postalPrefix.startsWith("98") && !FRENCH_THREE_DIGIT_POSTAL_AREAS.has(postalPrefix)) {
      return unmapped("FR");
    }
    return mapped("FR", postalPrefix, "postal_prefix");
  }

  const postalPrefix = normalizeIrishPostalArea(inferred.value);
  return postalPrefix ? mapped("IE", postalPrefix, "eircode_routing_key") : unmapped("IE");
}

export function postalAreaKeyEquals(left: string | null | undefined, right: string | null | undefined) {
  return left != null && right != null && left === right;
}
