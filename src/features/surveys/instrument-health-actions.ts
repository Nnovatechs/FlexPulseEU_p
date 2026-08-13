"use server";

import { generateSurveyInstrumentHealthData } from "./use-cases";
import type { InstrumentHealthData } from "./analytics/instrument-health";

export async function generateInstrumentHealthAction(
  surveyId: string,
): Promise<InstrumentHealthData> {
  const trimmedSurveyId = surveyId.trim();
  if (!trimmedSurveyId) {
    throw new Error("Survey ID is required.");
  }

  return generateSurveyInstrumentHealthData(trimmedSurveyId);
}
