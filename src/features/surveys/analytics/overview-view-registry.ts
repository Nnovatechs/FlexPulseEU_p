import { FLEXPULSE_BEHAVIOURAL_SCHEMA_NAMESPACE } from "@/features/ontology/flexpulse-behavioural-schema";

export type QuadrantSlot = "highHigh" | "highLow" | "lowHigh" | "lowLow";

export type QuadrantProfileViewDefinition = {
  key: string;
  type: "quadrant_profile";
  title: string;
  schemaNamespace: string;
  schemaVersion: number;
  xAxis: {
    conceptKey: string;
    favourableCutoff: number;
    includeConditionalFacets: boolean;
  };
  yAxis: {
    conceptKey: string;
    favourableCutoff: number;
  };
  quadrantKeys: Record<QuadrantSlot, string>;
  quadrantLabels: Record<QuadrantSlot, string>;
  overallOption: {
    key: string;
    label: string;
    helperText: string;
  };
  comparison: {
    axisConceptRoles: string[];
    excludeDefiningAxes: boolean;
    maxAxes: number;
  };
};

const FLEXPULSE_WILLINGNESS_DFC_VIEW: QuadrantProfileViewDefinition = {
  key: "flexpulse_willingness_dfc_v1",
  type: "quadrant_profile",
  title: "Flexibility opportunity",
  schemaNamespace: FLEXPULSE_BEHAVIOURAL_SCHEMA_NAMESPACE,
  schemaVersion: 1,
  xAxis: {
    conceptKey: "declared_flexibility_capability",
    favourableCutoff: 4,
    includeConditionalFacets: true,
  },
  yAxis: {
    conceptKey: "flexibility_willingness",
    favourableCutoff: 4,
  },
  quadrantKeys: {
    highHigh: "high_willingness_high_capability",
    highLow: "high_willingness_limited_capability",
    lowHigh: "lower_willingness_high_capability",
    lowLow: "lower_immediate_fit",
  },
  quadrantLabels: {
    highHigh: "Favourable willingness and capability",
    highLow: "Favourable willingness, limited capability",
    lowHigh: "Favourable capability, lower willingness",
    lowLow: "Lower immediate fit",
  },
  overallOption: {
    key: "overall",
    label: "Overall DFC",
    helperText: "Overall DFC combines the capability modules applicable to each household.",
  },
  comparison: {
    axisConceptRoles: ["primary_profile_axis"],
    excludeDefiningAxes: true,
    maxAxes: 6,
  },
};

const QUADRANT_VIEWS: QuadrantProfileViewDefinition[] = [FLEXPULSE_WILLINGNESS_DFC_VIEW];

export function resolveQuadrantProfileView(input: {
  schemaNamespace: string;
  schemaVersion: number;
  presentConceptKeys: Iterable<string>;
}): QuadrantProfileViewDefinition | null {
  const present = new Set(input.presentConceptKeys);
  return (
    QUADRANT_VIEWS.find((view) => {
      if (view.schemaNamespace !== input.schemaNamespace || view.schemaVersion !== input.schemaVersion) {
        return false;
      }

      return present.has(view.xAxis.conceptKey) && present.has(view.yAxis.conceptKey);
    }) ?? null
  );
}

export function getQuadrantSlot(xValue: number, yValue: number, view: QuadrantProfileViewDefinition): QuadrantSlot {
  const highX = xValue >= view.xAxis.favourableCutoff;
  const highY = yValue >= view.yAxis.favourableCutoff;

  if (highY && highX) {
    return "highHigh";
  }

  if (highY && !highX) {
    return "highLow";
  }

  if (!highY && highX) {
    return "lowHigh";
  }

  return "lowLow";
}

export function getQuadrantKey(xValue: number, yValue: number, view: QuadrantProfileViewDefinition) {
  return view.quadrantKeys[getQuadrantSlot(xValue, yValue, view)];
}

export function getQuadrantSlotForKey(view: QuadrantProfileViewDefinition, key: string): QuadrantSlot | null {
  const match = (Object.entries(view.quadrantKeys) as Array<[QuadrantSlot, string]>).find(
    ([, quadrantKey]) => quadrantKey === key,
  );
  return match?.[0] ?? null;
}
