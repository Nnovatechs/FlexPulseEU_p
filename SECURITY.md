# Security Policy

## Scope

This repository is currently private and in its foundation phase. Security still applies from day one:

- do not commit secrets, API keys, tokens, or private certificates
- keep real credentials only in local or platform-managed environment variables
- treat future third-party integrations as server-side by default unless explicitly designed to be public

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the project maintainer instead of opening a public issue.

When reporting, include:

- a clear description of the issue
- affected files, paths, or flows
- reproduction steps if available
- impact assessment
- suggested remediation if known

## Repository protections

The intended repository policy is:

- no direct pushes to `main`
- changes merged via Pull Request only
- required CI checks before merge
- at least one review before merge

## Secret handling

- `.env.example` documents placeholders only
- `.env*` files with real values must stay untracked
- future providers such as Supabase must be integrated with least-privilege credentials and clear client/server separation
