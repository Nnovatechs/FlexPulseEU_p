# FlexPulse Behavioural Schema v2 — Declared Flexibility Capability

Status: experimental v1 specification.

## Scientific definition

Declared Flexibility Capability (DFC) measures a respondent's self-reported,
practical capacity to shift household energy use while preserving the service
their household needs. It is not willingness, trust, asset ownership alone,
telemetry-derived technical potential, power, energy, or market-deliverable
flexibility.

FlexPulse v2 retains the `flexpulse_behavioural_schema` namespace and the six
existing behavioural/attitudinal axes. It adds
`declared_flexibility_capability` as a seventh `primary_profile_axis`.

The score uses a 1–5 scale. A `null` score means that no capability set was
applicable; it must never be interpreted as low capability.

For newly generated multi-item behavioural constructs, FlexPulse now uses mean
aggregation rather than median aggregation. This applies to new surveys built
from the current generation pipeline. Published legacy surveys remain frozen and
may still carry `multi_item_likert_median` in their stored measurement plans.

## Deterministic module v1

DFC generation, branching, mapping, and scoring are versioned and
deterministic. The measurement planner cannot choose or alter them. The writer
only realizes locked item intents, descriptions, option labels, and scale
anchors in the canonical survey language. Secondary languages use the existing
translation pipeline while preserving all structural keys.

The survey records `capability_module_version: "v1"` in `survey_meta`.

| Set/facet | Inventory trigger |
| --- | --- |
| `washing_machine_scheduling` | `washing_machine` |
| `ev_charging` | `ev` |
| `space_conditioning` | `heat_pump` or `air_conditioning` |
| `water_heating` | `hot_water_tank` |
| `battery_operation` | `battery_storage` |

Each applicable set has exactly four required, positive-polarity items:

1. `operational_control`;
2. `temporal_slack`;
3. `service_preservation`;
4. `household_coordination`.

Question keys, slot keys, item count, type, order, 1–5 range, visibility rules,
facets, mappings, aggregation, and thresholds are fixed by the module.

## Asset inventory and branching

Selecting DFC automatically selects the existing `owned_der_assets` concept.
Its visible label is “Household energy assets and flexible appliances”. DFC v1
adds `washing_machine` and `air_conditioning` to the existing asset catalogue.
Other existing assets remain valid inventory values but activate no new set
unless listed in the routing table.

The inventory is required and includes mutually exclusive `none_of_these` and
`not_sure` options. Their raw responses are retained, map to an empty applicable
asset set, and produce a `null` DFC score.

Every DFC survey definition contains all twenty potential items. Visibility is
resolved from this optional rule:

```ts
type QuestionVisibilityRule = {
  source_question_key: string;
  operator: "contains_any";
  values: string[];
};
```

The shared visibility implementation is used by the public form, server
validation, and mapper. It guarantees:

- the source inventory precedes dependent items;
- only visible items are required and numbered;
- hidden answers are removed when an asset is deselected;
- exclusive inventory sentinels cannot coexist with assets;
- the server stores only currently visible answers;
- the mapper evaluates only currently applicable questions;
- surveys without visibility rules preserve legacy behavior.

## Scoring

For respondent `i`, applicable set `s`, and its four items `j`:

```text
set_score(i,s) = mean(item(i,s,1), ..., item(i,s,4))
overall(i) = mean(set_score(i,1), ..., set_score(i,n))
```

All four visible items in a set must be complete. No intermediate rounding is
allowed. Each set is emitted as a `facet_subscore` with `evidence_count: 4`.

Tags use:

```text
value <= 2 → low
value >= 4 → high
otherwise  → medium
```

Zero applicable sets produce `value: null`, no tag, and no facets. Although the
mean of means equals a flat mean in v1 because every set has four items, the
implementation computes and retains set means explicitly.

Outside DFC, the current generation pipeline also prefers mean aggregation for
newly generated multi-item Likert constructs across the behavioural schema.
Legacy published surveys and frozen Stage 2 fixtures continue to support median
plans without migration.

## Persistence and compatibility

No SQL migration is required. Survey definitions, measurement plans, mappings,
answers, mapper output, and module version already live in JSONB-backed
artifacts.

Published surveys remain frozen. Surveys without DFC or `visibility_rule`
continue through the existing Stage 2 path unchanged. Existing Stage 2
fixtures and evals remain frozen; DFC uses parallel fixtures and evals.

## Analytics

DFC is exposed as:

- a continuous seventh profile axis;
- low/medium/high filters and segments;
- applicable/not-applicable filters;
- set-level facet scores;
- cross-filters with assets and existing profile/context fields.

`null` values are excluded from numeric means and tag shares. Every DFC
aggregate and facet displays its applicable sample size. Privacy suppression is
based on the metric's applicable sample, not only the total response count.
Scientific comparisons should control for asset portfolio and should prioritize
continuous set scores.

## Validation and evidence

Acceptance coverage includes:

- deterministic module keys and 5 × 4 structure;
- planner exclusion and locked writer realization;
- canonical non-English and secondary-language scale anchors;
- visibility graph validation and inventory exclusivity;
- none/not-sure, one-asset, multi-asset, deselection, and hidden-answer paths;
- visible missing-answer rejection and rating-scale step validation;
- set means, overall mean, thresholds, facets, and `null` behavior;
- analytics schema, filters, sample sizes, and privacy suppression;
- a parallel 270-person DFC cohort with capability independent of willingness
  and trust;
- unchanged Stage 2 mapper, profiling, and synthetic-cohort evals;
- lint, typecheck, unit/integration tests, DFC evals, Stage 2 evals, and build.

## Risks and interpretation

- DFC is declared capability, so common-method and self-report bias remain.
- Overall scores mix different asset portfolios; set scores are the preferred
  scientific signal.
- Cross-country comparisons require applicable sample sizes and portfolio
  controls.
- Component labels organize item content but are not validated subscales.
- Any future change to sets, triggers, item count, or scoring requires a new
  module version rather than mutating v1.

If implementation ever requires a SQL migration or an incompatible change to a
frozen Stage 2 contract, work must pause and this specification must be updated
first.
