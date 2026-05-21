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

When deploying public survey links, deploy the application version that reads
public survey links and surveys through the server-side service-role loader
before applying `20260409100000_restrict_public_survey_reads.sql`.

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
