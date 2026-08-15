"use client";

import {
  comparisonTrayCount,
  isWholeSampleDefinition,
  removeComparisonSlot,
  swapComparisonSlots,
  type ComparisonTrayState,
  type SegmentDefinition,
} from "@/features/surveys/analytics/segments";

type ComparisonPanelProps = {
  tray: ComparisonTrayState;
  storageReady: boolean;
  onTrayChange: (tray: ComparisonTrayState) => void;
  onOpenInExplorer: (definition: SegmentDefinition) => void;
};

function slotLabel(definition: SegmentDefinition | null) {
  if (!definition) {
    return "Empty slot";
  }
  if (isWholeSampleDefinition(definition)) {
    return "Whole analysed sample";
  }
  return `${definition.conditions.length} condition${definition.conditions.length === 1 ? "" : "s"}`;
}

export function ComparisonPanel({
  tray,
  storageReady,
  onTrayChange,
  onOpenInExplorer,
}: ComparisonPanelProps) {
  const count = comparisonTrayCount(tray);

  return (
    <div className="analytics-v2-segment">
      <section className="analytics-v2-panel">
        <div className="analytics-v2-panel__head">
          <div className="analytics-v2-panel__title">
            <h3>Comparison {count}/2</h3>
            <p>
              {storageReady
                ? "Tray of definitions only. Full A/B analysis comes later."
                : "Loading the comparison tray…"}
            </p>
          </div>
          <button
            type="button"
            className="button button--ghost"
            disabled={count === 0}
            onClick={() => onTrayChange(swapComparisonSlots(tray))}
          >
            Swap A and B
          </button>
        </div>

        <div className="analytics-v2-comparison-slots">
          {(["A", "B"] as const).map((label, index) => {
            const slot = index as 0 | 1;
            const definition = tray.slots[slot];
            return (
              <article key={label} className="analytics-v2-seg-slot">
                <div>
                  <span>Segment {label}</span>
                  <strong>{slotLabel(definition)}</strong>
                </div>
                <div className="analytics-v2-seg-toolbar__actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    disabled={!definition}
                    onClick={() => definition && onOpenInExplorer(definition)}
                  >
                    Open in Explorer
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    disabled={!definition}
                    onClick={() => onTrayChange(removeComparisonSlot(tray, slot))}
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
