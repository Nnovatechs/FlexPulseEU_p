-- Deployment ordering:
-- Apply this migration only after the application version that reads public
-- survey links/surveys through the service-role client has been deployed. If
-- the RLS policy removal lands before that app change, public /s/... survey
-- links will not be readable by the anonymous server client.

drop policy if exists "Public can read published surveys"
on public.surveys;

drop policy if exists "Public can read active links for published surveys"
on public.survey_links;
