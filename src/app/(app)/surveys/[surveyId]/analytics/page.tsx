import Link from "next/link";
import { notFound } from "next/navigation";
import { PendingNavLink } from "@/components/pending-nav-link";
import { FLEXPULSE_DER_ASSET_VALUES } from "@/features/ontology/flexpulse-behavioural-schema";
import {
  classifySurveyAnalyticsEvidence,
  type SurveyAnalyticsFieldDefinition,
  type SurveyAnalyticsQueryRow,
} from "@/features/surveys/survey-analytics";
import {
  getSurveyAnalyticsPageData,
  getSurveyById,
} from "@/features/surveys/use-cases";
import {
  buildBaselineMetrics,
  buildCapabilityFacetMetrics,
  buildHrefWithProfileConditions,
  buildRadarGridPolygon,
  buildRadarPolygon,
  buildSegmentMetrics,
  buildSelectedFilters,
  describeAverage,
  formatCompactCount,
  formatDateShort,
  formatMetricValue,
  formatPlainValue,
  getActiveProfileConditions,
  getConceptShortLabel,
  getConceptTitle,
  getDeltaTone,
  getDifferenceLabel,
  getDominantTag,
  getEvidenceLabel,
  getEvidenceTone,
  getGroupLabel,
  getHumanTag,
  getScoreTone,
  getTagTone,
  getMetric,
  getMetricValue,
  getCapabilityFacetFields,
  getPrimaryProfileFields,
  getRadarAxisLabel,
  getScoreBarWidth,
  getScoreRange,
  getSearchParam,
  getSegmentFieldLabel,
  getSingleGroup,
  getVisibleProfileConditions,
  groupFieldsBySource,
  MAX_BREAKDOWN_ROWS,
  MAX_INTELLIGENCE_AXES,
  MAX_PROFILE_CONCEPTS,
  MAX_RADAR_AXES,
  metricKeyFor,
  optionsFromRows,
  polarPoint,
  shouldSuppressCapabilityFacet,
  TAG_VALUES,
  type ProfileCondition,
} from "@/features/surveys/analytics/profile-explorer-utils";
import { appRoutes } from "@/lib/config/routes";
import { AnalyticsTabs, type AnalyticsTab } from "./analytics-tabs";
import { ComparisonBuilder, type ComparisonSelectionState } from "./comparison-builder";
import {
  buildJointBandShareCandidates,
  buildSurveyInsights,
  INSIGHT_THRESHOLDS,
  MIN_INSIGHT_SAMPLE,
  MIN_MEANINGFUL_DELTA,
  type JointBandShare,
} from "@/features/surveys/analytics/overview-insights";

