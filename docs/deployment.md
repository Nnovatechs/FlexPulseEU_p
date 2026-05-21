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

## Future integrations

Authentication, Supabase, and other external services should be added only after:

- the data-flow boundary is documented
- public versus server-side variables are clearly separated
- least-privilege credentials are defined
