"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type {
  ComparisonCompositionDifference,
  ComparisonScoreDifference,
} from "@/features/surveys/analytics/segments";
import {
  COMPARISON_SCORE_KIND_LABEL,
  COMPOSITION_FAMILY_LABEL,
  compositionAxisDomain,
  compositionBarLayout,
  compositionPlotAriaLabel,
  compositionPlotTooltipLines,
  formatPlotPp,
  scorePlotAriaLabel,
  scorePlotTooltipLines,
  scoreScaleRatio,
  shouldDismissPlotTooltip,
  visibleCompositionPlotRows,
  visibleScorePlotRows,
} from "./comparison-plot-model";

const SCORE_WIDTH = 240;
const SCORE_HEIGHT = 36;
const SCORE_PAD = 8;

function scoreX(value: number) {
  return SCORE_PAD + scoreScaleRatio(value) * (SCORE_WIDTH - SCORE_PAD * 2);
}

function PlotTooltip({ lines, labelledBy }: { lines: string[]; labelledBy: string }) {
  return (
    <span className="analytics-v2-compare-plot__tooltip" role="tooltip" aria-labelledby={labelledBy}>
      {lines.map((line) => (
        <span key={line} className="analytics-v2-compare-plot__tooltip-line">
          {line}
        </span>
      ))}
    </span>
  );
}

function PlotRow({
  ariaLabel,
  tooltipLines,
  testId,
  children,
}: {
  ariaLabel: string;
  tooltipLines: string[];
  testId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (shouldDismissPlotTooltip(event.key)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <button
      ref={rootRef}
      type="button"
      id={labelId}
      data-testid={testId}
      className={`analytics-v2-compare-plot__row${open ? " is-open" : ""}`}
      aria-label={ariaLabel}
      aria-expanded={open}
      onClick={(event) => {
        event.preventDefault();
        setOpen((current) => !current);
      }}
    >
      {children}
      <PlotTooltip lines={tooltipLines} labelledBy={labelId} />
    </button>
  );
}

function ScoreMarks({ row }: { row: ComparisonScoreDifference }) {
  const q1A = scoreX(row.q1A);
  const q3A = scoreX(row.q3A);
  const medianA = scoreX(row.medianA);
  const q1B = scoreX(row.q1B);
  const q3B = scoreX(row.q3B);
  const medianB = scoreX(row.medianB);
  return (
    <svg
      viewBox={`0 0 ${SCORE_WIDTH} ${SCORE_HEIGHT}`}
      className="analytics-v2-compare-score__svg"
      aria-hidden="true"
      data-scale-start="1"
      data-scale-end="5"
      data-median-a={row.medianA}
      data-median-b={row.medianB}
      data-iqr-a={`${row.q1A}-${row.q3A}`}
      data-iqr-b={`${row.q1B}-${row.q3B}`}
    >
      <line x1={SCORE_PAD} y1="18" x2={SCORE_WIDTH - SCORE_PAD} y2="18" className="analytics-v2-compare-score__base" />
      <line
        x1={Math.min(q1A, q3A)}
        y1="11"
        x2={Math.max(q1A, q3A)}
        y2="11"
        className="analytics-v2-compare-score__iqr analytics-v2-compare-score__iqr--a"
      />
      <line
        x1={Math.min(q1B, q3B)}
        y1="25"
        x2={Math.max(q1B, q3B)}
        y2="25"
        className="analytics-v2-compare-score__iqr analytics-v2-compare-score__iqr--b"
      />
      <line x1={medianA} y1="11" x2={medianB} y2="25" className="analytics-v2-compare-score__link" />
      <circle cx={medianA} cy="11" r="4.2" className="analytics-v2-compare-score__dot analytics-v2-compare-score__dot--a" />
      <circle cx={medianB} cy="25" r="4.4" className="analytics-v2-compare-score__dot analytics-v2-compare-score__dot--b" />
    </svg>
  );
}

export function PairedScoreDifferencePlot({ items }: { items: ComparisonScoreDifference[] }) {
  const visible = visibleScorePlotRows(items);
  if (visible.length === 0) {
    return <p className="analytics-v2-seg-empty">No comparable score differences to plot.</p>;
  }

  return (
    <div className="analytics-v2-compare-plot" data-testid="paired-score-plot">
      <div className="analytics-v2-compare-plot__legend" aria-hidden="true">
        <span className="analytics-v2-compare-plot__swatch analytics-v2-compare-plot__swatch--a">A</span>
        <span className="analytics-v2-compare-plot__swatch analytics-v2-compare-plot__swatch--b">B</span>
        <small>Score scale 1 (low) to 5 (high)</small>
      </div>
      {visible.map((row) => (
        <PlotRow
          key={`${row.field}:${row.kind}`}
          testId={`score-plot-row:${row.field}`}
          ariaLabel={scorePlotAriaLabel(row)}
          tooltipLines={scorePlotTooltipLines(row)}
        >
          <span className="analytics-v2-compare-plot__meta">
            <strong>{row.label}</strong>
            <small>{COMPARISON_SCORE_KIND_LABEL[row.kind]}</small>
          </span>
          <span className="analytics-v2-compare-plot__track">
            <ScoreMarks row={row} />
            <span className="analytics-v2-compare-score__ends">
              <span>1 low</span>
              <span>5 high</span>
            </span>
          </span>
        </PlotRow>
      ))}
    </div>
  );
}

export function CompositionDifferencePlot({ items }: { items: ComparisonCompositionDifference[] }) {
  const visible = visibleCompositionPlotRows(items);
  if (visible.length === 0) {
    return <p className="analytics-v2-seg-empty">No comparable composition differences to plot.</p>;
  }

  const domain = compositionAxisDomain(visible.map((row) => row.deltaPercentagePoints as number));

  return (
    <div className="analytics-v2-compare-plot" data-testid="composition-plot">
      <div className="analytics-v2-compare-diverge__axis" aria-hidden="true">
        <span>More common in B</span>
        <span>0 pp</span>
        <span>More common in A</span>
      </div>
      <small className="analytics-v2-compare-diverge__domain">
        Bar length uses a ±{domain} pp scale. Labels are percentage-point gaps (A minus B).
      </small>
      {visible.map((row) => {
        const delta = row.deltaPercentagePoints as number;
        const bar = compositionBarLayout(delta, domain);
        const family = row.family === "asset" ? COMPOSITION_FAMILY_LABEL.asset : COMPOSITION_FAMILY_LABEL.category;
        return (
          <PlotRow
            key={`${row.field}:${row.value}`}
            testId={`composition-plot-row:${row.field}:${row.value}`}
            ariaLabel={compositionPlotAriaLabel(row)}
            tooltipLines={compositionPlotTooltipLines(row)}
          >
            <span className="analytics-v2-compare-plot__meta">
              <strong>
                {row.label}: {row.valueLabel}
              </strong>
              <small>{family}</small>
            </span>
            <span className="analytics-v2-compare-diverge__track" data-delta={delta} data-side={bar.side}>
              <i className="analytics-v2-compare-diverge__zero" />
              <span
                className={`analytics-v2-compare-diverge__bar analytics-v2-compare-diverge__bar--${bar.side}`}
                style={{ width: `${bar.ratio * 50}%` }}
              >
                <em>{formatPlotPp(delta)}</em>
              </span>
            </span>
          </PlotRow>
        );
      })}
    </div>
  );
}
