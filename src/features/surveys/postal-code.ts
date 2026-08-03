export type SurveyPostalCollectionMode = "full" | "prefix";

export type PostalCodeInputStatus =
  | "missing"
  | "full"
  | "prefix"
  | "partial"
  | "invalid_or_unresolved";

export type PostalCodeClassification = {
  normalizedPostalCode: string | null;
  inputStatus: PostalCodeInputStatus;
};

export type PostalPrefixFieldSpec = {
  example: string;
  maxLength: number;
  pattern: string;
};

const PREFIX_COUNTRY_SPECS: Record<string, PostalPrefixFieldSpec> = {
  ES: {
    example: "28",
    maxLength: 2,
    pattern: "^[0-9]{2}$",
  },
  FR: {
    example: "75",
    maxLength: 3,
    pattern: "^(?:[0-9]{2}|9[78][0-9])$",
  },
  IE: {
    example: "D02",
    maxLength: 3,
    pattern: "^[A-Z][0-9]{2}$",
  },
};

function normalizePostalCode(value: string | null) {
  if (!value) {
    return null;
  }

  const compact = value.replace(/[\s-]+/g, "").toUpperCase();
  return compact || null;
}

function isSpanishOrFrenchFullPostalCode(postalCode: string) {
  return /^[0-9]{5}$/.test(postalCode);
}

function isSpanishOrFrenchPartialPostalCode(postalCode: string) {
  return /^[0-9]{2,4}$/.test(postalCode);
}

function isIrishFullPostalCode(postalCode: string) {
  return /^[AC-FHKNPRTV-Y][0-9]{2}[A-Z0-9]{4}$/.test(postalCode);
}

function isIrishPartialPostalCode(postalCode: string) {
  return /^[AC-FHKNPRTV-Y][0-9]{2}$/.test(postalCode);
}

function isValidPrefixPostalCode(countryCode: string, postalCode: string) {
  if (countryCode === "ES") {
    return /^[0-9]{2}$/.test(postalCode);
  }

  if (countryCode === "FR") {
    return /^(?:[0-9]{2}|9[78][0-9])$/.test(postalCode);
  }

  if (countryCode === "IE") {
    return /^[A-Z][0-9]{2}$/.test(postalCode);
  }

  return false;
}

export function getSupportedPostalPrefixCountryCodes() {
  return Object.keys(PREFIX_COUNTRY_SPECS);
}

export function getPostalPrefixFieldSpec(countryCode: string | null) {
  if (!countryCode) {
    return null;
  }

  return PREFIX_COUNTRY_SPECS[countryCode.trim().toUpperCase()] ?? null;
}

export function classifyPostalCodeInput(input: {
  countryCode: string | null;
  postalCode: string | null;
  collectionMode?: SurveyPostalCollectionMode | null;
}): PostalCodeClassification {
  const normalizedPostalCode = normalizePostalCode(input.postalCode);
  const normalizedCountryCode = input.countryCode?.trim().toUpperCase() ?? null;
  const collectionMode = input.collectionMode ?? "full";

  if (!normalizedPostalCode) {
    return {
      normalizedPostalCode: null,
      inputStatus: "missing",
    };
  }

  if (!/^[A-Z0-9]+$/.test(normalizedPostalCode)) {
    return {
      normalizedPostalCode,
      inputStatus: "invalid_or_unresolved",
    };
  }

  if (collectionMode === "prefix") {
    if (
      normalizedCountryCode &&
      isValidPrefixPostalCode(normalizedCountryCode, normalizedPostalCode)
    ) {
      return {
        normalizedPostalCode,
        inputStatus: "prefix",
      };
    }

    return {
      normalizedPostalCode,
      inputStatus: "invalid_or_unresolved",
    };
  }

  if (normalizedCountryCode === "ES" || normalizedCountryCode === "FR") {
    if (isSpanishOrFrenchFullPostalCode(normalizedPostalCode)) {
      return { normalizedPostalCode, inputStatus: "full" };
    }

    if (isSpanishOrFrenchPartialPostalCode(normalizedPostalCode)) {
      return { normalizedPostalCode, inputStatus: "partial" };
    }

    return { normalizedPostalCode, inputStatus: "invalid_or_unresolved" };
  }

  if (normalizedCountryCode === "IE") {
    if (isIrishFullPostalCode(normalizedPostalCode)) {
      return { normalizedPostalCode, inputStatus: "full" };
    }

    if (isIrishPartialPostalCode(normalizedPostalCode)) {
      return { normalizedPostalCode, inputStatus: "partial" };
    }

    return { normalizedPostalCode, inputStatus: "invalid_or_unresolved" };
  }

  if (normalizedPostalCode.length >= 4 && normalizedPostalCode.length <= 8) {
    return { normalizedPostalCode, inputStatus: "full" };
  }

  if (normalizedPostalCode.length >= 2 && normalizedPostalCode.length <= 3) {
    return { normalizedPostalCode, inputStatus: "partial" };
  }

  return {
    normalizedPostalCode,
    inputStatus: "invalid_or_unresolved",
  };
}
