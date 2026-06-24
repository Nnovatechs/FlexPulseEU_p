import Link from "next/link";
import { notFound } from "next/navigation";
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
  TAG_VALUES,
  type ProfileCondition,
} from "@/features/surveys/analytics/profile-explorer-utils";
import { appRoutes } from "@/lib/config/routes";
import { AnalyticsTabs, type AnalyticsTab } from "./analytics-tabs";
import {
  buildSurveyInsights,
  MIN_INSIGHT_SAMPLE,
  MIN_MEANINGFUL_DELTA,
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

const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
  automation_ready:
    "High trust in automation, high willingness to flex demand, and low comfort rigidity. Usually the easiest cohort for automated flexibility offers.",
  control_protective:
    "Low trust, low flexibility willingness, and high need for direct control. This cohort needs opt-outs, manual control, and strong reassurance.",
  price_optimizer:
    "Savings-led respondents with high flexibility and moderate trust. Price signals and clear bill impact are the strongest hooks.",
  comfort_first:
    "Comfort-protective households with low tolerance for temperature or routine disruption. Automation needs strict comfort guarantees.",
  neutral:
    "Neutral position with mid-scale answers and no strong behavioural pull. Useful for deciding whether sharper country or archetype splits matter more than broad messaging.",
  neutral_mainstream:
    "Neutral position with mid-scale answers and no strong behavioural pull. Useful for deciding whether sharper country or archetype splits matter more than broad messaging.",
  der_engaged:
    "Asset-rich DER users with practical familiarity and high flexibility. Often more ready for advanced flexibility propositions.",
  contradictory:
    "Respondents who trust technical reliability but still feel discomfort with autonomous control. Good for spotting messaging or control-design tension.",
  partial_sparse:
    "Sparse or incomplete responses used to test evidence thresholds and null handling. Treat as directional, not a strong product signal.",
};

function getArchetypeDescription(value: string) {
  return ARCHETYPE_DESCRIPTIONS[value] ?? null;
}

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
  countryOptions,
  audienceOptions,
  languageOptions,
  assetOptions,
  selectedCountry,
  selectedAudience,
  selectedLanguage,
  selectedTag,
  selectedAsset,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  countryOptions: FilterOption[];
  audienceOptions: FilterOption[];
  languageOptions: FilterOption[];
  assetOptions: FilterOption[];
  selectedCountry: string;
  selectedAudience: string;
  selectedLanguage: string;
  selectedTag: string;
  selectedAsset: string;
}) {
  return (
    <div className="analytics-filter-rail">
      <p className="analytics-filter-rail__heading">Cohort filter</p>
      <div className="analytics-filter-form">
        <FilterOptionGroup
          name="audience"
          label="Behavioural archetypes"
          allLabel="All archetypes"
          value={selectedAudience}
          searchParams={searchParams}
          options={audienceOptions}
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
      </div>
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
  const visibleFields = profileValueFields.slice(0, 5);

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
    ? FLEXPULSE_DER_ASSET_VALUES.slice(0, 8)
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
  baselineRow,
  countryRows,
  countryField,
  audienceRows,
  audienceField,
}: {
  profileFields: SurveyAnalyticsFieldDefinition[];
  baselineRow: SurveyAnalyticsQueryRow | null;
  countryRows: SurveyAnalyticsQueryRow[];
  countryField: SurveyAnalyticsFieldDefinition | null;
  audienceRows: SurveyAnalyticsQueryRow[];
  audienceField: SurveyAnalyticsFieldDefinition | null;
}) {
  const insights = buildSurveyInsights({
    baselineRow,
    profileFields,
    countryRows,
    countryField,
    audienceRows,
    audienceField,
  });

  return (
    <section className="intelligence-hero intelligence-hero--insights">
      <p className="intelligence-hero__eyebrow">Overview insights</p>
      <h2>Product signals worth acting on</h2>
      <span>
        Generated from mapped responses using transparent thresholds: minimum n={MIN_INSIGHT_SAMPLE}
        {" "}per compared group and minimum delta {MIN_MEANINGFUL_DELTA.toFixed(2)} on the 1-5 profile scale.
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
  const baselineMetrics = buildBaselineMetrics(profileValueFields, tagFields, assetField);
  const selectedCountry = getSearchParam(resolvedSearchParams, "country") ?? "";
  const selectedAudience = getSearchParam(resolvedSearchParams, "audience") ?? "";
  const selectedLanguage = getSearchParam(resolvedSearchParams, "language") ?? "";
  const selectedTag = getSearchParam(resolvedSearchParams, "tag") ?? "";
  const selectedAsset = getSearchParam(resolvedSearchParams, "asset") ?? "";
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
    profileConditions: activeProfileConditions,
  });
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
  const profileByAudience =
    hasMappedResponses && audienceField && profileValueFields.length > 0
      ? runPreview({
          group_by: [audienceField.key],
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

  const baselineRow = getSingleGroup(baselineProfile);
  const selectedRow = getSingleGroup(selectedProfile);
  const segmentRows = profileBySegment?.result.groups ?? [];
  const countryOptions = countryField
    ? optionsFromRows(countryBreakdown?.result.groups ?? [], countryField.key)
    : [];
  const audienceOptions = audienceField
    ? optionsFromRows(audienceBreakdown?.result.groups ?? [], audienceField.key).map((option) => ({
        ...option,
        description: getArchetypeDescription(option.value) ?? undefined,
      }))
    : [];
  const languageOptions = languageField
    ? optionsFromRows(languageBreakdown?.result.groups ?? [], languageField.key)
    : [];
  const assetOptions = assetField
    ? FLEXPULSE_DER_ASSET_VALUES.slice(0, 8).map((asset) => ({
        value: asset,
        label: asset.replaceAll("_", " "),
      }))
    : [];
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
            baselineRow={baselineRow}
            countryRows={profileBySegment?.result.groups ?? []}
            countryField={primarySegmentField?.key === "context.country_code" ? primarySegmentField : countryField}
            audienceRows={profileByAudience?.result.groups ?? []}
            audienceField={audienceField}
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
              title="Respondents by behavioural archetype"
              description="Human-readable respondent archetypes derived from the active survey links."
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
          countryOptions={countryOptions}
          audienceOptions={audienceOptions}
          languageOptions={languageOptions}
          assetOptions={assetOptions}
          selectedCountry={selectedCountry}
          selectedAudience={selectedAudience}
          selectedLanguage={selectedLanguage}
          selectedTag={selectedTag}
          selectedAsset={selectedAsset}
        />
      </aside>

      {/* Main content */}
      <div className="analytics-content">
        <header className="analytics-content__header">
          <nav className="breadcrumb breadcrumb--analytics" aria-label="Breadcrumb">
            <span className="breadcrumb__item">
              <Link href={appRoutes.dashboard}>Surveys</Link>
            </span>
            <span className="breadcrumb__item">
              <Link href={appRoutes.surveyDetail(survey.id)}>{survey.title}</Link>
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
