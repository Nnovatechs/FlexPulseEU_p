alter table public.response_enrichment
  add column centroid_lat double precision,
  add column centroid_lon double precision,
  add column normalized_location_json jsonb not null default '{}'::jsonb;

create index response_enrichment_location_idx
  on public.response_enrichment (
    normalized_country_code,
    location_granularity,
    location_agg_code
  );

create index response_enrichment_normalized_location_gin_idx
  on public.response_enrichment
  using gin (normalized_location_json jsonb_path_ops);
