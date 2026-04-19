alter table public.surveys
  add column measurement_hash text;

create or replace function public.prevent_frozen_survey_updates()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' then
    if not (
      new.status = 'archived'
      and new.id = old.id
      and new.name = old.name
      and new.created_by = old.created_by
      and new.created_at = old.created_at
      and new.published_at = old.published_at
      and new.default_language = old.default_language
      and new.supported_languages is not distinct from old.supported_languages
      and new.definition_json is not distinct from old.definition_json
      and new.mapping_contract_json is not distinct from old.mapping_contract_json
      and new.mapping_compiled_json is not distinct from old.mapping_compiled_json
      and new.mapping_hash is not distinct from old.mapping_hash
      and new.measurement_hash is not distinct from old.measurement_hash
    ) then
      raise exception 'Published surveys are immutable. Archive them or create a new draft version.';
    end if;
  end if;

  if old.status = 'archived' then
    raise exception 'Archived surveys are immutable.';
  end if;

  return new;
end;
$$;

alter type public.response_pipeline_status add value if not exists 'mapping' before 'ready';
alter type public.processing_job_type add value if not exists 'response_mapping';

alter table public.survey_responses
  add column measurement_hash_at_submission text;

create table public.response_mapping (
  response_id uuid primary key references public.survey_responses (id) on delete cascade,
  mapper_output_json jsonb not null,
  mapping_hash_used text,
  measurement_hash_used text,
  mapper_version text not null check (char_length(trim(mapper_version)) > 0),
  processed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index response_mapping_processed_at_idx
  on public.response_mapping (processed_at desc);

create trigger response_mapping_set_updated_at
before update on public.response_mapping
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.response_mapping enable row level security;

create policy "Users can read mapped responses for their own surveys"
on public.response_mapping
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
