# Security Policy

## Scope

This repository is prepared for public review of the FlexPulse-EU D2 Stage 2
technical prototype. It contains application code, migrations, tests, and
validation fixtures, but it must not contain hosted secrets, production datasets,
or private operational notes.

Security expectations:

- do not commit secrets, API keys, tokens, private certificates, or real `.env`
  files
- keep production credentials only in platform-managed environment variables
- keep Supabase service-role access, OpenAI calls, cron workers, and other
  sensitive integrations server-side
- treat `docs/internal/` and unpublished reporting material as private unless
  explicitly reviewed for publication

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the project maintainer instead of opening a public issue.

When reporting, include:

- a clear description of the issue
- affected files, paths, or flows
- reproduction steps if available
- impact assessment
- suggested remediation if known

## Repository protections

The intended public-repository policy is:

- no direct pushes to `main`
- changes merged via Pull Request only
- required CI checks before merge
- at least one review before merge

## Secret handling

- `.env.example` documents placeholders only
- `.env*` files with real values must stay untracked
- Supabase, OpenAI, Turnstile, cron, and internal worker secrets must be managed
  outside Git
- public survey worker routes are protected by shared secrets and must be tested
  with production-like platform environment variables before broad use
- legal disclosure variables such as controller name and contact email should be
  configured before deploying public legal pages
