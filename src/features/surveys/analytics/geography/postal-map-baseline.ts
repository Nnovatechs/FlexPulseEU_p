import { setInValues } from "@/features/surveys/analytics/segments/conditions";
import { encodeSegmentDefinition } from "@/features/surveys/analytics/segments/url-codec";
import type { SegmentDefinition } from "@/features/surveys/analytics/segments/types";

export const POSTAL_AREA_KEY_FIELD = "geo.postal_area.area_key";

export function buildPostalMapBaseline(definition: SegmentDefinition) {
  const baselineDefinition = setInValues(definition, POSTAL_AREA_KEY_FIELD, []);
  return {
    definition: baselineDefinition,
    key: encodeSegmentDefinition(baselineDefinition),
  };
}