type SurveyAnalyticsPageProps = {
  params: Promise<{ surveyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FilterOption = {
  value: string;
  label: string;
  description?: string;
};

type ComparisonSelection = ComparisonSelectionState;

function humanizeFilterLabel(value: string) {
  if (value === "neutral" || value === "neutral_mainstream") {
    return "Neutral Position";
  }

  const normalized = value.replace(/[_-]+/g, " ").trim();

  if (!normalized) {
    return "Unknown";
  }

  if (/^[a-z]{2}$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildFilterHref(
  searchParams: Record<string, string | string[] | undefined>,
  name: string,
  value: string,
) {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (rawValue == null) {
      continue;
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const entry of values) {
      params.append(key, entry);
    }
  }

  params.delete(name);

  if (value) {
    params.set(name, value);
  }

  const query = params.toString();
  return query ? `?${query}` : "?";
}

function FilterOptionGroup({
  name,
  label,
  allLabel,
  value,
  searchParams,
  options,
}: {
  name: string;
  label: string;
  allLabel: string;
  value: string;
  searchParams: Record<string, string | string[] | undefined>;
  options: FilterOption[];
}) {
  return (
    <section className="analytics-filter-section">
      <h3>{label}</h3>
      <div className="analytics-filter-options">
        <Link
          href={buildFilterHref(searchParams, name, "")}
          className={`analytics-filter-option${value ? "" : " is-active"}`}
          aria-current={value ? undefined : "true"}
        >
          {allLabel}
        </Link>
        {options.map((option) => {
          const isActive = value === option.value;

          return (
            <Link
              key={option.value}
              href={buildFilterHref(searchParams, name, isActive ? "" : option.value)}
              className={`analytics-filter-option${isActive ? " is-active" : ""}`}
              aria-current={isActive ? "true" : undefined}
              title={option.description}
              data-tooltip={option.description}
            >
              {humanizeFilterLabel(option.label)}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ProfileBandFilterGroup({
  searchParams,
  tagFields,
  selectedValue,
  options,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  tagFields: SurveyAnalyticsFieldDefinition[];
  selectedValue: string;
  options: FilterOption[];
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <section className="analytics-filter-section">
      <h3>Profile axis bands</h3>
      <div className="analytics-filter-options">
        <Link
          href={buildHrefWithProfileConditions(searchParams, [])}
          className={`analytics-filter-option${selectedValue ? "" : " is-active"}`}
          aria-current={selectedValue ? undefined : "true"}
        >
          All profile bands
        </Link>
        {options.map((option) => {
          const isActive = selectedValue === option.value;
          return (
            <Link
              key={option.value}
              href={buildHrefWithProfileConditions(
                searchParams,
                isActive ? [] : parseProfileBandValue(option.value, tagFields),
              )}
              className={`analytics-filter-option${isActive ? " is-active" : ""}`}
              aria-current={isActive ? "true" : undefined}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function EvidenceBadge({
  evidence,
}: {
  evidence: SurveyAnalyticsQueryRow["evidence"];
}) {
  return (
    <span className={`evidence-badge evidence-badge--${getEvidenceTone(evidence.label)}`}>
      {getEvidenceLabel(evidence.label)} · n={evidence.response_count}
    </span>
  );
}

function RenderFieldTags({
  fields,
  emptyLabel,
}: {
  fields: SurveyAnalyticsFieldDefinition[];
  emptyLabel: string;
}) {
  if (fields.length === 0) {
    return <p>{emptyLabel}</p>;
  }

  return (
    <div className="survey-card__concepts">
      {fields.map((field) => (
        <span key={field.key} className="tag">
          {field.key}
        </span>
      ))}
    </div>
  );
}

function FilterRailForm({
  searchParams,
  profileBandOptions,
  tagFields,
  countryOptions,
  audienceOptions,
  languageOptions,
  assetOptions,
  capabilityApplicabilityOptions,
  selectedCountry,
  selectedAudience,
  selectedLanguage,
  selectedTag,
  selectedAsset,
  selectedCapabilityApplicability,
  selectedProfileBand,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  profileBandOptions: FilterOption[];
  tagFields: SurveyAnalyticsFieldDefinition[];
  countryOptions: FilterOption[];
  audienceOptions: FilterOption[];
  languageOptions: FilterOption[];
  assetOptions: FilterOption[];
  capabilityApplicabilityOptions: FilterOption[];
  selectedCountry: string;
  selectedAudience: string;
  selectedLanguage: string;
  selectedTag: string;
  selectedAsset: string;
  selectedCapabilityApplicability: string;
  selectedProfileBand: string;
}) {
  return (
    <div className="analytics-filter-rail">
      <p className="analytics-filter-rail__heading">Cohort filter</p>
      <div className="analytics-filter-form">
        <ProfileBandFilterGroup
          searchParams={searchParams}
          tagFields={tagFields}
          selectedValue={selectedProfileBand}
          options={profileBandOptions}
        />
        <FilterOptionGroup
          name="country"
          label="Country"
          allLabel="All countries"
          value={selectedCountry}
          searchParams={searchParams}
          options={countryOptions}
        />
        <FilterOptionGroup
          name="language"
          label="Language"
          allLabel="All languages"
          value={selectedLanguage}
          searchParams={searchParams}
          options={languageOptions}
        />
        <FilterOptionGroup
          name="tag"
          label="Trust band"
          allLabel="All trust bands"
          value={selectedTag}
          searchParams={searchParams}
          options={TAG_VALUES.map((tag) => ({
            value: tag,
            label: `${tag}${getHumanTag(tag) ? ` (${getHumanTag(tag)})` : ""}`,
          }))}
        />
        {assetOptions.length > 0 ? (
          <FilterOptionGroup
            name="asset"
            label="DER asset"
            allLabel="All assets"
            value={selectedAsset}
            searchParams={searchParams}
            options={assetOptions}
          />
        ) : null}
        {capabilityApplicabilityOptions.length > 0 ? (
          <FilterOptionGroup
            name="dfcApplicability"
            label="DFC applicability"
            allLabel="All applicability states"
            value={selectedCapabilityApplicability}
            searchParams={searchParams}
            options={capabilityApplicabilityOptions}
          />
        ) : null}
        <FilterOptionGroup
          name="audience"
          label="Response cohort"
          allLabel="All cohorts"
          value={selectedAudience}
          searchParams={searchParams}
          options={audienceOptions}
        />
      </div>
    </div>
  );
}

function describeComparisonSelection(selection: ComparisonSelection, profileBandOptions: FilterOption[] = []) {
  const profileBandLabel = selection.profileBand
    ? profileBandOptions.find((option) => option.value === selection.profileBand)?.label
    : null;
  const parts = [
    profileBandLabel ? humanizeFilterLabel(profileBandLabel) : null,
    selection.country ? humanizeFilterLabel(selection.country) : null,
    selection.language ? humanizeFilterLabel(selection.language) : null,
    selection.asset ? humanizeFilterLabel(selection.asset) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "All mapped respondents";
}

function areComparisonSelectionsEqual(left: ComparisonSelection, right: ComparisonSelection) {
  return (
    left.profileBand === right.profileBand &&
    left.country === right.country &&
    left.language === right.language &&
    left.asset === right.asset
  );
}

function encodeProfileBandValue(fieldKey: string, tag: string) {
  return `${fieldKey}::${tag}`;
}

function parseProfileBandValue(value: string, tagFields: SurveyAnalyticsFieldDefinition[]): ProfileCondition[] {
  const [fieldKey, tag] = value.split("::");
  if (!fieldKey || !tag || !TAG_VALUES.includes(tag as (typeof TAG_VALUES)[number])) {
    return [];
  }

  return tagFields.some((field) => field.key === fieldKey)
    ? [{ fieldKey, tag }]
    : [];
}

function buildProfileBandOptions(
  tagFields: SurveyAnalyticsFieldDefinition[],
  tags: readonly string[] = TAG_VALUES,
) {
  return tagFields.flatMap((field) =>
    tags.map((tag) => ({
      value: encodeProfileBandValue(field.key, tag),
      label: `${getConceptShortLabel(field).replace(/\s+tag$/i, "")} · ${getHumanTag(tag) ?? humanizeFilterLabel(tag)}`,
    })),
  );
}

function ComparisonRadarCard({
  fields,
  leftRow,
  rightRow,
  leftLabel,
  rightLabel,
}: {
  fields: SurveyAnalyticsFieldDefinition[];
  leftRow: SurveyAnalyticsQueryRow | null;
  rightRow: SurveyAnalyticsQueryRow | null;
  leftLabel: string;
  rightLabel: string;
}) {
  const visibleFields = fields.slice(0, MAX_RADAR_AXES);
  const series = [
    leftRow
      ? {
          label: leftLabel,
          colorClass: "radar-series--accent",
          row: leftRow,
          responses: getMetricValue(leftRow, "responses") ?? 0,
        }
      : null,
    rightRow
      ? {
          label: rightLabel,
          colorClass: "radar-series--secondary",
          row: rightRow,
          responses: getMetricValue(rightRow, "responses") ?? 0,
        }
      : null,
  ].filter(
    (
      entry,
    ): entry is {
      label: string;
      colorClass: string;
      row: SurveyAnalyticsQueryRow;
      responses: number;
    } => Boolean(entry),
  );
  const cx = 180;
  const cy = 190;
  const radius = 118;
  const levels = [0.25, 0.5, 0.75, 1];

  if (visibleFields.length < 3 || series.length < 2) {
    return (
      <article className="surface-card radar-card">
        <h2>Profile-axis radar</h2>
        <div className="empty-state empty-state--inline">
          <h3>Not enough comparable data</h3>
          <p>Comparison radar needs two matching segments and at least three profile axes.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="surface-card radar-card comparison-radar-card">
      <div className="radar-card__header">
        <div>
          <h2>Profile-axis radar</h2>
          <p>Average mapped profile score for each compared segment on the main 1-5 axes.</p>
        </div>
      </div>
      <div className="radar-chart-shell">
        <svg viewBox="0 0 360 380" role="img" aria-label="Radar comparison of selected segments">
          {levels.map((level) => (
            <polygon
              key={level}
              points={buildRadarGridPolygon(visibleFields.length, cx, cy, radius * level)}
              className="radar-grid"
            />
          ))}
          {visibleFields.map((field, index) => {
            const angle = -Math.PI / 2 + (index / visibleFields.length) * Math.PI * 2;
            const axisPoint = polarPoint(cx, cy, radius, angle);
            const labelPoint = polarPoint(cx, cy, radius + 28, angle);

            return (
              <g key={field.key}>
                <line x1={cx} y1={cy} x2={axisPoint.x} y2={axisPoint.y} className="radar-axis" />
                <text x={labelPoint.x} y={labelPoint.y} className="radar-label" textAnchor="middle">
                  {getRadarAxisLabel(field)}
                </text>
              </g>
            );
          })}
          {series.map((entry) => {
            const values = visibleFields.map((field) => {
              const key = metricKeyFor("avg", field);
              return getMetricValue(entry.row, key) ?? 0;
            });

            return (
              <g key={entry.label}>
                <polygon
                  points={buildRadarPolygon(values, cx, cy, radius)}
                  className={`radar-area ${entry.colorClass}`}
                />
                <polyline
                  points={buildRadarPolygon(values, cx, cy, radius)}
                  className={`radar-line ${entry.colorClass}`}
                />
              </g>
            );
          })}
        </svg>
        <div className="radar-legend">
          {series.map((entry) => (
            <div key={entry.label} className="radar-legend__item">
              <span className={`radar-dot ${entry.colorClass}`} />
              <strong>{entry.label}</strong>
              <small>{formatCompactCount(entry.responses)} respondents</small>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function ComparisonCountryRepresentation({
  leftRows,
  rightRows,
  countryField,
  leftTotal,
  rightTotal,
}: {
  leftRows: SurveyAnalyticsQueryRow[];
  rightRows: SurveyAnalyticsQueryRow[];
  countryField: SurveyAnalyticsFieldDefinition | null;
  leftTotal: number;
  rightTotal: number;
}) {
  const countries = Array.from(
    new Set([
      ...leftRows.map((row) => (countryField ? getGroupLabel(row, countryField.key) : "Unknown")),
      ...rightRows.map((row) => (countryField ? getGroupLabel(row, countryField.key) : "Unknown")),
    ]),
  ).slice(0, MAX_BREAKDOWN_ROWS);

  if (!countryField || countries.length === 0) {
    return (
      <article className="surface-card">
        <h2>Country representation</h2>
        <div className="empty-state empty-state--inline">
          <h3>No country split available</h3>
          <p>This comparison appears when mapped responses include country context.</p>
        </div>
      </article>
    );
  }

  const countryKey = countryField.key;

  function valueFor(rows: SurveyAnalyticsQueryRow[], country: string) {
    const row = rows.find((candidate) => getGroupLabel(candidate, countryKey) === country);
    return getMetricValue(row, "responses") ?? 0;
  }

  return (
    <article className="surface-card comparison-country-card">
      <h2>Country representation</h2>
      <p>Share of each selected segment represented in each country.</p>
      <div className="comparison-country-list">
        {countries.map((country) => {
          const leftValue = valueFor(leftRows, country);
          const rightValue = valueFor(rightRows, country);
          const leftShare = leftTotal > 0 ? leftValue / leftTotal : 0;
          const rightShare = rightTotal > 0 ? rightValue / rightTotal : 0;

          return (
            <div key={country} className="comparison-country-row">
              <strong>{country}</strong>
              <div>
                <span>A {formatPlainValue(leftShare, "share")}</span>
                <i style={{ width: `${Math.max(2, leftShare * 100)}%` }} />
              </div>
              <div>
                <span>B {formatPlainValue(rightShare, "share")}</span>
                <i style={{ width: `${Math.max(2, rightShare * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ComparisonWorkbench({
  profileBandOptions,
  countryOptions,
  languageOptions,
  assetOptions,
  leftSelection,
  rightSelection,
  compared,
  comparable,
  leftRow,
  rightRow,
  leftCountryRows,
  rightCountryRows,
  countryField,
  profileFields,
}: {
  profileBandOptions: FilterOption[];
  countryOptions: FilterOption[];
  languageOptions: FilterOption[];
  assetOptions: FilterOption[];
  leftSelection: ComparisonSelection;
  rightSelection: ComparisonSelection;
  compared: boolean;
  comparable: boolean;
  leftRow: SurveyAnalyticsQueryRow | null;
  rightRow: SurveyAnalyticsQueryRow | null;
  leftCountryRows: SurveyAnalyticsQueryRow[];
  rightCountryRows: SurveyAnalyticsQueryRow[];
  countryField: SurveyAnalyticsFieldDefinition | null;
  profileFields: SurveyAnalyticsFieldDefinition[];
}) {
  const leftLabel = describeComparisonSelection(leftSelection, profileBandOptions);
  const rightLabel = describeComparisonSelection(rightSelection, profileBandOptions);
  const leftTotal = getMetricValue(leftRow, "responses") ?? 0;
  const rightTotal = getMetricValue(rightRow, "responses") ?? 0;

  return (
    <div className="comparison-workbench">
      <ComparisonBuilder
        leftSelection={leftSelection}
        rightSelection={rightSelection}
        profileBandOptions={profileBandOptions}
        countryOptions={countryOptions}
        languageOptions={languageOptions}
        assetOptions={assetOptions}
      />

      {!compared ? (
        <section className="surface-card">
          <div className="empty-state empty-state--inline">
            <h3>Choose two cohorts to compare</h3>
            <p>Select filters for Segment A and Segment B, then press Compare to run the comparison.</p>
          </div>
        </section>
      ) : !comparable ? (
        <section className="surface-card">
          <div className="empty-state empty-state--inline">
            <h3>Choose two different cohorts</h3>
            <p>Segment A and Segment B currently use the same filters, so there is no useful comparison.</p>
          </div>
        </section>
      ) : (
        <section className="comparison-results">
          <div className="comparison-summary-grid">
            <article className="surface-card comparison-summary-card">
              <h2>Segment A</h2>
              <strong>{leftLabel}</strong>
              {leftRow ? <EvidenceBadge evidence={leftRow.evidence} /> : null}
              <p>{formatCompactCount(leftTotal)} matching respondents</p>
            </article>
            <article className="surface-card comparison-summary-card">
              <h2>Segment B</h2>
              <strong>{rightLabel}</strong>
              {rightRow ? <EvidenceBadge evidence={rightRow.evidence} /> : null}
              <p>{formatCompactCount(rightTotal)} matching respondents</p>
            </article>
          </div>
          <ComparisonRadarCard
            fields={profileFields}
            leftRow={leftRow}
            rightRow={rightRow}
            leftLabel="Segment A"
            rightLabel="Segment B"
          />
          <ComparisonCountryRepresentation
            leftRows={leftCountryRows}
            rightRows={rightCountryRows}
            countryField={countryField}
            leftTotal={leftTotal}
            rightTotal={rightTotal}
          />
        </section>
      )}
    </div>
  );
}

function SegmentOpportunityFinder({
  searchParams,
  tagFields,
  conditions,
  activeConditions,
  selectedRow,
  countryRows,
  countryField,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  tagFields: SurveyAnalyticsFieldDefinition[];
  conditions: ProfileCondition[];
  activeConditions: ProfileCondition[];
  selectedRow: SurveyAnalyticsQueryRow | null;
  countryRows: SurveyAnalyticsQueryRow[];
  countryField: SurveyAnalyticsFieldDefinition | null;
}) {
  if (tagFields.length === 0) {
    return (
      <section id="segment-finder" className="surface-card segment-finder">
        <h2>Segment Opportunity Finder</h2>
        <div className="empty-state empty-state--inline">
          <h3>No profile tags available</h3>
          <p>This builder needs tagged profile axes (`low` / `medium` / `high`) in the measurement plan.</p>
        </div>
      </section>
    );
  }

  const nextCondition: ProfileCondition = {
    fieldKey: tagFields[0]?.key ?? "",
    tag: "high",
  };
  const addConditionHref = buildHrefWithProfileConditions(searchParams, [...conditions, nextCondition]);
  const matchedRespondents = getMetricValue(selectedRow, "responses");
  const suppressSegmentDetail = Boolean(selectedRow?.evidence.suppress_detail);
  const countryDistribution = activeConditions.length > 0 && countryField && !suppressSegmentDetail
    ? countryRows
        .map((row) => ({
          label: getGroupLabel(row, countryField.key),
          value: row.metrics.responses.value,
          unit: "count" as const,
        }))
        .filter((row): row is { label: string; value: number; unit: "count" } => row.value != null)
    : [];

  return (
    <section id="segment-finder" className="surface-card segment-finder">
      <div>
        <h2>Segment Opportunity Finder</h2>
        <p>
          Build a behavioural filter using profile bands. The segment includes respondents that
          satisfy all selected conditions.
        </p>
      </div>

      <form className="segment-condition-list" action="">
        <input type="hidden" name="view" value="segments" />
        {conditions.map((condition, index) => {
          const removeHref = buildHrefWithProfileConditions(
            searchParams,
            conditions.filter((_, conditionIndex) => conditionIndex !== index),
          );

          return (
            <div key={`${condition.fieldKey}-${condition.tag}-${index}`} className="segment-condition-row">
              <span>{index + 1}</span>
              <select name="profileField" defaultValue={condition.fieldKey}>
                {tagFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {getConceptShortLabel(field).replace(/\s+tag$/i, "")}
                  </option>
                ))}
              </select>
              <small>is</small>
              <select name="profileTag" defaultValue={condition.tag}>
                {TAG_VALUES.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                  </option>
                ))}
              </select>
              {conditions.length > 1 ? (
                <Link href={removeHref} className="segment-condition-remove" aria-label="Remove condition">
                  ×
                </Link>
              ) : (
                <span className="segment-condition-remove segment-condition-remove--disabled">×</span>
              )}
            </div>
          );
        })}

        <div className="segment-condition-actions">
          <Link href={addConditionHref} className="button button--secondary">
            + Add condition
          </Link>
          <button type="submit" className="button button--primary">
            Find segment
          </button>
        </div>
      </form>

      <div className="segment-opportunity-output">
        <article className="segment-opportunity-card">
          <div className="segment-opportunity-card__header">
            <p>Current segment</p>
            <strong>
              {activeConditions.length > 0
                ? activeConditions
                .map((condition) => {
                  const field = tagFields.find((candidate) => candidate.key === condition.fieldKey);
                  return field
                    ? `${getConceptShortLabel(field).replace(/\s+tag$/i, "")} = ${condition.tag}`
                    : null;
                })
                .filter(Boolean)
                .join(" + ")
                : "No behavioural segment applied yet"}
            </strong>
          </div>
          {activeConditions.length > 0 ? (
            <>
              {selectedRow ? <EvidenceBadge evidence={selectedRow.evidence} /> : null}
              <p>
                Matched respondents: <strong>{formatPlainValue(matchedRespondents)}</strong>. Size and
                geographic mix of the selected cohort — descriptive, not a deployment recommendation.
              </p>
              {selectedRow?.evidence.suppress_detail ? (
                <p className="evidence-warning">
                  Segment details are suppressed because fewer than 5 respondents match this
                  selection.
                </p>
              ) : selectedRow ? (
                <p className="evidence-warning">{selectedRow.evidence.description}</p>
              ) : (
                <p className="evidence-warning">
                  No respondents currently match all selected behavioural conditions.
                </p>
              )}
            </>
          ) : (
            <p>
              Choose one or more conditions and press <strong>Find segment</strong>. Until then, no
              behavioural filter is applied to the survey.
            </p>
          )}
        </article>

        <ProgressListCard
          title="Countries inside this segment"
          description="Count of respondents matching all current behavioural conditions."
          rows={countryDistribution}
        />
      </div>
    </section>
  );
}

function BreakdownCard({
  title,
  description,
  rows,
  groupField,
  metricKeys,
}: {
  title: string;
  description: string;
  rows: SurveyAnalyticsQueryRow[];
  groupField: string;
  metricKeys: string[];
}) {
  return (
    <article className="surface-card">
      <h2>{title}</h2>
      <p>{description}</p>
      {rows.length > 0 ? (
        <div className="stack-list">
          {rows.slice(0, MAX_BREAKDOWN_ROWS).map((row) => (
            <div key={`${groupField}-${getGroupLabel(row, groupField)}`} className="analytics-row">
              <strong>{getGroupLabel(row, groupField)}</strong>
              <span>
                {metricKeys
                  .map((metricKey) => {
                    const metric = row.metrics[metricKey];
                    if (!metric) {
                      return null;
                    }
                    return `${metricKey}: ${formatMetricValue(metric)}`;
                  })
                  .filter(Boolean)
                  .join(" · ")}
                {" · "}
                <EvidenceBadge evidence={row.evidence} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No grouped results yet</h3>
          <p>This preview will populate once mapped responses are available.</p>
        </div>
      )}
    </article>
  );
}

function ProfileOverviewCard({
  selectedRow,
  baselineRow,
  profileValueFields,
  tagFields,
  hasActiveFilters,
}: {
  selectedRow: SurveyAnalyticsQueryRow | null;
  baselineRow: SurveyAnalyticsQueryRow | null;
  profileValueFields: SurveyAnalyticsFieldDefinition[];
  tagFields: SurveyAnalyticsFieldDefinition[];
  hasActiveFilters: boolean;
}) {
  const row = selectedRow ?? baselineRow;

  if (!row || profileValueFields.length === 0) {
    return (
      <article className="surface-card">
        <h2>What is this cohort like?</h2>
        <div className="empty-state empty-state--inline">
          <h3>No profile metrics yet</h3>
          <p>Mapped responses are required before the aggregate profile can be shown.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="surface-card profile-panel">
      <h2>{hasActiveFilters ? "What is this selected cohort like?" : "What is the overall profile?"}</h2>
      <p>
        {hasActiveFilters
          ? "This describes the respondents matching the active filters, compared with the full survey baseline below."
          : "This describes all mapped respondents in the survey. Use filters above to ask a more specific cohort question."}
      </p>
      <EvidenceBadge evidence={row.evidence} />
      {row.evidence.suppress_detail ? (
        <p className="evidence-warning">
          This selection matches fewer than 5 respondents. Profile details are hidden for privacy.
          Adjust the filters above to explore a larger cohort.
        </p>
      ) : (
        <>
          {row.evidence.label !== "usable" ? (
            <p className="evidence-warning">{row.evidence.description}</p>
          ) : null}
          <div className="profile-score-grid">
            {profileValueFields.slice(0, MAX_PROFILE_CONCEPTS).map((field) => {
              const averageKey = metricKeyFor("avg", field);
              const tagField = tagFields.find((candidate) => candidate.concept_key === field.concept_key);
              const dominantTag = tagField ? getDominantTag(row, tagField) : null;
              const average = getMetricValue(row, averageKey);
              const baselineAverage = getMetricValue(baselineRow, averageKey);
              const delta =
                hasActiveFilters && average != null && baselineAverage != null
                  ? average - baselineAverage
                  : null;

              return (
                <div key={field.key} className="profile-score-card" data-tone={getScoreTone(average)}>
                  <span>{getConceptShortLabel(field)}</span>
                  <strong>{describeAverage(average)}</strong>
                  <small>
                    {dominantTag ? (
                      <span className="tag-band" data-tone={getTagTone(dominantTag.tag)}>
                        {getHumanTag(dominantTag.tag) ?? dominantTag.tag} dominant ·{" "}
                        {formatPlainValue(dominantTag.value, "share")}
                      </span>
                    ) : (
                      `score ${formatPlainValue(average)}`
                    )}
                    {delta != null ? (
                      <>
                        {" · "}
                        <span className="delta" data-tone={getDeltaTone(delta)}>
                          {getDifferenceLabel(delta)} vs baseline
                        </span>
                      </>
                    ) : null}
                  </small>
                </div>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}

function CapabilityFacetsCard({
  selectedRow,
  baselineRow,
  fields,
}: {
  selectedRow: SurveyAnalyticsQueryRow | null;
  baselineRow: SurveyAnalyticsQueryRow | null;
  fields: SurveyAnalyticsFieldDefinition[];
}) {
  const row = selectedRow ?? baselineRow;
  if (!row || fields.length === 0) {
    return null;
  }

  return (
    <article className="surface-card surface-card--wide">
      <h2>Declared capability by applicable set</h2>
      <p>
        Set scores include only respondents for whom that asset set applied. Not-applicable
        responses are excluded rather than classified as low.
      </p>
      {row.evidence.suppress_detail ? (
        <p className="evidence-warning">
          This selection matches fewer than 5 respondents. Capability facet details are hidden
          for privacy.
        </p>
      ) : (
        <div className="stack-list">
          {fields.map((field) => {
            const metric = row.metrics[metricKeyFor("avg", field)];
            const suppressFacet = shouldSuppressCapabilityFacet(metric);
            const notApplicable = Math.max(0, row.response_count - (metric?.sample_size ?? 0));
            return (
              <div key={field.key} className="analytics-row">
                <strong>{humanizeFilterLabel(field.facet ?? field.label)}</strong>
                {suppressFacet ? (
                  <span>Suppressed for privacy (fewer than 5 applicable responses)</span>
                ) : (
                  <span>
                    score {formatMetricValue(metric!)} · applicable n=
                    {metric!.sample_size} · not applicable n={notApplicable}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function DifferentiatorsCard({
  baselineRow,
  segmentRows,
  segmentField,
  profileValueFields,
}: {
  baselineRow: SurveyAnalyticsQueryRow | null;
  segmentRows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
  profileValueFields: SurveyAnalyticsFieldDefinition[];
}) {
  const strongest = segmentRows
    .filter((row) => !row.evidence.suppress_detail)
    .flatMap((row) =>
      profileValueFields.map((field) => {
        const key = metricKeyFor("avg", field);
        const segmentValue = getMetricValue(row, key);
        const baselineValue = getMetricValue(baselineRow, key);
        const delta =
          segmentValue != null && baselineValue != null ? segmentValue - baselineValue : null;

        return {
          label: `${getGroupLabel(row, segmentField?.key ?? "")} · ${getConceptShortLabel(field)}`,
          delta,
          segmentValue,
          baselineValue,
          sampleSize: row.metrics[key]?.sample_size ?? 0,
          evidence: row.evidence,
        };
      }),
    )
    .filter((entry): entry is typeof entry & { delta: number } => entry.delta != null)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 5);

  return (
    <article className="surface-card">
      <h2>Key differentiators</h2>
      <p>Largest deviations from the full-survey baseline.</p>
      {strongest.length > 0 ? (
        <div className="stack-list">
          {strongest.map((entry) => (
            <div key={entry.label} className="analytics-row">
              <strong>{entry.label}</strong>
              <span>
                <span className="delta" data-tone={getDeltaTone(entry.delta)}>
                  {getDifferenceLabel(entry.delta)} vs baseline
                </span>{" "}
                · selected {formatPlainValue(entry.segmentValue)} · baseline{" "}
                {formatPlainValue(entry.baselineValue)} · n={entry.sampleSize}
                {" · "}
                <EvidenceBadge evidence={entry.evidence} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No differentiators yet</h3>
          <p>Segment differences will appear when mapped responses are available.</p>
        </div>
      )}
    </article>
  );
}

function ConceptComparisonTable({
  baselineRow,
  segmentRows,
  segmentField,
  profileValueFields,
}: {
  baselineRow: SurveyAnalyticsQueryRow | null;
  segmentRows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
  profileValueFields: SurveyAnalyticsFieldDefinition[];
}) {
  const visibleFields = profileValueFields.slice(0, MAX_PROFILE_CONCEPTS);

  return (
    <article className="surface-card surface-card--wide">
      <h2>Segment profile comparison</h2>
      <p>Strongest segment groups versus the full-survey baseline.</p>
      {segmentRows.length > 0 && visibleFields.length > 0 ? (
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Segment</th>
                <th>Responses</th>
                <th>Evidence</th>
                {visibleFields.map((field) => (
                  <th key={field.key}>{getConceptShortLabel(field)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segmentRows.slice(0, MAX_BREAKDOWN_ROWS).map((row) => (
                <tr key={getGroupLabel(row, segmentField?.key ?? "")}>
                  <td>{getGroupLabel(row, segmentField?.key ?? "")}</td>
                  <td>{formatMetricValue(row.metrics.responses)}</td>
                  <td>
                    <EvidenceBadge evidence={row.evidence} />
                  </td>
                  {visibleFields.map((field) => {
                    if (row.evidence.suppress_detail) {
                      return (
                        <td key={field.key}>
                          <small>Suppressed</small>
                        </td>
                      );
                    }

                    const key = metricKeyFor("avg", field);
                    const value = getMetricValue(row, key);
                    const baseline = getMetricValue(baselineRow, key);
                    const delta = value != null && baseline != null ? value - baseline : null;

                    return (
                      <td key={field.key} data-tone={getScoreTone(value)}>
                        <strong>{formatPlainValue(value)}</strong>
                        {delta != null ? (
                          <small className="delta" data-tone={getDeltaTone(delta)}>
                            {getDifferenceLabel(delta)} vs base
                          </small>
                        ) : (
                          <small />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No segment comparison yet</h3>
          <p>Comparison needs at least one grouping field and one numerical profile concept.</p>
        </div>
      )}
    </article>
  );
}

function TagDistributionCard({
  tagField,
  rows,
}: {
  tagField: SurveyAnalyticsFieldDefinition | null;
  rows: SurveyAnalyticsQueryRow[];
}) {
  return (
    <article className="surface-card">
      <h2>Profile tag distribution</h2>
      <p>Low, medium and high profile bands for the first tag-enabled concept.</p>
      {tagField && rows.length > 0 ? (
        <div className="stack-list">
          {rows.map((row) => {
            const band = getGroupLabel(row, tagField.key);
            return (
              <div key={`${tagField.key}-${band}`} className="analytics-row">
                <strong>
                  <span className="tag-band" data-tone={getTagTone(band.toLowerCase())}>
                    {band}
                  </span>
                </strong>
                <span>
                  {formatMetricValue(row.metrics.responses)} · sample{" "}
                  {row.metrics.responses.sample_size}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No tag distribution yet</h3>
          <p>This survey currently has no tag field or no mapped responses.</p>
        </div>
      )}
    </article>
  );
}

function AssetDistributionCard({
  baselineRow,
  assetField,
}: {
  baselineRow: SurveyAnalyticsQueryRow | null;
  assetField: SurveyAnalyticsFieldDefinition | null;
}) {
  const assets = assetField
    ? FLEXPULSE_DER_ASSET_VALUES
        .map((asset) => ({
          asset,
          metric: getMetric(baselineRow, `asset_${asset}`),
        }))
        .filter((entry) => entry.metric)
    : [];

  return (
    <article className="surface-card">
      <h2>DER asset signals</h2>
      <p>Share of mapped responses containing each DER-relevant asset value.</p>
      {assets.length > 0 ? (
        <div className="stack-list">
          {assets.map(({ asset, metric }) => (
            <div key={asset} className="analytics-row">
              <strong>{asset.replaceAll("_", " ")}</strong>
              <span>
                {metric ? formatMetricValue(metric) : "No data"} · sample{" "}
                {metric?.sample_size ?? 0}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No asset field found</h3>
          <p>Asset shares appear when the survey maps a string-array DER concept.</p>
        </div>
      )}
    </article>
  );
}

function SurveyInsightPanel({
  profileFields,
  tagFields,
  baselineRow,
  jointBandShares,
  countryRows,
  countryBandRows,
  countryField,
}: {
  profileFields: SurveyAnalyticsFieldDefinition[];
  tagFields: SurveyAnalyticsFieldDefinition[];
  baselineRow: SurveyAnalyticsQueryRow | null;
  jointBandShares: JointBandShare[];
  countryRows: SurveyAnalyticsQueryRow[];
  countryBandRows: SurveyAnalyticsQueryRow[];
  countryField: SurveyAnalyticsFieldDefinition | null;
}) {
  const insights = buildSurveyInsights({
    baselineRow,
    profileFields,
    tagFields,
    jointBandShares,
    countryRows,
    countryBandRows,
    countryField,
  });

  return (
    <section className="intelligence-hero intelligence-hero--insights">
      <h2>Overview insights</h2>
      <span>
        Generated from mapped responses using transparent thresholds: minimum n={MIN_INSIGHT_SAMPLE}
        {" "}per compared group, band share flags from {Math.round(INSIGHT_THRESHOLDS.dominantBandShare * 100)}%,
        {" "}and minimum average delta {MIN_MEANINGFUL_DELTA.toFixed(2)} on the 1-5 profile scale.
      </span>
      <ul className="semantic-insight-list">
        {insights.length > 0 ? (
          insights.slice(0, 4).map((insight) => (
            <li key={`${insight.tone}-${insight.title}`} className="semantic-insight-item" data-tone={insight.tone}>
              <div>
                <strong>{insight.title}</strong>
                <p>{insight.body}</p>
              </div>
              <small>{insight.evidence}</small>
            </li>
          ))
        ) : (
          <li className="semantic-insight-item" data-tone="mainstream">
            <div>
              <strong>Not enough evidence for overview insights yet</strong>
              <p>
                The survey needs mapped responses with enough sample size per group before the system
                surfaces product signals.
              </p>
            </div>
            <small>Minimum n={MIN_INSIGHT_SAMPLE} per reported group.</small>
          </li>
        )}
      </ul>
    </section>
  );
}

function IntelligenceAxisCards({
  fields,
  baselineRow,
  segmentRows,
  segmentField,
}: {
  fields: SurveyAnalyticsFieldDefinition[];
  baselineRow: SurveyAnalyticsQueryRow | null;
  segmentRows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
}) {
  const segmentLabel = getSegmentFieldLabel(segmentField);

  return (
    <section className="intelligence-axis-grid">
      {fields.slice(0, MAX_INTELLIGENCE_AXES).map((field) => {
        const key = metricKeyFor("avg", field);
        const value = getMetricValue(baselineRow, key);
        const range = getScoreRange(segmentRows, segmentField, field);

        return (
          <article key={field.key} className="intelligence-axis-card" data-tone={getScoreTone(value)}>
            <p>{getConceptTitle(field)}</p>
            <strong>{formatPlainValue(value)}</strong>
            <span>Avg mapped score · /5.0</span>
            <div className="intelligence-score-bar">
              <div data-tone={getScoreTone(value)} style={{ width: getScoreBarWidth(value) }} />
            </div>
            <small>
              Low {segmentLabel} {formatPlainValue(range.low)} · High {segmentLabel}{" "}
              {formatPlainValue(range.high)}
            </small>
          </article>
        );
      })}
    </section>
  );
}

function RadarViewCard({
  fields,
  baselineRow,
  segmentRows,
  segmentField,
}: {
  fields: SurveyAnalyticsFieldDefinition[];
  baselineRow: SurveyAnalyticsQueryRow | null;
  segmentRows: SurveyAnalyticsQueryRow[];
  segmentField: SurveyAnalyticsFieldDefinition | null;
}) {
  const visibleFields = fields.slice(0, MAX_RADAR_AXES);
  const segmentSeriesClasses = [
    "radar-series--accent",
    "radar-series--secondary",
    "radar-series--tertiary",
    "radar-series--quaternary",
    "radar-series--quinary",
    "radar-series--senary",
  ];
  const series = [
    baselineRow
      ? {
          label: "Baseline",
          colorClass: "radar-series--baseline",
          row: baselineRow,
          responses: getMetricValue(baselineRow, "responses") ?? 0,
        }
      : null,
    ...segmentRows
      .filter((row) => !row.evidence.suppress_detail)
      .slice()
      .sort((left, right) => (right.response_count ?? 0) - (left.response_count ?? 0))
      .map((row, index) => ({
        label: getGroupLabel(row, segmentField?.key ?? ""),
        colorClass: segmentSeriesClasses[index % segmentSeriesClasses.length],
        row,
        responses: row.response_count ?? 0,
      })),
  ].filter(
    (
      entry,
    ): entry is {
      label: string;
      colorClass: string;
      row: SurveyAnalyticsQueryRow;
      responses: number;
    } => Boolean(entry),
  );

  const cx = 180;
  const cy = 190;
  const radius = 118;
  const levels = [0.25, 0.5, 0.75, 1];
  const comparisonLabel =
    segmentField?.key === "context.country_code"
      ? "countries"
      : `${getSegmentFieldLabel(segmentField)} groups`;

  if (visibleFields.length < 3 || series.length < 2) {
    return (
      <article className="surface-card radar-card">
        <h2>Radar view</h2>
        <div className="empty-state empty-state--inline">
          <h3>Not enough comparable axes yet</h3>
          <p>This chart appears when the survey exposes at least 3 primary profile axes and one segment cut.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="surface-card radar-card">
      <div className="radar-card__header">
        <div>
          <h2>Radar view</h2>
          <p>
            Baseline vs all {comparisonLabel} across the main profile axes.
            {fields.length > MAX_RADAR_AXES ? ` Showing first ${MAX_RADAR_AXES} axes.` : ""}
          </p>
        </div>
      </div>

      <div className="radar-chart-shell">
        <svg viewBox="0 0 360 380" role="img" aria-label="Radar comparison of baseline and top segments">
          {levels.map((level) => (
            <polygon
              key={level}
              points={buildRadarGridPolygon(visibleFields.length, cx, cy, radius * level)}
              className="radar-grid"
            />
          ))}

          {visibleFields.map((field, index) => {
            const angle = -Math.PI / 2 + (index / visibleFields.length) * Math.PI * 2;
            const axisPoint = polarPoint(cx, cy, radius, angle);
            const labelPoint = polarPoint(cx, cy, radius + 28, angle);

            return (
              <g key={field.key}>
                <line x1={cx} y1={cy} x2={axisPoint.x} y2={axisPoint.y} className="radar-axis" />
                <text x={labelPoint.x} y={labelPoint.y} className="radar-label" textAnchor="middle">
                  {getRadarAxisLabel(field)}
                </text>
              </g>
            );
          })}

          {series.map((entry) => {
            const values = visibleFields.map((field) => {
              const key = metricKeyFor("avg", field);
              return getMetricValue(entry.row, key) ?? 0;
            });

            return (
              <g key={entry.label}>
                <polygon
                  points={buildRadarPolygon(values, cx, cy, radius)}
                  className={`radar-area ${entry.colorClass}`}
                />
                <polyline
                  points={buildRadarPolygon(values, cx, cy, radius)}
                  className={`radar-line ${entry.colorClass}`}
                />
              </g>
            );
          })}
        </svg>

        <div className="radar-legend">
          {series.map((entry) => (
            <div key={entry.label} className="radar-legend__item">
              <span className={`radar-dot ${entry.colorClass}`} />
              <strong>{entry.label}</strong>
              <small>{formatCompactCount(entry.responses)} respondents</small>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function ProgressListCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<{ label: string; value: number; unit: "count" | "share" }>;
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <article className="surface-card intelligence-widget">
      <h2>{title}</h2>
      <p>{description}</p>
      {rows.length > 0 ? (
        <div className="intelligence-progress-list">
          {rows.map((row) => (
            <div key={row.label} className="intelligence-progress-row">
              <span>{row.label}</span>
              <strong>{row.unit === "share" ? formatPlainValue(row.value, "share") : row.value}</strong>
              <div>
                <i style={{ width: `${Math.max(2, (row.value / maxValue) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--inline">
          <h3>No widget data yet</h3>
          <p>This widget appears when the survey exposes the required mapped fields.</p>
        </div>
      )}
    </article>
  );
}

export default async function SurveyAnalyticsPage({
  params,
  searchParams,
}: SurveyAnalyticsPageProps) {
  const { surveyId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const survey = await getSurveyById(surveyId);

  if (!survey) {
    notFound();
  }

  const { schema, runPreview } = await getSurveyAnalyticsPageData(surveyId);

  const fieldsBySource = groupFieldsBySource(schema.fields);
  const profileValueFields = fieldsBySource.profile.filter(
    (field) => field.value_type === "number" && /^profile\.[^.]+\.value$/i.test(field.key),
  );
  const mainProfileFields = getPrimaryProfileFields(profileValueFields);
  const capabilityFacetFields = getCapabilityFacetFields(fieldsBySource.profile);
  const tagFields = fieldsBySource.profile.filter((field) => field.value_type === "tag");
  const tagProfileField = tagFields[0] ?? null;
  const assetField =
    fieldsBySource.profile.find((field) => field.value_type === "string[]") ?? null;
  const languageField =
    schema.fields.find((field) => field.key === "context.survey_language") ?? null;
  const countryField =
    schema.fields.find((field) => field.key === "context.country_code") ?? null;
  const audienceField =
    schema.fields.find((field) => field.key === "response.audience_label") ?? null;
  const primarySegmentField = countryField ?? languageField ?? audienceField ?? null;
  const segmentMetrics = buildSegmentMetrics(profileValueFields);
  const baselineMetrics = [
    ...buildBaselineMetrics(profileValueFields, tagFields, assetField),
    ...buildCapabilityFacetMetrics(fieldsBySource.profile),
  ];
  const selectedCountry = getSearchParam(resolvedSearchParams, "country") ?? "";
  const selectedAudience = getSearchParam(resolvedSearchParams, "audience") ?? "";
  const selectedLanguage = getSearchParam(resolvedSearchParams, "language") ?? "";
  const selectedTag = getSearchParam(resolvedSearchParams, "tag") ?? "";
  const selectedAsset = getSearchParam(resolvedSearchParams, "asset") ?? "";
  const selectedCapabilityApplicability =
    getSearchParam(resolvedSearchParams, "dfcApplicability") ?? "";
  const compareRequested = getSearchParam(resolvedSearchParams, "compare") === "1";
  const leftComparison: ComparisonSelection = {
    profileBand: getSearchParam(resolvedSearchParams, "compare_a_profile_band") ?? "",
    country: getSearchParam(resolvedSearchParams, "compare_a_country") ?? "",
    language: getSearchParam(resolvedSearchParams, "compare_a_language") ?? "",
    asset: getSearchParam(resolvedSearchParams, "compare_a_asset") ?? "",
  };
  const rightComparison: ComparisonSelection = {
    profileBand: getSearchParam(resolvedSearchParams, "compare_b_profile_band") ?? "",
    country: getSearchParam(resolvedSearchParams, "compare_b_country") ?? "",
    language: getSearchParam(resolvedSearchParams, "compare_b_language") ?? "",
    asset: getSearchParam(resolvedSearchParams, "compare_b_asset") ?? "",
  };
  const leftComparisonProfileConditions = parseProfileBandValue(leftComparison.profileBand, tagFields);
  const rightComparisonProfileConditions = parseProfileBandValue(rightComparison.profileBand, tagFields);
  const activeProfileConditions = getActiveProfileConditions(resolvedSearchParams);
  const profileConditions = getVisibleProfileConditions(resolvedSearchParams, tagFields);
  const selectedFilters = buildSelectedFilters({
    countryField,
    audienceField,
    languageField,
    tagField: tagProfileField,
    tagFields,
    assetField,
    selectedCountry,
    selectedAudience,
    selectedLanguage,
    selectedTag,
    selectedAsset,
    capabilityFacetFields,
    selectedCapabilityApplicability,
    profileConditions: activeProfileConditions,
  });
  const leftComparisonFilters = buildSelectedFilters({
    countryField,
    audienceField,
    languageField,
    tagField: tagProfileField,
    tagFields,
    assetField,
    selectedCountry: leftComparison.country,
    selectedAudience: null,
    selectedLanguage: leftComparison.language,
    selectedTag: null,
    selectedAsset: leftComparison.asset,
    profileConditions: leftComparisonProfileConditions,
  });
  const rightComparisonFilters = buildSelectedFilters({
    countryField,
    audienceField,
    languageField,
    tagField: tagProfileField,
    tagFields,
    assetField,
    selectedCountry: rightComparison.country,
    selectedAudience: null,
    selectedLanguage: rightComparison.language,
    selectedTag: null,
    selectedAsset: rightComparison.asset,
    profileConditions: rightComparisonProfileConditions,
  });
  const comparisonHasDifferentSelections = !areComparisonSelectionsEqual(leftComparison, rightComparison);
  const hasActiveFilters = selectedFilters.length > 0;

  const hasMappedResponses = schema.ready_response_count > 0;

  const baselineProfile = hasMappedResponses
    ? runPreview({
        metrics: baselineMetrics,
      })
    : null;
  const selectedProfile = hasMappedResponses
    ? runPreview({
        filters: selectedFilters,
        metrics: baselineMetrics,
      })
    : null;
  const leftComparisonProfile =
    hasMappedResponses && compareRequested && comparisonHasDifferentSelections
      ? runPreview({
          filters: leftComparisonFilters,
          metrics: baselineMetrics,
        })
      : null;
  const rightComparisonProfile =
    hasMappedResponses && compareRequested && comparisonHasDifferentSelections
      ? runPreview({
          filters: rightComparisonFilters,
          metrics: baselineMetrics,
        })
      : null;
  const languageBreakdown =
    hasMappedResponses && languageField
      ? runPreview({
          group_by: [languageField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;
  const countryBreakdown =
    hasMappedResponses && countryField
      ? runPreview({
          group_by: [countryField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;
  const audienceBreakdown =
    hasMappedResponses && audienceField
      ? runPreview({
          group_by: [audienceField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;
  const profileByCountry =
    hasMappedResponses && countryField && profileValueFields.length > 0
      ? runPreview({
          group_by: [countryField.key],
          metrics: segmentMetrics,
        })
      : null;
  const profileBySegment =
    hasMappedResponses && profileValueFields.length > 0 && primarySegmentField
      ? runPreview({
          group_by: [primarySegmentField.key],
          metrics: segmentMetrics,
        })
      : null;
  const profileByCountryWithBands =
    hasMappedResponses && countryField && tagFields.length > 0
      ? runPreview({
          group_by: [countryField.key],
          metrics: baselineMetrics,
        })
      : null;
  const tagDistribution =
    hasMappedResponses && tagProfileField
      ? runPreview({
          group_by: [tagProfileField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;
  const selectedCountryBreakdown =
    hasMappedResponses && countryField
      ? runPreview({
          filters: selectedFilters,
          group_by: [countryField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;
  const leftComparisonCountryBreakdown =
    hasMappedResponses && compareRequested && comparisonHasDifferentSelections && countryField
      ? runPreview({
          filters: leftComparisonFilters,
          group_by: [countryField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;
  const rightComparisonCountryBreakdown =
    hasMappedResponses && compareRequested && comparisonHasDifferentSelections && countryField
      ? runPreview({
          filters: rightComparisonFilters,
          group_by: [countryField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;

  const baselineRow = getSingleGroup(baselineProfile);
  const selectedRow = getSingleGroup(selectedProfile);
  const leftComparisonRow = getSingleGroup(leftComparisonProfile);
  const rightComparisonRow = getSingleGroup(rightComparisonProfile);
  const segmentRows = profileBySegment?.result.groups ?? [];
  const countryBandRows = profileByCountryWithBands?.result.groups ?? [];
  const jointBandShares: JointBandShare[] =
    hasMappedResponses && baselineRow
      ? buildJointBandShareCandidates(tagFields, mainProfileFields).flatMap((candidate) => {
          const filtered = runPreview({
            filters: [
              { field: candidate.fieldA.key, op: "eq", value: candidate.tagA },
              { field: candidate.fieldB.key, op: "eq", value: candidate.tagB },
            ],
            metrics: [{ key: "responses", kind: "count" }],
          });
          const row = getSingleGroup(filtered);
          const matchedCount = getMetricValue(row, "responses") ?? 0;
          const sampleSize = baselineRow.response_count;

          if (sampleSize === 0) {
            return [];
          }

          return [
            {
              fieldA: candidate.fieldA,
              tagA: candidate.tagA,
              fieldB: candidate.fieldB,
              tagB: candidate.tagB,
              share: matchedCount / sampleSize,
              matchedCount,
              sampleSize,
            },
          ];
        })
      : [];
  const sidebarProfileBandOptions = buildProfileBandOptions(tagFields, ["low", "high"]);
  const comparisonProfileBandOptions = buildProfileBandOptions(tagFields);
  const selectedProfileBand =
    activeProfileConditions.length === 1
      ? encodeProfileBandValue(activeProfileConditions[0].fieldKey, activeProfileConditions[0].tag)
      : "";
  const countryOptions = countryField
    ? optionsFromRows(countryBreakdown?.result.groups ?? [], countryField.key)
    : [];
  const audienceOptions = audienceField
    ? optionsFromRows(audienceBreakdown?.result.groups ?? [], audienceField.key)
    : [];
  const languageOptions = languageField
    ? optionsFromRows(languageBreakdown?.result.groups ?? [], languageField.key)
    : [];
  const assetOptions = assetField
    ? FLEXPULSE_DER_ASSET_VALUES.map((asset) => ({
        value: asset,
        label: asset.replaceAll("_", " "),
      }))
    : [];
  const capabilityApplicabilityOptions = capabilityFacetFields.flatMap((field) => {
    const label = humanizeFilterLabel(field.facet ?? field.label);
    return [
      {
        value: `${field.key}:not_null`,
        label: `${label} applicable`,
      },
      {
        value: `${field.key}:is_null`,
        label: `${label} not applicable`,
      },
    ];
  });
  const respondentsNow = hasActiveFilters
    ? (selectedRow?.response_count ?? 0)
    : schema.ready_response_count;
  const surveyEvidence = classifySurveyAnalyticsEvidence(respondentsNow);
  const selectedView = getSearchParam(resolvedSearchParams, "view") ?? "overview";

  const schemaPanel = (
    <>
      <section className="content-grid">
        <article className="surface-card">
          <h2>Profile fields</h2>
          <p>Profile values and tags exposed by the measurement plan.</p>
          <RenderFieldTags
            fields={fieldsBySource.profile}
            emptyLabel="No profile fields exposed yet."
          />
        </article>

        <article className="surface-card">
          <h2>Context and grouping fields</h2>
          <p>Fields available for cuts, grouping and later map views.</p>
          <RenderFieldTags
            fields={[...fieldsBySource.context, ...fieldsBySource.response, ...fieldsBySource.geo]}
            emptyLabel="No context or grouping fields exposed yet."
          />
        </article>
      </section>

      <section className="surface-card">
        <h2>Runtime traceability</h2>
        <div className="stack-list">
          <div className="analytics-row">
            <strong>Analytics schema</strong>
            <span>{schema.schema_namespace}</span>
          </div>
          <div className="analytics-row">
            <strong>Measurement hash</strong>
            <span>{schema.measurement_hash ?? "Not available"}</span>
          </div>
          {schema.excluded_unmapped_count > 0 ? (
            <div className="analytics-row">
              <strong>Ready without mapping</strong>
              <span>
                {schema.excluded_unmapped_count} response
                {schema.excluded_unmapped_count === 1 ? "" : "s"} excluded from analytics
              </span>
            </div>
          ) : null}
          <div className="analytics-row">
            <strong>Publication state</strong>
            <span>
              {survey.publishedAt
                ? `Published on ${new Date(survey.publishedAt).toLocaleDateString("en-GB")}`
                : "Still in pre-publication state"}
            </span>
          </div>
        </div>
      </section>
    </>
  );

  const tabs: AnalyticsTab[] = [
    {
      id: "overview",
      label: "Overview",
      panel: (
        <section className="analytics-intelligence-tab">
          <SurveyInsightPanel
            profileFields={mainProfileFields}
            tagFields={tagFields}
            baselineRow={baselineRow}
            jointBandShares={jointBandShares}
            countryRows={profileByCountry?.result.groups ?? []}
            countryBandRows={countryBandRows}
            countryField={primarySegmentField?.key === "context.country_code" ? primarySegmentField : countryField}
          />
          <IntelligenceAxisCards
            fields={mainProfileFields}
            baselineRow={baselineRow}
            segmentRows={segmentRows}
            segmentField={primarySegmentField}
          />
          <RadarViewCard
            fields={mainProfileFields}
            baselineRow={baselineRow}
            segmentRows={segmentRows}
            segmentField={primarySegmentField}
          />
        </section>
      ),
    },
    {
      id: "segments",
      label: "Segments",
      panel: (
        <div className="analytics-intelligence-tab">
          <SegmentOpportunityFinder
            searchParams={resolvedSearchParams}
            tagFields={tagFields}
            conditions={profileConditions}
            activeConditions={activeProfileConditions}
            selectedRow={selectedRow}
            countryRows={selectedCountryBreakdown?.result.groups ?? []}
            countryField={countryField}
          />
          <section className="content-grid analytics-section-grid">
            <ProfileOverviewCard
              selectedRow={selectedRow}
              baselineRow={baselineRow}
              profileValueFields={profileValueFields}
              tagFields={tagFields}
              hasActiveFilters={hasActiveFilters}
            />
            <DifferentiatorsCard
              baselineRow={baselineRow}
              segmentRows={segmentRows}
              segmentField={primarySegmentField}
              profileValueFields={profileValueFields}
            />
          </section>
          <CapabilityFacetsCard
            selectedRow={selectedRow}
            baselineRow={baselineRow}
            fields={capabilityFacetFields}
          />
          <ConceptComparisonTable
            baselineRow={baselineRow}
            segmentRows={segmentRows}
            segmentField={primarySegmentField}
            profileValueFields={profileValueFields}
          />
        </div>
      ),
    },
    {
      id: "comparison",
      label: "Comparison",
      panel: (
        <ComparisonWorkbench
          profileBandOptions={comparisonProfileBandOptions}
          countryOptions={countryOptions}
          languageOptions={languageOptions}
          assetOptions={assetOptions}
          leftSelection={leftComparison}
          rightSelection={rightComparison}
          compared={compareRequested}
          comparable={comparisonHasDifferentSelections}
          leftRow={leftComparisonRow}
          rightRow={rightComparisonRow}
          leftCountryRows={leftComparisonCountryBreakdown?.result.groups ?? []}
          rightCountryRows={rightComparisonCountryBreakdown?.result.groups ?? []}
          countryField={countryField}
          profileFields={mainProfileFields}
        />
      ),
    },
    {
      id: "distributions",
      label: "Distributions",
      panel: (
        <div className="analytics-intelligence-tab">
          <section className="content-grid">
            <BreakdownCard
              title="Respondents by country"
              description="Geographic concentration of mapped respondents — the first cut before the map layer."
              rows={countryBreakdown?.result.groups ?? []}
              groupField={countryField?.key ?? "context.country_code"}
              metricKeys={["responses"]}
            />
            <BreakdownCard
              title="Respondents by response cohort"
              description="Response cohorts from survey-link metadata or seeded synthetic cohorts."
              rows={audienceBreakdown?.result.groups ?? []}
              groupField={audienceField?.key ?? "response.audience_label"}
              metricKeys={["responses"]}
            />
            <BreakdownCard
              title="Respondents by language"
              description="Whether language or localization splits influence the observed profile mix."
              rows={languageBreakdown?.result.groups ?? []}
              groupField={languageField?.key ?? "context.survey_language"}
              metricKeys={["responses"]}
            />
          </section>
          <section className="content-grid">
            <TagDistributionCard
              tagField={tagProfileField}
              rows={tagDistribution?.result.groups ?? []}
            />
            <AssetDistributionCard baselineRow={baselineRow} assetField={assetField} />
          </section>
        </div>
      ),
    },
    {
      id: "schema",
      label: "Schema",
      panel: <div className="analytics-intelligence-tab">{schemaPanel}</div>,
    },
  ];

  return (
    <div className="analytics-shell">
      {/* Left rail — survey context + cohort filters */}
      <aside className="analytics-rail">
        <FilterRailForm
          searchParams={resolvedSearchParams}
          profileBandOptions={sidebarProfileBandOptions}
          tagFields={tagFields}
          countryOptions={countryOptions}
          audienceOptions={audienceOptions}
          languageOptions={languageOptions}
          assetOptions={assetOptions}
          capabilityApplicabilityOptions={capabilityApplicabilityOptions}
          selectedCountry={selectedCountry}
          selectedAudience={selectedAudience}
          selectedLanguage={selectedLanguage}
          selectedTag={selectedTag}
          selectedAsset={selectedAsset}
          selectedCapabilityApplicability={selectedCapabilityApplicability}
          selectedProfileBand={selectedProfileBand}
        />
      </aside>

      {/* Main content */}
      <div className="analytics-content">
        <header className="analytics-content__header">
          <nav className="breadcrumb breadcrumb--analytics" aria-label="Breadcrumb">
            <span className="breadcrumb__item">
              <PendingNavLink href={appRoutes.dashboard}>Surveys</PendingNavLink>
            </span>
            <span className="breadcrumb__item">
              <PendingNavLink href={appRoutes.surveyDetail(survey.id)}>{survey.title}</PendingNavLink>
            </span>
            <span className="breadcrumb__item">
              <span>Analytics</span>
            </span>
          </nav>
          <div className="analytics-kpi-strip">
            <div className="analytics-kpi">
              <span>Respondents</span>
              <strong>{respondentsNow}</strong>
            </div>
            <div className="analytics-kpi">
              <span>Countries</span>
              <strong>{countryOptions.length || "—"}</strong>
            </div>
            <div className="analytics-kpi">
              <span>Profile axes</span>
              <strong>{mainProfileFields.length}</strong>
            </div>
            <div className="analytics-kpi">
              <span>Published</span>
              <strong>{formatDateShort(survey.publishedAt)}</strong>
            </div>
            <div className="analytics-kpi analytics-kpi--evidence">
              <span>Evidence</span>
              <EvidenceBadge evidence={surveyEvidence} />
            </div>
          </div>
        </header>

        {schema.ready_response_count === 0 ? (
          <div className="analytics-sections-body">
            <section className="surface-card">
              <div className="empty-state">
                <h3>No mapped responses yet</h3>
                <p>
                  The analytics engine is available, but cohort profiles need mapped responses in
                  ready state. Use the sandbox seeder or collect responses to populate this explorer.
                </p>
                {schema.excluded_unmapped_count > 0 ? (
                  <p>
                    {schema.excluded_unmapped_count} response
                    {schema.excluded_unmapped_count === 1 ? "" : "s"} in ready state are excluded
                    because they could not be mapped yet.
                  </p>
                ) : null}
              </div>
            </section>
            {schemaPanel}
          </div>
        ) : (
          <AnalyticsTabs tabs={tabs} defaultTab={selectedView} />
        )}
      </div>
    </div>
  );
}
