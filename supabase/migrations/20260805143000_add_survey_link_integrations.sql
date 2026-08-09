create table public.survey_link_integrations (
  id uuid primary key default gen_random_uuid(),
  survey_link_id uuid not null references public.survey_links (id) on delete cascade,
  provider text not null,
  external_study_id text not null,
  completion_url text not null,
  provider_config_json jsonb not null default '{}'::jsonb,
  privacy_notice_version text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint survey_link_integrations_provider_check
    check (provider = 'prolific'),
  constraint survey_link_integrations_unique_provider
    unique (survey_link_id, provider)
);

create index survey_link_integrations_link_id_idx
  on public.survey_link_integrations (survey_link_id, created_at desc);

create table public.response_external_refs (
  response_id uuid primary key references public.survey_responses (id) on delete cascade,
  integration_id uuid not null references public.survey_link_integrations (id) on delete cascade,
  participant_token text not null,
  submission_token text not null,
  token_version text not null,
  notice_version text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index response_external_refs_unique_submission_idx
  on public.response_external_refs (integration_id, submission_token);

create index response_external_refs_participant_idx
  on public.response_external_refs (integration_id, participant_token);

create trigger survey_link_integrations_set_updated_at
before update on public.survey_link_integrations
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.survey_link_integrations enable row level security;
alter table public.response_external_refs enable row level security;

create policy "Users can read integrations for their own survey links"
on public.survey_link_integrations
for select
to authenticated
using (
  exists (
    select 1
    from public.survey_links sl
    join public.surveys s on s.id = sl.survey_id
    where sl.id = survey_link_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can insert integrations for their own survey links"
on public.survey_link_integrations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.survey_links sl
    join public.surveys s on s.id = sl.survey_id
    where sl.id = survey_link_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can update integrations for their own survey links"
on public.survey_link_integrations
for update
to authenticated
using (
  exists (
    select 1
    from public.survey_links sl
    join public.surveys s on s.id = sl.survey_id
    where sl.id = survey_link_id
      and s.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.survey_links sl
    join public.surveys s on s.id = sl.survey_id
    where sl.id = survey_link_id
      and s.created_by = auth.uid()
  )
);

create policy "Users can read external refs for their own surveys"
on public.response_external_refs
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

drop function if exists public.create_survey_response_with_job(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  timestamptz,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text
);

create or replace function public.create_survey_response_with_job(
  p_survey_id uuid,
  p_survey_link_id uuid,
  p_submitted_language text,
  p_answers_json jsonb,
  p_country_code_raw text,
  p_postal_code_raw text,
  p_raw_location_retention_until timestamptz,
  p_mapping_hash_at_submission text,
  p_measurement_hash_at_submission text,
  p_legal_consent_accepted boolean,
  p_legal_consent_statement text,
  p_legal_consent_version text,
  p_legal_privacy_notice_version text,
  p_legal_cookie_notice_version text,
  p_legal_consent_source text,
  p_external_integration_id uuid,
  p_external_participant_token text,
  p_external_submission_token text,
  p_external_token_version text,
  p_external_notice_version text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_response_id uuid;
  v_existing_response_id uuid;
  v_has_external_ref boolean;
begin
  if p_legal_consent_accepted is distinct from true then
    raise exception 'Legal consent is required';
  end if;

  if nullif(trim(p_legal_consent_statement), '') is null then
    raise exception 'Legal consent statement is required';
  end if;

  if nullif(trim(p_legal_consent_version), '') is null then
    raise exception 'Legal consent version is required';
  end if;

  if nullif(trim(p_legal_privacy_notice_version), '') is null then
    raise exception 'Legal privacy notice version is required';
  end if;

  if nullif(trim(p_legal_cookie_notice_version), '') is null then
    raise exception 'Legal cookie notice version is required';
  end if;

  if nullif(trim(p_legal_consent_source), '') is null then
    raise exception 'Legal consent source is required';
  end if;

  v_has_external_ref :=
    p_external_integration_id is not null or
    nullif(trim(coalesce(p_external_participant_token, '')), '') is not null or
    nullif(trim(coalesce(p_external_submission_token, '')), '') is not null or
    nullif(trim(coalesce(p_external_token_version, '')), '') is not null or
    nullif(trim(coalesce(p_external_notice_version, '')), '') is not null;

  if v_has_external_ref then
    if p_external_integration_id is null then
      raise exception 'External integration id is required';
    end if;

    if nullif(trim(p_external_participant_token), '') is null then
      raise exception 'External participant token is required';
    end if;

    if nullif(trim(p_external_submission_token), '') is null then
      raise exception 'External submission token is required';
    end if;

    if nullif(trim(p_external_token_version), '') is null then
      raise exception 'External token version is required';
    end if;

    if nullif(trim(p_external_notice_version), '') is null then
      raise exception 'External notice version is required';
    end if;
  end if;

  if v_has_external_ref then
    begin
      insert into public.survey_responses (
        survey_id,
        survey_link_id,
        submitted_language,
        answers_json,
        pipeline_status,
        country_code_raw,
        postal_code_raw,
        raw_location_retention_until,
        mapping_hash_at_submission,
        measurement_hash_at_submission,
        legal_consent_accepted_at,
        legal_consent_statement,
        legal_consent_version,
        legal_privacy_notice_version,
        legal_cookie_notice_version,
        legal_consent_source
      )
      values (
        p_survey_id,
        p_survey_link_id,
        p_submitted_language,
        p_answers_json,
        'queued',
        p_country_code_raw,
        p_postal_code_raw,
        p_raw_location_retention_until,
        p_mapping_hash_at_submission,
        p_measurement_hash_at_submission,
        timezone('utc', now()),
        p_legal_consent_statement,
        p_legal_consent_version,
        p_legal_privacy_notice_version,
        p_legal_cookie_notice_version,
        p_legal_consent_source
      )
      returning id into v_response_id;

      insert into public.response_external_refs (
        response_id,
        integration_id,
        participant_token,
        submission_token,
        token_version,
        notice_version
      )
      values (
        v_response_id,
        p_external_integration_id,
        p_external_participant_token,
        p_external_submission_token,
        p_external_token_version,
        p_external_notice_version
      );
    exception
      when unique_violation then
        select response_id
        into v_existing_response_id
        from public.response_external_refs
        where integration_id = p_external_integration_id
          and submission_token = p_external_submission_token;

        if v_existing_response_id is not null then
          return v_existing_response_id;
        end if;

        raise;
    end;
  else
    insert into public.survey_responses (
      survey_id,
      survey_link_id,
      submitted_language,
      answers_json,
      pipeline_status,
      country_code_raw,
      postal_code_raw,
      raw_location_retention_until,
      mapping_hash_at_submission,
      measurement_hash_at_submission,
      legal_consent_accepted_at,
      legal_consent_statement,
      legal_consent_version,
      legal_privacy_notice_version,
      legal_cookie_notice_version,
      legal_consent_source
    )
    values (
      p_survey_id,
      p_survey_link_id,
      p_submitted_language,
      p_answers_json,
      'queued',
      p_country_code_raw,
      p_postal_code_raw,
      p_raw_location_retention_until,
      p_mapping_hash_at_submission,
      p_measurement_hash_at_submission,
      timezone('utc', now()),
      p_legal_consent_statement,
      p_legal_consent_version,
      p_legal_privacy_notice_version,
      p_legal_cookie_notice_version,
      p_legal_consent_source
    )
    returning id into v_response_id;
  end if;

  insert into public.processing_jobs (
    response_id,
    job_type,
    status
  )
  values (
    v_response_id,
    'response_enrichment',
    'pending'
  );

  return v_response_id;
end;
$$;

revoke all on function public.create_survey_response_with_job(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  timestamptz,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.create_survey_response_with_job(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  timestamptz,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text
) to service_role;
