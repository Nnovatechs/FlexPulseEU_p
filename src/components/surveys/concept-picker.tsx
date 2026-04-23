"use client";

import { useState } from "react";
import {
  fpBehaviourV1Concepts,
  buildOntologyTarget,
  type BehaviourOntologyBlock,
} from "@/features/ontology/fp-behaviour-v1";

const ACTIONABLE_BLOCKS: BehaviourOntologyBlock[] = [
  "awareness",
  "flex_willingness",
  "thermal_comfort",
  "trust_automation",
  "tariff_preferences",
  "device_engagement",
];

const BLOCK_LABELS: Record<BehaviourOntologyBlock, string> = {
  awareness: "Awareness",
  flex_willingness: "Flexibility willingness",
  thermal_comfort: "Thermal comfort",
  trust_automation: "Trust in automation",
  tariff_preferences: "Tariff preferences",
  device_engagement: "Device engagement",
  response_context: "Response context",
  environment_context: "Environment context",
  mapping_quality: "Mapping quality",
};

const conceptsByBlock = ACTIONABLE_BLOCKS.map((block) => ({
  block,
  label: BLOCK_LABELS[block],
  concepts: fpBehaviourV1Concepts.filter((c) => c.block === block),
}));

type ConceptPickerProps = {
  initialTargets?: string[];
};

export function ConceptPicker({ initialTargets = [] }: ConceptPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialTargets),
  );
  const [expanded, setExpanded] = useState<Set<BehaviourOntologyBlock>>(
    new Set(ACTIONABLE_BLOCKS),
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

  function toggleBlock(block: BehaviourOntologyBlock) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(block)) {
        next.delete(block);
      } else {
        next.add(block);
      }
      return next;
    });
  }

  function selectAllInBlock(block: BehaviourOntologyBlock) {
    const blockTargets = fpBehaviourV1Concepts
      .filter((c) => c.block === block)
      .map((c) => buildOntologyTarget(c.block, c.attribute));
    setSelected((prev) => new Set([...prev, ...blockTargets]));
  }

  function clearAllInBlock(block: BehaviourOntologyBlock) {
    const blockTargets = new Set(
      fpBehaviourV1Concepts
        .filter((c) => c.block === block)
        .map((c) => buildOntologyTarget(c.block, c.attribute)),
    );
    setSelected(
      (prev) => new Set([...prev].filter((t) => !blockTargets.has(t))),
    );
  }

  return (
    <>
      <div className="concept-blocks">
        {conceptsByBlock.map(({ block, label, concepts }) => {
          const isExpanded = expanded.has(block);
          const blockTargets = concepts.map((c) =>
            buildOntologyTarget(c.block, c.attribute),
          );
          const selectedInBlock = blockTargets.filter((t) =>
            selected.has(t),
          ).length;
          const allSelected = selectedInBlock === concepts.length;

          return (
            <div key={block} className="concept-block">
              <button
                type="button"
                className="concept-block__header"
                onClick={() => toggleBlock(block)}
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
                          ? clearAllInBlock(block)
                          : selectAllInBlock(block)
                      }
                    >
                      {allSelected ? "Deselect all" : "Select all"}
                    </button>
                  </div>

                  <div className="concept-grid">
                    {concepts.map((concept) => {
                      const target = buildOntologyTarget(
                        concept.block,
                        concept.attribute,
                      );
                      const isChecked = selected.has(target);

                      return (
                        <label
                          key={target}
                          className={`concept-item${isChecked ? " concept-item--selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            name="ontologyTargets"
                            value={target}
                            checked={isChecked}
                            onChange={() => toggleConcept(target)}
                          />
                          <span className="concept-item__attribute">
                            {concept.attribute.replaceAll("_", " ")}
                          </span>
                          <span className="concept-item__type">
                            {concept.value_type}
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
