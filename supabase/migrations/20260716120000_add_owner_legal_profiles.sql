create table public.owner_legal_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  controller_name text not null check (char_length(trim(controller_name)) > 0),
  controller_country text not null check (char_length(trim(controller_country)) > 0),
  contact_email text not null check (char_length(trim(contact_email)) > 0),
  privacy_email text not null check (char_length(trim(privacy_email)) > 0),
  dpo_email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (dpo_email is null or char_length(trim(dpo_email)) > 0)
);

create trigger owner_legal_profiles_set_updated_at
before update on public.owner_legal_profiles
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.owner_legal_profiles enable row level security;

create policy "Users can read their own legal profile"
on public.owner_legal_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own legal profile"
on public.owner_legal_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own legal profile"
on public.owner_legal_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table public.survey_legal_snapshots (
  survey_id uuid primary key references public.surveys (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  captured_at timestamptz not null default timezone('utc', now())
);

create index survey_legal_snapshots_owner_idx
on public.survey_legal_snapshots (owner_id);

alter table public.survey_legal_snapshots enable row level security;

create policy "Users can read snapshots for their own surveys"
on public.survey_legal_snapshots
for select
to authenticated
using (
  auth.uid() = owner_id
  and exists (
    select 1
    from public.surveys
    where surveys.id = survey_legal_snapshots.survey_id
      and surveys.created_by = auth.uid()
  )
);

create policy "Users can prepare snapshots for their own drafts"
on public.survey_legal_snapshots
for insert
to authenticated
with check (
  auth.uid() = owner_id
  and exists (
    select 1
    from public.surveys
    where surveys.id = survey_legal_snapshots.survey_id
      and surveys.created_by = auth.uid()
      and surveys.status = 'draft'
  )
);

create policy "Users can refresh snapshots for their own drafts"
on public.survey_legal_snapshots
for update
to authenticated
using (
  auth.uid() = owner_id
  and exists (
    select 1
    from public.surveys
    where surveys.id = survey_legal_snapshots.survey_id
      and surveys.created_by = auth.uid()
      and surveys.status = 'draft'
  )
)
with check (
  auth.uid() = owner_id
  and exists (
    select 1
    from public.surveys
    where surveys.id = survey_legal_snapshots.survey_id
      and surveys.created_by = auth.uid()
      and surveys.status = 'draft'
  )
);

create or replace function public.require_legal_snapshot_before_publish()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' and new.status = 'published' then
    if not exists (
      select 1
      from public.survey_legal_snapshots
      where survey_id = old.id
        and owner_id = old.created_by
    ) then
      raise exception 'A legal snapshot is required before publishing a survey.';
    end if;
  end if;

  return new;
end;
$$;

create trigger surveys_require_legal_snapshot_before_publish
before update on public.surveys
for each row
execute function public.require_legal_snapshot_before_publish();
