alter table public.survey_responses
  add column if not exists legal_consent_accepted_at timestamptz,
  add column if not exists legal_consent_statement text,
  add column if not exists legal_consent_version text,
  add column if not exists legal_privacy_notice_version text,
  add column if not exists legal_cookie_notice_version text,
  add column if not exists legal_consent_source text;

drop function if exists public.create_survey_response_with_job(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  timestamptz,
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
  p_legal_consent_source text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_response_id uuid;
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
  text
) to service_role;
