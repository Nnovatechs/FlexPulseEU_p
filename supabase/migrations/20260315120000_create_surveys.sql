create type public.survey_status as enum ('draft', 'published', 'archived');

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  status public.survey_status not null default 'draft',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz,
  default_language text not null check (char_length(trim(default_language)) > 0),
  supported_languages text[] not null,
  definition_json jsonb not null,
  mapping_contract_json jsonb not null,
  mapping_compiled_json jsonb,
  mapping_hash text,
  check (cardinality(supported_languages) > 0),
  check (default_language = any (supported_languages)),
  check (
    (
      status = 'draft'
      and published_at is null
      and mapping_hash is null
    )
    or (
      status = 'published'
      and published_at is not null
      and mapping_hash is not null
    )
    or (
      status = 'archived'
      and published_at is not null
      and mapping_hash is not null
    )
  )
);

create index surveys_created_by_idx on public.surveys (created_by);
create index surveys_status_idx on public.surveys (status);
create index surveys_updated_at_idx on public.surveys (updated_at desc);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

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

create trigger surveys_set_updated_at
before update on public.surveys
for each row
execute function public.set_current_timestamp_updated_at();

create trigger surveys_prevent_frozen_updates
before update on public.surveys
for each row
execute function public.prevent_frozen_survey_updates();

alter table public.surveys enable row level security;

create policy "Users can read their own surveys"
on public.surveys
for select
to authenticated
using (auth.uid() = created_by);

create policy "Users can insert their own surveys"
on public.surveys
for insert
to authenticated
with check (auth.uid() = created_by);

create policy "Users can update their own surveys"
on public.surveys
for update
to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);
