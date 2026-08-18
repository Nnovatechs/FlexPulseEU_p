import type { SupportedPostalAreaCountryCode } from "./postal-area-key";

export type PostalAreaAggregate = {
  areaKey: string;
  countryCode: SupportedPostalAreaCountryCode;
  postalPrefix: string;
  label: string;
  n: number;
  shareOfMapped: number;
  shareOfEligible: number;
};

export type PostalMapCoverage = {
  eligibleN: number;
  mappedN: number;
  unmappedN: number;
  mappedShare: number;
};

export type PostalMapAnalysis = {
  geographyVersion: string;
  coverage: PostalMapCoverage;
  areas: PostalAreaAggregate[];
};

export type PostalComparisonArea = {
  areaKey: string;
  countryCode: SupportedPostalAreaCountryCode;
  label: string;
  postalPrefix: string;
  nA: number;
  nB: number;
  shareA: number;
  shareB: number;
  deltaPercentagePoints: number;
};

export type PostalMapComparison = {
  geographyVersion: string;
  coverageA: PostalMapCoverage;
  coverageB: PostalMapCoverage;
  areas: PostalComparisonArea[];
};
