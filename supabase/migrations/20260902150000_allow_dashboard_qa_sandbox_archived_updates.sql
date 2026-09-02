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
    if (
      new.status = 'archived'
      and new.id = old.id
      and new.name = old.name
      and new.created_by = old.created_by
      and new.created_at = old.created_at
      and coalesce(old.definition_json #>> '{survey_meta,internal_qa,kind}', '') = 'dashboard_coverage_v2'
      and coalesce(new.definition_json #>> '{survey_meta,internal_qa,kind}', '') = 'dashboard_coverage_v2'
    ) then
      return new;
    end if;

    raise exception 'Archived surveys are immutable.';
  end if;

  return new;
end;
$$;
