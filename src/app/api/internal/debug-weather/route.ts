import { NextResponse } from "next/server";
import {
  deriveNormalizedSurveyLocation,
  fetchHistoricalWeatherWithOpenMeteo,
  geocodePostalCodeWithOpenMeteo,
} from "@/features/surveys/response-enrichment";
import { isInternalJobRequestAuthorized } from "@/lib/server/internal-job-auth";

export async function GET(request: Request) {
  if (!isInternalJobRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const countryCode = url.searchParams.get("countryCode")?.trim().toUpperCase() ?? "";
  const postalCode = url.searchParams.get("postalCode")?.trim() ?? "";
  const respondedAt =
    url.searchParams.get("respondedAt")?.trim() ?? new Date().toISOString();

  if (!countryCode || !postalCode) {
    return NextResponse.json(
      { error: "countryCode and postalCode are required." },
      { status: 400 },
    );
  }

  const geocodedLocation = await geocodePostalCodeWithOpenMeteo({
    countryCode,
    postalCode,
  });
  const normalizedLocation = deriveNormalizedSurveyLocation({
    countryCode,
    postalCode,
    geocodedLocation,
  });
  const weatherObservation =
    normalizedLocation.centroidLat != null && normalizedLocation.centroidLon != null
      ? await fetchHistoricalWeatherWithOpenMeteo({
          latitude: normalizedLocation.centroidLat,
          longitude: normalizedLocation.centroidLon,
          respondedAt,
        })
      : null;

  return NextResponse.json({
    input: {
      countryCode,
      postalCode,
      respondedAt,
    },
    geocodedLocation,
    normalizedLocation,
    weatherObservation,
  });
}
