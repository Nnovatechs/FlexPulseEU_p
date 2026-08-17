export function percentageBarWidth(share: number | null | undefined) {
  if (share == null || !(share > 0)) {
    return 0;
  }
  return share * 100;
}

export function hasTraceShare(share: number | null | undefined) {
  return share != null && share > 0 && share < 0.02;
}

export const CANONICAL_WEATHER_QUALITY_FLAG = "weather_ok";

export function isUsableWeatherQuality(flag: string | null | undefined) {
  return flag === CANONICAL_WEATHER_QUALITY_FLAG;
}
