"use client";

import { useState } from "react";
import {
  flexpulseSurveyDesignConceptsByDimension,
  type FlexpulseDimension,
} from "@/features/ontology/flexpulse-behavioural-schema";
import {
  DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY,
  DFC_INVENTORY_CONCEPT_KEY,
  ensureDeclaredFlexibilityCapabilityDependencies,
} from "@/features/surveys/declared-flexibility-capability-module";

const DIMENSION_LABELS: Record<FlexpulseDimension, string> = {
  awareness_of_energy_systems: "Awareness of energy systems",
  flexibility_willingness: "Flexibility willingness",
  flexibility_capability: "Flexibility capability",
  thermal_comfort_norms: "Thermal comfort norms",
  tariff_preferences: "Tariff preferences",
  trust_in_automation: "Trust in automation",
  der_engagement: "DER engagement",
  response_context: "Response context",
};

const CONCEPT_ROLE_LABELS = {
  primary_profile_axis: "Primary profile axis",
  behavioural_modulator: "Behavioural modulator",
  applicability_factor: "Applicability factor",
  context_signal: "Context signal",
  quality_signal: "Quality signal",
} as const;

const conceptsByDimension = flexpulseSurveyDesignConceptsByDimension.map(
  ({ dimension, concepts }) => ({
  dimension,
  label: DIMENSION_LABELS[dimension],
  concepts,
}),
);

type ConceptPickerProps = {
  initialConceptKeys?: string[];
};

/**
 * Returns whether the asset inventory is locked because DFC is selected.
 */
export function isDfcInventoryLocked(selectedConceptKeys: Iterable<string>) {
  const selected = new Set(selectedConceptKeys);
  return (
    selected.has(DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY) &&
    selected.has(DFC_INVENTORY_CONCEPT_KEY)
  );
}

/**
 * Applies one concept toggle while preserving the DFC inventory dependency.
 */
export function toggleConceptSelection(
  selectedConceptKeys: Iterable<string>,
  target: string,
) {
  const next = new Set(selectedConceptKeys);
  const inventoryLocked = isDfcInventoryLocked(next);

  if (next.has(target)) {
    if (target === DFC_INVENTORY_CONCEPT_KEY && inventoryLocked) {
      return next;
    }
    next.delete(target);
    return next;
  }

  next.add(target);
  if (target === DECLARED_FLEXIBILITY_CAPABILITY_CONCEPT_KEY) {
    next.add(DFC_INVENTORY_CONCEPT_KEY);
  }
  return next;
}

/**
 * Clears one dimension while preserving the DFC inventory dependency.
 */
export function clearDimensionSelection(
  selectedConceptKeys: Iterable<string>,
  dimensionConceptKeys: Iterable<string>,
) {
  const dimensionKeys = new Set(dimensionConceptKeys);
  const preservedKeys = isDfcInventoryLocked(selectedConceptKeys)
    ? new Set([DFC_INVENTORY_CONCEPT_KEY])
    : new Set<string>();

  return new Set(
    [...selectedConceptKeys].filter(
      (conceptKey) =>
        !dimensionKeys.has(conceptKey) || preservedKeys.has(conceptKey),
    ),
  );
}

export function ConceptPicker({ initialConceptKeys = [] }: ConceptPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(ensureDeclaredFlexibilityCapabilityDependencies(initialConceptKeys)),
  );
  const [expanded, setExpanded] = useState<Set<FlexpulseDimension>>(
    new Set(conceptsByDimension.map(({ dimension }) => dimension)),
  );

  function toggleConcept(target: string) {
    setSelected((prev) => toggleConceptSelection(prev, target));
  }

  function toggleDimension(dimension: FlexpulseDimension) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dimension)) {
        next.delete(dimension);
      } else {
        next.add(dimension);
      }
      return next;
    });
  }

  function selectAllInDimension(dimension: FlexpulseDimension) {
    const dimensionConceptKeys =
      conceptsByDimension
        .find((entry) => entry.dimension === dimension)
        ?.concepts.map((concept) => concept.concept_key) ?? [];
    setSelected(
      (prev) =>
        new Set(
          ensureDeclaredFlexibilityCapabilityDependencies([
            ...prev,
            ...dimensionConceptKeys,
          ]),
        ),
    );
  }

  function clearAllInDimension(dimension: FlexpulseDimension) {
    const dimensionConceptKeys = new Set(
      conceptsByDimension
        .find((entry) => entry.dimension === dimension)
        ?.concepts.map((concept) => concept.concept_key) ?? [],
    );
    setSelected(
      (prev) => clearDimensionSelection(prev, dimensionConceptKeys),
    );
  }

  return (
    <>
      <div className="concept-blocks">
        {conceptsByDimension.map(({ dimension, label, concepts }) => {
          const isExpanded = expanded.has(dimension);
          const dimensionConceptKeys = concepts.map((concept) => concept.concept_key);
          const selectedInBlock = dimensionConceptKeys.filter((t) =>
            selected.has(t),
          ).length;
          const allSelected = selectedInBlock === concepts.length;

          return (
            <div key={dimension} className="concept-block">
              <button
                type="button"
                className="concept-block__header"
                onClick={() => toggleDimension(dimension)}
                aria-expanded={isExpanded}
              >
                <span className="concept-block__title">{label}</span>
                <span className="concept-block__meta">
                  {selectedInBlock > 0 && (
                    <span className="concept-block__count">
                      {selectedInBlock}/{concepts.length}
                    </span>
                  )}
                  <span className="concept-block__chevron" aria-hidden>
                    {isExpanded ? "−" : "+"}
                  </span>
                </span>
              </button>

              {isExpanded && (
                <div className="concept-block__body">
                  <div className="concept-block__actions">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() =>
                        allSelected
                          ? clearAllInDimension(dimension)
                          : selectAllInDimension(dimension)
                      }
                    >
                      {allSelected ? "Deselect all" : "Select all"}
                    </button>
                  </div>

                  <div className="concept-grid">
                    {concepts.map((concept) => {
                      const conceptKey = concept.concept_key;
                      const isChecked = selected.has(conceptKey);
                      const isLocked =
                        conceptKey === DFC_INVENTORY_CONCEPT_KEY &&
                        isDfcInventoryLocked(selected);

                      return (
                        <label
                          key={conceptKey}
                          className={`concept-item${isChecked ? " concept-item--selected" : ""}${isLocked ? " concept-item--locked" : ""}`}
                        >
                          <input
                            type="checkbox"
                            name="behaviouralConceptKeys"
                            value={conceptKey}
                            checked={isChecked}
                            disabled={isLocked}
                            onChange={() => toggleConcept(conceptKey)}
                          />
                          <span className="concept-item__attribute">
                            {concept.label}
                            {isLocked ? " (required by DFC)" : ""}
                          </span>
                          <span className="concept-item__type">
                            {CONCEPT_ROLE_LABELS[concept.concept_role]}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
