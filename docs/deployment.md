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

## Future integrations

Authentication, Supabase, and other external services should be added only after:

- the data-flow boundary is documented
- public versus server-side variables are clearly separated
- least-privilege credentials are defined
