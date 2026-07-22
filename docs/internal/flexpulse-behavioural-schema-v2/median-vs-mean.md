# Median vs Mean

## Decision

FlexPulse now uses mean aggregation for newly generated multi-item Likert
constructs across the behavioural schema, including Declared Flexibility
Capability (DFC) and the pre-existing behavioural axes.

## Why

Mean aggregation better matches how the current profile axes are interpreted:

- every item contributes to the final construct value;
- partial disagreement inside a construct should remain visible in the score;
- facets and construct-level comparisons are easier to interpret on the same
  1–5 scale;
- DFC already requires mean by design, so aligning the rest of the schema
  reduces methodological inconsistency across axes.

Median can be attractive when you want robustness against single outliers, but
for the current FlexPulse survey families it can also hide meaningful variation
between items inside the same construct.

## Scope

This change applies to:

- newly generated surveys created by the current planner/writer pipeline;
- derived measurement plans rebuilt from new mappings when no unchanged legacy
  plan is being preserved.

This change does not rewrite:

- published surveys;
- frozen Stage 2 fixtures and eval baselines;
- stored legacy measurement plans that already use
  `multi_item_likert_median`.

## Compatibility

The runtime still supports both:

- `multi_item_likert_mean`
- `multi_item_likert_median`

That means historical surveys continue to map and analyze correctly, while new
surveys default to mean for multi-item behavioural constructs.
