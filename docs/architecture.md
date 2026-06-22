# Architecture Overview

## Current Stage

This repository contains the FlexPulse-EU D2 Stage 2 technical prototype. The
implementation covers the controlled hosted workflow from survey design to
analytics-ready behavioural outputs.

It includes:

- a `Next.js` / `React` / `TypeScript` application for survey creation,
  publication, public response collection, and analytics views
- Supabase migrations and RPCs for survey runtime persistence, asynchronous
  processing jobs, mapping outputs, and legal consent audit fields
- schema-driven behavioural measurement logic and frozen publication contracts
- LLM-assisted design-time generation, validation, translation, and polishing
  modules
- deterministic runtime response mapping, profiling, and aggregate analytics
- unit, integration, and evaluation suites for the D2 validation evidence

The Stage 2 scope is a controlled prototype, not a final multi-site production
pilot. Hosted credentials, real respondent datasets, and private operational
material are intentionally excluded from the public repository.

## Processing Flow

```text
Behavioural schema
  -> measurement plan
  -> generated survey
  -> validation and translation
  -> publication with frozen contracts
  -> public response collection
  -> asynchronous enrichment and mapping
  -> behavioural profiles and aggregate analytics
```

Design-time modules may use LLM services to assist survey planning, writing,
validation, and translation. Runtime response processing uses server-side
validation, persisted contracts, asynchronous jobs, deterministic mapping rules,
and aggregation thresholds.

## Design principles

- keep the public client thin
- keep sensitive logic server-side by default
- separate public environment variables from server-only credentials
- keep mapping and profiling outputs traceable to frozen survey contracts
- preserve privacy-aware aggregation boundaries for analytics views
- document deployment order when database RPC signatures and application code
  must change together

## Main Components

- `src/app/`: Next.js routes for authenticated app screens, public survey links,
  legal pages, and internal APIs.
- `src/features/ontology/`: behavioural schema definitions used by the
  measurement-plan layer.
- `src/features/surveys/`: survey generation, publication, response validation,
  mapping, profiling, and analytics logic.
- `src/lib/`: shared configuration, Supabase clients, Turnstile verification,
  internal job authentication, and LLM environment handling.
- `supabase/migrations/`: schema, RLS, RPCs, response runtime, mapping runtime,
  and consent persistence migrations.
- `tests/`: unit, integration, and evaluation coverage for the Stage 2 evidence
  base.

## Operational Boundaries

- Public survey submission routes are intentionally reachable, but protected by
  server-side validation, Turnstile when configured, and worker secrets for
  internal processing endpoints.
- The application expects real secrets to come from local `.env*` files or the
  hosting platform; `.env.example` contains placeholders only.
- Legal pages depend on configured controller/contact variables before a public
  deployment is used with real respondents.
- Raw enrichment inputs and production datasets are not part of the public
  repository.
