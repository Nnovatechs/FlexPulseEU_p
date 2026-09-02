create or replace function public.upsert_dashboard_qa_sandbox_dataset(
  p_owner_user_id uuid,
  p_fixture_name text,
  p_fixture_kind text,
  p_survey jsonb,
  p_link jsonb,
  p_responses jsonb,
  p_mappings jsonb,
  p_enrichments jsonb
)
returns table (
  survey_id uuid,
  response_count integer,
  created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id uuid;
  v_link_id uuid;
  v_created boolean := false;
  v_response_count integer;
begin
  if p_owner_user_id is null then
    raise exception 'Owner is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('dashboard-qa-v2'),
    hashtext(p_owner_user_id::text)
  );

  select s.id
  into v_survey_id
  from public.surveys s
  where s.created_by = p_owner_user_id
    and s.name = p_fixture_name
    and coalesce(s.definition_json #>> '{survey_meta,internal_qa,kind}', '') = p_fixture_kind
  order by s.created_at asc
  limit 1
  for update;

  if v_survey_id is null then
    v_survey_id := (p_survey->>'id')::uuid;
    v_link_id := (p_link->>'id')::uuid;
    v_created := true;

    insert into public.surveys (
      id,
      name,
      status,
      created_by,
      created_at,
      updated_at,
      published_at,
      default_language,
      supported_languages,
      definition_json,
      mapping_contract_json,
      mapping_compiled_json,
      mapping_hash,
      measurement_hash
    )
    values (
      v_survey_id,
      p_fixture_name,
      'archived',
      p_owner_user_id,
      coalesce((p_survey->>'created_at')::timestamptz, timezone('utc', now())),
      coalesce((p_survey->>'updated_at')::timestamptz, timezone('utc', now())),
      coalesce((p_survey->>'published_at')::timestamptz, timezone('utc', now())),
      p_survey->>'default_language',
      array(select jsonb_array_elements_text(p_survey->'supported_languages')),
      p_survey->'definition_json',
      p_survey->'mapping_contract_json',
      p_survey->'mapping_compiled_json',
      p_survey->>'mapping_hash',
      p_survey->>'measurement_hash'
    );

    insert into public.survey_links (
      id,
      survey_id,
      link_token,
      audience_label,
      audience_token,
      is_active,
      created_at
    )
    values (
      v_link_id,
      v_survey_id,
      p_link->>'link_token',
      p_link->>'audience_label',
      p_link->>'audience_token',
      false,
      coalesce((p_link->>'created_at')::timestamptz, timezone('utc', now()))
    );
  else
    select l.id
    into v_link_id
    from public.survey_links l
    where l.survey_id = v_survey_id
    order by l.created_at asc
    limit 1;

    if v_link_id is null then
      raise exception 'Dashboard QA sandbox is missing its internal link.';
    end if;
  end if;

  delete from public.survey_responses sr
  where sr.survey_id = v_survey_id;

  insert into public.survey_responses (
    id,
    survey_id,
    survey_link_id,
    submitted_language,
    responded_at,
    answers_json,
    pipeline_status,
    country_code_raw,
    postal_code_raw,
    raw_location_retention_until,
    mapping_hash_at_submission,
    measurement_hash_at_submission,
    created_at,
    updated_at
  )
  select
    (elem->>'id')::uuid,
    v_survey_id,
    v_link_id,
    elem->>'submitted_language',
    (elem->>'responded_at')::timestamptz,
    elem->'answers_json',
    'ready',
    elem->>'country_code_raw',
    null,
    null,
    elem->>'mapping_hash_at_submission',
    elem->>'measurement_hash_at_submission',
    (elem->>'created_at')::timestamptz,
    (elem->>'updated_at')::timestamptz
  from jsonb_array_elements(p_responses) as elem;

  insert into public.response_mapping (
    response_id,
    mapper_output_json,
    mapping_hash_used,
    measurement_hash_used,
    mapper_version,
    processed_at,
    created_at,
    updated_at
  )
  select
    (elem->>'response_id')::uuid,
    elem->'mapper_output_json',
    elem->>'mapping_hash_used',
    elem->>'measurement_hash_used',
    elem->>'mapper_version',
    (elem->>'processed_at')::timestamptz,
    (elem->>'created_at')::timestamptz,
    (elem->>'updated_at')::timestamptz
  from jsonb_array_elements(p_mappings) as elem;

  insert into public.response_enrichment (
    response_id,
    provider,
    normalized_country_code,
    location_agg_code,
    location_agg_label,
    location_granularity,
    temp_outdoor_c,
    humidity_pct,
    observed_at,
    quality_flag,
    payload_json,
    centroid_lat,
    centroid_lon,
    normalized_location_json,
    created_at,
    updated_at
  )
  select
    (elem->>'response_id')::uuid,
    elem->>'provider',
    elem->>'normalized_country_code',
    elem->>'location_agg_code',
    elem->>'location_agg_label',
    elem->>'location_granularity',
    (elem->>'temp_outdoor_c')::numeric,
    (elem->>'humidity_pct')::numeric,
    (elem->>'observed_at')::timestamptz,
    elem->>'quality_flag',
    elem->'payload_json',
    (elem->>'centroid_lat')::numeric,
    (elem->>'centroid_lon')::numeric,
    elem->'normalized_location_json',
    (elem->>'created_at')::timestamptz,
    (elem->>'updated_at')::timestamptz
  from jsonb_array_elements(p_enrichments) as elem;

  select count(*)::integer
  into v_response_count
  from public.survey_responses sr
  where sr.survey_id = v_survey_id;

  if v_response_count is distinct from jsonb_array_length(p_responses) then
    raise exception 'Dashboard QA sandbox response count mismatch.';
  end if;

  survey_id := v_survey_id;
  response_count := v_response_count;
  created := v_created;
  return next;
end;
$$;

revoke all on function public.upsert_dashboard_qa_sandbox_dataset(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) from public;

grant execute on function public.upsert_dashboard_qa_sandbox_dataset(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;
