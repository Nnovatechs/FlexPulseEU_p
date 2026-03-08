# Architecture Overview

## Current phase

This repository is intentionally limited to project foundations.

It currently contains:

- a `Next.js` application shell
- repository governance documents
- CI and quality checks
- secure defaults for environment and deployment preparation

It does not yet contain domain functionality, authentication, or data-provider integrations.

## Design principles

- keep the public client thin
- keep sensitive logic server-side by default
- make future provider integrations explicit and replaceable
- document decisions early so the repository remains reviewable

## Near-term evolution

Future phases may add:

- authentication
- Supabase integration
- survey domain models and workflows
- semantic mapping capabilities
- deployment environment separation across development, staging, and production
