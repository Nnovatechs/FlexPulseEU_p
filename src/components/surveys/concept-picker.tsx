"use client";

import { useState } from "react";
import {
  flexpulseSurveyDesignConceptsByDimension,
  type FlexpulseDimension,
} from "@/features/ontology/flexpulse-behavioural-schema";

const DIMENSION_LABELS: Record<FlexpulseDimension, string> = {
  awareness_of_energy_systems: "Awareness of energy systems",
  flexibility_willingness: "Flexibility willingness",
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

export function ConceptPicker({ initialConceptKeys = [] }: ConceptPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialConceptKeys),
  );
  const [expanded, setExpanded] = useState<Set<FlexpulseDimension>>(
    new Set(conceptsByDimension.map(({ dimension }) => dimension)),
  );

  function toggleConcept(target: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(target)) {
        next.delete(target);
      } else {
        next.add(target);
      }
      return next;
    });
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
    setSelected((prev) => new Set([...prev, ...dimensionConceptKeys]));
  }

  function clearAllInDimension(dimension: FlexpulseDimension) {
    const dimensionConceptKeys = new Set(
      conceptsByDimension
        .find((entry) => entry.dimension === dimension)
        ?.concepts.map((concept) => concept.concept_key) ?? [],
    );
    setSelected(
      (prev) => new Set([...prev].filter((t) => !dimensionConceptKeys.has(t))),
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

                      return (
                        <label
                          key={conceptKey}
                          className={`concept-item${isChecked ? " concept-item--selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            name="behaviouralConceptKeys"
                            value={conceptKey}
                            checked={isChecked}
                            onChange={() => toggleConcept(conceptKey)}
                          />
                          <span className="concept-item__attribute">
                            {concept.label}
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
