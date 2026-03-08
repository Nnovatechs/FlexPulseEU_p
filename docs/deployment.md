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

## Future integrations

Authentication, Supabase, and other external services should be added only after:

- the data-flow boundary is documented
- public versus server-side variables are clearly separated
- least-privilege credentials are defined
