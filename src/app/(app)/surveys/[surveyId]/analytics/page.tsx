import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MetricGrid } from "@/components/surveys/metric-grid";
import type {
  SurveyAnalyticsFieldDefinition,
  SurveyAnalyticsMetricResult,
  SurveyAnalyticsQueryRow,
} from "@/features/surveys/survey-analytics";
import {
  getSurveyAnalyticsPageData,
  getSurveyById,
} from "@/features/surveys/use-cases";
import { appRoutes } from "@/lib/config/routes";

type SurveyAnalyticsPageProps = {
  params: Promise<{ surveyId: string }>;
};

function formatMetricValue(metric: SurveyAnalyticsMetricResult) {
  if (metric.value == null) {
    return "No data";
  }

  if (metric.kind === "share_contains" || metric.kind === "share_equals") {
    return `${(metric.value * 100).toFixed(1)}%`;
  }

  if (Number.isInteger(metric.value)) {
    return String(metric.value);
  }

  return metric.value.toFixed(2);
}

function getGroupLabel(row: SurveyAnalyticsQueryRow, fieldKey: string) {
  const value = row.group[fieldKey];
  if (value == null || value === "") {
    return "Unknown";
  }
  return String(value);
}

function groupFieldsBySource(fields: SurveyAnalyticsFieldDefinition[]) {
  return {
    profile: fields.filter((field) => field.source === "profile"),
    context: fields.filter((field) => field.source === "context"),
    geo: fields.filter((field) => field.source === "geo"),
    response: fields.filter((field) => field.source === "response"),
  };
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

function PreviewBreakdownCard({
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
          {rows.map((row) => (
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

export default async function SurveyAnalyticsPage({
  params,
}: SurveyAnalyticsPageProps) {
  const { surveyId } = await params;
  const survey = await getSurveyById(surveyId);

  if (!survey) {
    notFound();
  }

  const { schema, runPreview } = await getSurveyAnalyticsPageData(surveyId);

  const fieldsBySource = groupFieldsBySource(schema.fields);
  const numericProfileField =
    fieldsBySource.profile.find((field) => field.value_type === "number") ?? null;
  const tagProfileField =
    fieldsBySource.profile.find((field) => field.value_type === "tag") ?? null;
  const languageField =
    schema.fields.find((field) => field.key === "context.survey_language") ?? null;
  const countryField =
    schema.fields.find((field) => field.key === "context.country_code") ?? null;
  const audienceField =
    schema.fields.find((field) => field.key === "response.audience_label") ?? null;
  const primarySegmentField = countryField ?? languageField ?? audienceField ?? null;

  const hasMappedResponses = schema.ready_response_count > 0;
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
  const primaryProfileBySegment =
    hasMappedResponses && numericProfileField && primarySegmentField
      ? runPreview({
          group_by: [primarySegmentField.key],
          metrics: [
            { key: "responses", kind: "count" },
            {
              key: "average",
              kind: "average",
              field: numericProfileField.key,
            },
          ],
        })
      : null;
  const tagDistribution =
    hasMappedResponses && tagProfileField
      ? runPreview({
          group_by: [tagProfileField.key],
          metrics: [{ key: "responses", kind: "count" }],
        })
      : null;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Survey analytics"
        title={`${survey.title} analytics`}
        description="Rudimentary v0.5 analytics view to inspect readiness, available fields, and first aggregated cuts."
        actions={
          <div className="button-row">
            <Link href={appRoutes.surveyDetail(survey.id)} className="button button--secondary">
              Open survey detail
            </Link>
            {survey.defaultPublicLinkUrl ? (
              <Link href={survey.defaultPublicLinkUrl} className="button button--primary">
                Open public link
              </Link>
            ) : null}
          </div>
        }
      />

      <MetricGrid
        metrics={[
          {
            label: "Mapped responses",
            value: String(schema.ready_response_count),
            hint: "Responses ready for analytics",
          },
          {
            label: "Fields exposed",
            value: String(schema.fields.length),
            hint: "Available fields in analytics schema",
          },
          {
            label: "Profile fields",
            value: String(fieldsBySource.profile.length),
            hint: "Profile-derived fields available",
          },
          {
            label: "Geo levels",
            value: String(fieldsBySource.geo.length > 0 ? schema.supported_geo_levels.length : 0),
            hint: "Supported hierarchy levels for future drill-down",
          },
        ]}
      />

      <section className="content-grid">
        <article className="surface-card">
          <h2>Current readiness</h2>
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
            <div className="analytics-row">
              <strong>Last update</strong>
              <span>{new Date(survey.updatedAt).toLocaleDateString("en-GB")}</span>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <h2>What this page is for</h2>
          <div className="stack-list">
            <div className="analytics-row">
              <strong>Status</strong>
              <span>Useful now for backend verification and future evals</span>
            </div>
            <div className="analytics-row">
              <strong>Front maturity</strong>
              <span>v0.5, intentionally simple and inspection-oriented</span>
            </div>
            <div className="analytics-row">
              <strong>Main use</strong>
              <span>Check schema, mapped response counts, and first query previews</span>
            </div>
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="surface-card">
          <h2>Profile fields</h2>
          <p>These are the profile fields currently exposed by the analytics layer for this survey.</p>
          <RenderFieldTags
            fields={fieldsBySource.profile}
            emptyLabel="No profile fields exposed yet."
          />
        </article>

        <article className="surface-card">
          <h2>Context and grouping fields</h2>
          <p>These are the main fields available for cuts, grouping, and basic segmentation.</p>
          <RenderFieldTags
            fields={[...fieldsBySource.context, ...fieldsBySource.response, ...fieldsBySource.geo]}
            emptyLabel="No context or grouping fields exposed yet."
          />
        </article>
      </section>

      {schema.ready_response_count === 0 ? (
        <section className="surface-card">
          <div className="empty-state">
            <h3>No mapped responses yet</h3>
            <p>
              The analytics engine is already available, but preview cuts will only appear once
              the survey has mapped responses in `ready` state. Until then, this screen is still
              useful to inspect the schema and confirm that the query layer is wired correctly.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="content-grid">
            <PreviewBreakdownCard
              title="Responses by language"
              description="First simple cut to verify that the aggregation layer is reading mapped responses correctly."
              rows={languageBreakdown?.result.groups ?? []}
              groupField={languageField?.key ?? "context.survey_language"}
              metricKeys={["responses"]}
            />

            <PreviewBreakdownCard
              title="Responses by country"
              description="Basic territorial cut. This becomes especially useful once the survey starts collecting cross-country data."
              rows={countryBreakdown?.result.groups ?? []}
              groupField={countryField?.key ?? "context.country_code"}
              metricKeys={["responses"]}
            />
          </section>

          <section className="content-grid">
            <PreviewBreakdownCard
              title="Responses by audience"
              description="Useful when the same survey runs with multiple public links or audience tokens."
              rows={audienceBreakdown?.result.groups ?? []}
              groupField={audienceField?.key ?? "response.audience_label"}
              metricKeys={["responses"]}
            />

            <PreviewBreakdownCard
              title={
                numericProfileField && primarySegmentField
                  ? `${numericProfileField.label} by ${primarySegmentField.label.toLowerCase()}`
                  : "Primary concept preview"
              }
              description={
                numericProfileField && primarySegmentField
                  ? "First numerical concept preview to test the query and aggregation layer with a meaningful average."
                  : "No numerical profile concept is available yet for preview."
              }
              rows={primaryProfileBySegment?.result.groups ?? []}
              groupField={primarySegmentField?.key ?? "context.country_code"}
              metricKeys={["responses", "average"]}
            />
          </section>

          <section className="surface-card">
            <h2>Tag distribution preview</h2>
            <p>
              This preview is useful when a concept exposes derived tags such as low, medium, or
              high. It helps validate whether the mapped outputs and grouping logic behave as
              expected.
            </p>
            {tagProfileField ? (
              <div className="stack-list">
                {tagDistribution?.result.groups.length ? (
                  tagDistribution.result.groups.map((row) => (
                    <div
                      key={`${tagProfileField.key}-${getGroupLabel(row, tagProfileField.key)}`}
                      className="analytics-row"
                    >
                      <strong>{getGroupLabel(row, tagProfileField.key)}</strong>
                      <span>
                        {formatMetricValue(row.metrics.responses)} · sample{" "}
                        {row.metrics.responses.sample_size}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state empty-state--inline">
                    <h3>No tag distribution yet</h3>
                    <p>This will populate once mapped profile tags are available.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state empty-state--inline">
                <h3>No tag-based concept exposed</h3>
                <p>
                  This survey currently does not expose a profile tag field suitable for a
                  distribution preview.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
