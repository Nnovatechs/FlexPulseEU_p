create or replace function public.create_survey_response_with_job(
  p_survey_id uuid,
  p_survey_link_id uuid,
  p_submitted_language text,
  p_answers_json jsonb,
  p_country_code_raw text,
  p_postal_code_raw text,
  p_raw_location_retention_until timestamptz,
  p_mapping_hash_at_submission text
)
returns uuid
language plpgsql
as $$
declare
  v_response_id uuid;
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
    mapping_hash_at_submission
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
    p_mapping_hash_at_submission
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
  text
) to service_role;
