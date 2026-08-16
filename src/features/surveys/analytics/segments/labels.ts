import {
  resolveFlexpulseAnalysisModel,
  resolveFlexpulseBehaviouralConcept,
} from "@/features/ontology/flexpulse-behavioural-schema";
import { getCanonicalDerAssetOptionLabel } from "@/features/surveys/asset-option-labels";
import { getConditionalModuleCatalog } from "@/features/surveys/analytics/instrument-health-semantics";
import {
  getOverviewBandLabel,
  hasOverviewConstructSemantics,
} from "@/features/surveys/analytics/overview-semantics";
import type { SurveyAnalyticsFieldDefinition } from "@/features/surveys/survey-analytics";
import type { SegmentBandKey } from "./types";

export const SINGLE_ITEM_SIGNAL_LABEL = "Single-item signal";
export const MULTI_ITEM_FACET_SCORE_LABEL = "Multi-item facet score";

export const NEUTRAL_BAND_LABELS: Record<SegmentBandKey, string> = {
  high: "Upper band",
  medium: "Intermediate band",
  low: "Lower band",
};

function presentBandLabel(label: string) {
  return label.replace(/^\p{L}/u, (letter) => letter.toUpperCase());
}

export type SegmentLabelContext = {
  schemaNamespace: string;
  schemaVersion: number;
  fields: SurveyAnalyticsFieldDefinition[];
};

export function humanizeKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  return trimmed
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function getConceptLabel(conceptKey: string, context: SegmentLabelContext) {
  const concept = resolveFlexpulseBehaviouralConcept({
    schemaNamespace: context.schemaNamespace,
    schemaVersion: context.schemaVersion,
    conceptKey,
  });
  if (concept?.label) {
    return concept.label;
  }

  const field = context.fields.find(
    (candidate) => candidate.concept_key === conceptKey && !candidate.facet && candidate.key.endsWith(".value"),
  );
  return field?.label ?? humanizeKey(conceptKey);
}

export function getConceptDescription(conceptKey: string, context: SegmentLabelContext) {
  return (
    resolveFlexpulseBehaviouralConcept({
      schemaNamespace: context.schemaNamespace,
      schemaVersion: context.schemaVersion,
      conceptKey,
    })?.description ?? null
  );
}

export function getDimensionLabel(dimension: string, context: SegmentLabelContext) {
  const matchingConcept = resolveFlexpulseBehaviouralConcept({
    schemaNamespace: context.schemaNamespace,
    schemaVersion: context.schemaVersion,
    conceptKey: dimension,
  });
  if (matchingConcept?.label) {
    return matchingConcept.label;
  }

  const field = context.fields.find(
    (candidate) =>
      candidate.dimension === dimension &&
      candidate.concept_role === "primary_profile_axis" &&
      !candidate.facet &&
      candidate.key.endsWith(".value"),
  );
  return field?.label ?? humanizeKey(dimension);
}

export function getFacetLabel(
  conceptKey: string,
  facet: string,
  context: SegmentLabelContext,
) {
  const analysisModel = resolveFlexpulseAnalysisModel({
    schemaNamespace: context.schemaNamespace,
    schemaVersion: context.schemaVersion,
    conceptKey,
  });
  const catalog = getConditionalModuleCatalog(analysisModel?.conditional_module_config?.catalog_id);
  if (catalog?.groupLabels[facet]) {
    return catalog.groupLabels[facet];
  }

  const field = context.fields.find(
    (candidate) => candidate.concept_key === conceptKey && candidate.facet === facet && candidate.key.endsWith(".value"),
  );
  if (field?.label && !field.label.endsWith(`: ${facet}`)) {
    return field.label;
  }

  return humanizeKey(facet);
}

export function getScoreDirectionNote(conceptKey: string, context: SegmentLabelContext) {
  const direction = resolveFlexpulseAnalysisModel({
    schemaNamespace: context.schemaNamespace,
    schemaVersion: context.schemaVersion,
    conceptKey,
  })?.score_direction;

  if (direction === "higher_is_stricter") {
    return "Higher scores indicate stricter expectations.";
  }

  return null;
}

export function getBandLabel(
  conceptKey: string,
  band: SegmentBandKey,
  context: SegmentLabelContext,
) {
  if (hasOverviewConstructSemantics(conceptKey)) {
    return presentBandLabel(getOverviewBandLabel(conceptKey, band));
  }

  const analysisModel = resolveFlexpulseAnalysisModel({
    schemaNamespace: context.schemaNamespace,
    schemaVersion: context.schemaVersion,
    conceptKey,
  });
  if (analysisModel?.band_labels?.[band]) {
    return presentBandLabel(analysisModel.band_labels[band]);
  }

  return NEUTRAL_BAND_LABELS[band];
}

export function getBandLabels(conceptKey: string, context: SegmentLabelContext) {
  return {
    high: getBandLabel(conceptKey, "high", context),
    medium: getBandLabel(conceptKey, "medium", context),
    low: getBandLabel(conceptKey, "low", context),
  };
}

export function formatVisibleDate(value: string) {
  const day = value.slice(0, 10);
  const parsed = Date.parse(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

export function getEvidenceLabel(evidenceLevel: "interpretive_signal" | "facet_subscore") {
  return evidenceLevel === "facet_subscore" ? MULTI_ITEM_FACET_SCORE_LABEL : SINGLE_ITEM_SIGNAL_LABEL;
}

export function getFieldLabel(fieldKey: string, context: SegmentLabelContext) {
  const field = context.fields.find((candidate) => candidate.key === fieldKey);
  if (!field) {
    return humanizeKey(fieldKey);
  }

  if (field.facet && field.concept_key) {
    return `${getConceptLabel(field.concept_key, context)} · ${getFacetLabel(field.concept_key, field.facet, context)}`;
  }

  if (field.concept_key && field.key.endsWith(".value")) {
    return getConceptLabel(field.concept_key, context);
  }

  return field.label || humanizeKey(fieldKey);
}

export function getChoiceValueLabel(value: string) {
  return humanizeKey(value);
}

export function getAssetValueLabel(value: string) {
  return getCanonicalDerAssetOptionLabel(value, "English") ?? humanizeKey(value);
}
