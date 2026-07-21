# Deployment Notes

## Target platform

The intended deployment target is `Vercel`.

## Foundation-phase expectations

Before connecting the project to a hosting provider:

- all CI checks should pass
- repository protections should be active on `main`
- environment variables should be configured in the platform, not committed to the repository

## Environment policy

- local development uses local `.env` files that remain untracked
- shared placeholders live in `.env.example`
- production values must be managed in the hosting platform

## Survey publish rollout ordering

When deploying public survey links, use this order:

1. Apply `20260408100000_create_survey_response_with_job_rpc.sql` so public
   submissions can create responses and processing jobs transactionally.
2. Deploy the application version that calls that RPC and reads public survey
   links and surveys through the server-side service-role loader.
3. Apply `20260409100000_restrict_public_survey_reads.sql` only after the
   service-role loader is live.

Do not run that migration first by habit: it removes anonymous public read
policies from `surveys` and `survey_links`, so `/s/...` links will stop loading
until the service-role loader is live.

Before broadly sharing public survey links, plan abuse controls for public
submission traffic: rate limiting, bot friction, and/or per-link response caps.
The current server-side validation protects data shape, but it does not prevent
spam submissions or unnecessary enrichment/API work from a leaked token.

## Response mapping rollout ordering

When deploying the enrichment-to-mapping pipeline, keep database and application
changes aligned:

1. Apply `20260408120000_add_response_mapping_runtime.sql` so the
   `response_mapping` table, `measurement_hash_at_submission`, and
   `response_mapping` processing jobs exist.
2. Apply `20260409120000_update_response_creation_rpc_for_mapping.sql` and
   deploy the application version that calls the 9-parameter RPC
   (`p_measurement_hash_at_submission`). These two steps must ship together:
   the app fails on public submit if the RPC signature is missing or still the
   legacy 8-parameter version.
3. Apply `20260409100000_restrict_public_survey_reads.sql` only after the
   service-role loader is live (same rule as above).

For a clean database, the full survey-runtime order is:

1. `20260408100000_create_survey_response_with_job_rpc.sql`
2. Deploy the RPC-aware application and service-role public survey loader
3. `20260408120000_add_response_mapping_runtime.sql`
4. `20260409120000_update_response_creation_rpc_for_mapping.sql` + deploy the
   mapping-aware application
5. `20260409100000_restrict_public_survey_reads.sql`

After applying `20260409120000`, verify Postgres exposes a single RPC overload:

```sql
\df public.create_survey_response_with_job
```

## Public survey legal consent rollout ordering

When deploying persisted legal consent for public submissions, apply
`20260621140000_add_public_survey_legal_consent.sql` before deploying the
application version that sends the legal consent RPC parameters.

This migration updates `survey_responses` and replaces
`create_survey_response_with_job` with the consent-aware signature. Deploying the
application first will cause public survey submissions to fail until the new RPC
exists.

After applying the migration, verify Postgres exposes a single consent-aware RPC
overload:

```sql
\df public.create_survey_response_with_job
```

## Owner privacy settings rollout ordering

Apply `20260716120000_add_owner_legal_profiles.sql` before deploying the
application version that exposes Privacy Settings or survey-specific privacy
notices.

The migration is additive: it creates `owner_legal_profiles` and
`survey_legal_snapshots` without changing the existing `surveys` columns. It
also adds a database trigger that requires a legal snapshot only when a draft
transitions to published. Surveys that were already published remain readable
and use the deployment legal configuration as a legacy fallback.

After deployment:

1. Complete `/account/privacy` for each account allowed to publish.
2. Publish a synthetic draft and verify one matching row exists in
   `survey_legal_snapshots`.
3. Open `/s/<link-token>/privacy` anonymously.
4. Confirm the survey form links separately to the survey, platform, and cookie
   notices.

## DPA rollout ordering

Apply `20260716153000_add_dpa_acceptances.sql` before deploying the DPA flow.
The migration adds private contractual fields to `owner_legal_profiles` and an
immutable, owner-isolated `dpa_acceptances` table.

Keep `DPA_REQUIRED=0` until:

1. the Processor identity and registered address are configured;
2. the Controller has saved its address and authorised representative;
3. the DPA wording and subprocessor list have been legally reviewed;
4. the generated document has been accepted and its record verified.

Set `DPA_REQUIRED=1` only after those steps. Enabling it earlier blocks new
survey publications but does not alter already-published surveys.

## Platform terms rollout ordering

Apply `20260717113000_add_terms_acceptances.sql` before enabling the platform
terms gate.

Keep `TERMS_REQUIRED=0` until:

1. the migration has been applied successfully;
2. the current terms page has been reviewed in the target deployment;
3. at least one invited test user has completed the acceptance flow;
4. recovery/login flows have been smoke-tested with the final access policy.

Set `TERMS_REQUIRED=1` only after those steps. Enabling it earlier will block
private workspace access until the acceptance table exists and the terms flow is
operational.

## Future integrations

Authentication, Supabase, and other external services should be added only after:

- the data-flow boundary is documented
- public versus server-side variables are clearly separated
- least-privilege credentials are defined
