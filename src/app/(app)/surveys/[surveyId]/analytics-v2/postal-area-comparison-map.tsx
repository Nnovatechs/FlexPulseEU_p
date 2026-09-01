"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { PostalMapComparison } from "@/features/surveys/analytics/geography/postal-map-types";
import { loadCountryMapData, type CountryCode, type CountryMapData } from "./postal-area-map-cache";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function countryName(countryCode: CountryCode) {
  switch (countryCode) {
    case "ES":
      return "Spain";
    case "FR":
      return "France";
    case "IE":
      return "Ireland";
  }
}

function divergentFill(deltaPp: number, maxAbsDelta: number) {
  if (maxAbsDelta <= 0 || deltaPp === 0) {
    return "var(--an-surface-alt)";
  }
  const ratio = Math.min(Math.abs(deltaPp) / maxAbsDelta, 1);
  const alpha = 0.16 + ratio * 0.6;
  if (deltaPp > 0) {
    return `color-mix(in srgb, var(--an-accent, #6ea8fe) ${Math.round(alpha * 100)}%, var(--an-surface))`;
  }
  return `color-mix(in srgb, #b877d9 ${Math.round(alpha * 100)}%, var(--an-surface))`;
}

const CountryComparisonMap = memo(function CountryComparisonMap({
  countryCode,
  map,
  comparisonMap,
  maxAbsDelta,
  labelA,
  labelB,
  onTooltipOpen,
  onTooltipClose,
}: {
  countryCode: CountryCode;
  map: CountryMapData;
  comparisonMap: Map<string, PostalMapComparison["areas"][number]>;
  maxAbsDelta: number;
  labelA: string;
  labelB: string;
  onTooltipOpen: (tooltip: { x: number; y: number; title: string; lines: string[] }) => void;
  onTooltipClose: () => void;
}) {
  return (
    <section className="analytics-v2-postal-map__country">
      <header className="analytics-v2-postal-map__country-head">
        <h5>{countryName(countryCode)}</h5>
      </header>
      <svg
        viewBox={map.viewBox}
        className="analytics-v2-postal-map__svg"
        role="img"
        aria-label={`${countryName(countryCode)} relative segment comparison by postal area`}
      >
        {map.shapes.map((shape) => {
          const area = comparisonMap.get(shape.areaKey);
          const fill = divergentFill(area?.deltaPercentagePoints ?? 0, maxAbsDelta);
          return (
            <path
              key={shape.areaKey}
              d={shape.path}
              tabIndex={-1}
              className={`analytics-v2-postal-map__area${area ? "" : " is-dimmed"}`}
              fill={fill}
              onPointerEnter={(event) => {
                if (!area) {
                  onTooltipOpen({
                    x: event.clientX,
                    y: event.clientY,
                    title: `${shape.label} (${shape.postalPrefix})`,
                    lines: ["No mapped responses in either segment."],
                  });
                  return;
                }
                const toward =
                  area.deltaPercentagePoints === 0
                    ? "0 percentage points"
                    : `${area.deltaPercentagePoints > 0 ? "+" : ""}${Math.round(area.deltaPercentagePoints * 10) / 10} percentage points toward ${
                        area.deltaPercentagePoints > 0 ? labelA : labelB
                      }`;
                onTooltipOpen({
                  x: event.clientX,
                  y: event.clientY,
                  title: `${shape.label} (${shape.postalPrefix})`,
                  lines: [
                    `${labelA}: n=${area.nA} · ${Math.round(area.shareA * 100)}% of mapped ${labelA}`,
                    `${labelB}: n=${area.nB} · ${Math.round(area.shareB * 100)}% of mapped ${labelB}`,
                    `Difference: ${toward}`,
                  ],
                });
              }}
              onPointerLeave={onTooltipClose}
              onBlur={onTooltipClose}
            >
              <title>
                {shape.label} ({shape.postalPrefix})
              </title>
            </path>
          );
        })}
      </svg>
    </section>
  );
});

export function PostalAreaComparisonMap({
  comparison,
  active = true,
  labelA,
  labelB,
}: {
  comparison: PostalMapComparison | null;
  active?: boolean;
  labelA: string;
  labelB: string;
}) {
  const countryCodes = useMemo(
    () =>
      Array.from(
        new Set(
          (comparison?.areas ?? [])
            .map((area) => area.countryCode)
            .filter((countryCode): countryCode is CountryCode => countryCode === "ES" || countryCode === "FR" || countryCode === "IE"),
        ),
      ),
    [comparison],
  );
  const [countryMaps, setCountryMaps] = useState<Record<string, CountryMapData>>({});
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    lines: string[];
  } | null>(null);

  useEffect(() => {
    if (!active || countryCodes.length === 0) {
      return;
    }
    let cancelled = false;
    void Promise.all(countryCodes.map(async (countryCode) => [countryCode, await loadCountryMapData(countryCode)] as const))
      .then((entries) => {
        if (!cancelled) {
          setCountryMaps(Object.fromEntries(entries));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCountryMaps({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active, countryCodes]);

  if (!comparison || comparison.areas.length === 0) {
    return null;
  }

  const comparisonMap = new Map(comparison.areas.map((area) => [area.areaKey, area]));
  const maxAbsDelta = comparison.areas.reduce((current, area) => Math.max(current, Math.abs(area.deltaPercentagePoints)), 0);

  return (
    <div className="analytics-v2-postal-map">
      <div className="analytics-v2-postal-map__summary">
        <p>
          <strong>Geographic composition comparison</strong>
        </p>
        <p>Colour shows where each segment has a larger relative share of its mapped responses.</p>
        <p>
          {labelA} mapped: {comparison.coverageA.mappedN} / {comparison.coverageA.eligibleN}
        </p>
        <p>
          {labelB} mapped: {comparison.coverageB.mappedN} / {comparison.coverageB.eligibleN}
        </p>
      </div>

      <div className="analytics-v2-postal-map__legend">
        <span>
          <i className="analytics-v2-postal-map__legend-swatch analytics-v2-postal-map__legend-swatch--a" />
          More relative presence in {labelA}
        </span>
        <span>
          <i className="analytics-v2-postal-map__legend-swatch analytics-v2-postal-map__legend-swatch--b" />
          More relative presence in {labelB}
        </span>
      </div>

      <div className="analytics-v2-postal-map__countries">
        {countryCodes
          .map((countryCode) => ({ countryCode, map: countryMaps[countryCode] }))
          .filter((entry): entry is { countryCode: CountryCode; map: CountryMapData } => Boolean(entry.map))
          .map(({ countryCode, map }) => (
            <CountryComparisonMap
              key={countryCode}
              countryCode={countryCode}
              map={map}
              comparisonMap={comparisonMap}
              maxAbsDelta={maxAbsDelta}
              labelA={labelA}
              labelB={labelB}
              onTooltipOpen={setTooltip}
              onTooltipClose={() => setTooltip(null)}
            />
          ))}
      </div>

      {tooltip ? (
        <div
          className="analytics-v2-postal-map__tooltip"
          style={{
            left: clamp(tooltip.x + 14, 12, window.innerWidth - 240),
            top: clamp(tooltip.y + 14, 12, window.innerHeight - 140),
          }}
        >
          <strong>{tooltip.title}</strong>
          {tooltip.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
