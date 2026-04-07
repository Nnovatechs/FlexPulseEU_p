create type public.response_pipeline_status as enum (
  'received',
  'queued',
  'enriching',
  'enriched',
  'ready',
  'failed'
);

create type public.processing_job_status as enum (
  'pending',
  'running',
  'retry_scheduled',
  'succeeded',
  'failed',
  'dead'
);

create type public.processing_job_type as enum (
  'response_enrichment'
);

create table public.survey_links (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  link_token text not null unique check (char_length(trim(link_token)) > 0),
  audience_label text not null check (char_length(trim(audience_label)) > 0),
  audience_token text not null check (char_length(trim(audience_token)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (survey_id, audience_token)
);

create index survey_links_survey_id_idx
  on public.survey_links (survey_id, created_at desc);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  survey_link_id uuid not null references public.survey_links (id) on delete restrict,
  submitted_language text not null check (char_length(trim(submitted_language)) > 0),
  responded_at timestamptz not null default timezone('utc', now()),
  answers_json jsonb not null,
  pipeline_status public.response_pipeline_status not null default 'received',
  country_code_raw text,
  postal_code_raw text,
  raw_location_retention_until timestamptz,
  mapping_hash_at_submission text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index survey_responses_survey_id_idx
  on public.survey_responses (survey_id, responded_at desc);

create index survey_responses_link_id_idx
  on public.survey_responses (survey_link_id, responded_at desc);

create index survey_responses_pipeline_status_idx
  on public.survey_responses (pipeline_status, created_at asc);

create table public.response_enrichment (
  response_id uuid primary key references public.survey_responses (id) on delete cascade,
  provider text not null check (char_length(trim(provider)) > 0),
  normalized_country_code text,
  location_agg_code text,
  location_agg_label text,
  location_granularity text,
  temp_outdoor_c numeric,
  humidity_pct numeric,
  observed_at timestamptz,
  quality_flag text,
  payload_json jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses (id) on delete cascade,
  job_type public.processing_job_type not null,
  status public.processing_job_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  last_error text,
  scheduled_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index processing_jobs_status_idx
  on public.processing_jobs (status, scheduled_at asc);

create index processing_jobs_response_id_idx
  on public.processing_jobs (response_id, created_at desc);

create unique index processing_jobs_active_unique_idx
  on public.processing_jobs (response_id, job_type)
  where status in ('pending', 'running', 'retry_scheduled');

create or replace function public.generate_unique_survey_link_token()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := encode(gen_random_bytes(16), 'hex');
    exit when not exists (
      select 1
      from public.survey_links
      where link_token = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.create_default_survey_link_on_publish()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' and new.status = 'published' then
    if not exists (
      select 1
      from public.survey_links
      where survey_id = new.id
    ) then
      insert into public.survey_links (
        survey_id,
        link_token,
        audience_label,
        audience_token,
        is_active
      )
      values (
        new.id,
        public.generate_unique_survey_link_token(),
        'Default audience',
        'default',
        true
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger survey_responses_set_updated_at
before update on public.survey_responses
for each row
execute function public.set_current_timestamp_updated_at();

create trigger response_enrichment_set_updated_at
before update on public.response_enrichment
for each row
execute function public.set_current_timestamp_updated_at();

create trigger processing_jobs_set_updated_at
before update on public.processing_jobs
for each row
execute function public.set_current_timestamp_updated_at();

create trigger surveys_create_default_link_on_publish
after update on public.surveys
for each row
execute function public.create_default_survey_link_on_publish();

alter table public.survey_links enable row level security;
alter table public.survey_responses enable row level security;
alter table public.response_enrichment enable row level security;
alter table public.processing_jobs enable row level security;

create policy "Users can read links for their own surveys"
on public.survey_links
for select
to authenticated
using (
  exists (
    select 1
    from public.surveys s
    where s.id = survey_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can insert links for their own surveys"
on public.survey_links
for insert
to authenticated
with check (
  exists (
    select 1
    from public.surveys s
    where s.id = survey_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can update links for their own surveys"
on public.survey_links
for update
to authenticated
using (
  exists (
    select 1
    from public.surveys s
    where s.id = survey_id
      and s.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.surveys s
    where s.id = survey_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can read responses for their own surveys"
on public.survey_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.surveys s
    where s.id = survey_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can read enrichment for their own surveys"
on public.response_enrichment
for select
to authenticated
using (
  exists (
    select 1
    from public.survey_responses r
    join public.surveys s on s.id = r.survey_id
    where r.id = response_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can read jobs for their own surveys"
on public.processing_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.survey_responses r
    join public.surveys s on s.id = r.survey_id
    where r.id = response_id
      and s.created_by = auth.uid()
  )
);
