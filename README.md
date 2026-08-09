# FlexPulse-EU

**License:** Apache-2.0

FlexPulse-EU is an O-CEI Open Call project for Pilot 1 / Challenge P1C2. This repository contains the open-source Stage 2 FlexPulse-EU implementation: the web application, database schema, survey generation workflow, publication and response-collection pipeline, semantic mapping, behavioural profiling, analytics-ready aggregation, validation harnesses, and supporting operational modules.

The hosted Stage 2 deployment is the reference execution environment for D2 review. This repository makes the implemented system reviewable, auditable and reproducible at code level, while excluding only hosted secrets, managed infrastructure state, private operational notes and non-public data.

## Project Context

- Programme: O-CEI Open Call
- Pilot / challenge: Pilot 1 / Challenge P1C2
- Deliverable scope: D2 Stage 2
- Technical focus: behavioural measurement, semantic mapping, profiling, and controlled hosted validation

## Visibility And Funding Acknowledgement

<p>
  <img src="public/brand/eu-cofunded-pos-official.png" alt="Co-funded by the European Union" height="58" />
  <img src="public/brand/ocei-horizontal-pos.png" alt="O-CEI project logo" height="58" />
</p>

This work was framed in the context of the project OCEI, which receives funding
from the European Union's Horizon Europe research and innovation programme
under grant agreement `101189589`.

Views and opinions expressed are, however, those of the author(s) only and do
not necessarily reflect those of the European Union. Neither the European Union
nor the granting authority can be held responsible for them.

## What This Repository Contains

This repository includes the project-specific application code, contracts, tests, and validation harnesses for the Stage 2 behavioural processing pipeline:

- `Next.js` / `React` / `TypeScript` application for survey creation, publication, public response collection, and analytics views.
- Supabase schema migrations and RPC definitions for survey runtime persistence, response processing jobs, semantic mapping outputs, and legal consent audit fields.
- FlexPulse behavioural schema and measurement-plan logic used to connect behavioural constructs to survey questions and analytics outputs.
- LLM-assisted generation, validation, translation, and polishing modules for design-time survey production.
- Deterministic runtime response mapping and profiling modules.
- Unit, integration, synthetic cohort, and evaluation tests supporting the D2 validation evidence.

## Current Implementation Scope

The current Stage 2 implementation includes the main technical capabilities required for the D2 prototype milestone:

- Authenticated survey-management workflow for creating, reviewing, validating and publishing behavioural surveys.
- Schema-driven survey generation through behavioural concept selection, measurement planning and survey writing.
- Validation, translation and multilingual review support for generated survey artefacts.
- Controlled public survey publication and response collection through stable public links.
- Server-side response persistence, processing-job creation and consent accountability metadata.
- Context enrichment and preparation of submitted responses for downstream processing.
- Deterministic semantic mapping using frozen measurement plans and mapping contracts.
- Behavioural profiling, scoring, descriptor generation and cohort-level aggregation.
- Analytics-facing outputs and schema-driven filtering/grouping logic.
- Unit, integration, synthetic cohort and model-backed evaluation harnesses supporting D2 validation evidence.

For D2 review, the implementation is assessed mainly through three Technical Performance Indicator areas:

- **Survey generation:** schema-driven generation, methodology constraints, validation gates, translation support and publication checks.
- **Semantic mapping:** frozen measurement plans and mapping contracts, response enrichment, transform strategies, polarity handling, threshold tags and mapper outputs.
- **Profiling and aggregation:** behavioural profile construction, evidence levels, cohort analytics, schema-driven filters and privacy-aware aggregation thresholds.

The Stage 2 scope is a controlled hosted prototype. It demonstrates an integrated workflow from survey design to analytics-ready behavioural outputs, but it is not a final multi-site pilot deployment.

## What Is Not Included

The public repository does not include:

- real hosted environment values or secrets;
- Supabase service-role keys, OpenAI keys, Turnstile secrets, cron secrets, or Vercel project secrets;
- private operational notes under `docs/internal/`;
- managed Supabase/Vercel project state;
- production respondent datasets;
- private deliverable drafts or unpublished reporting material.

Configuration placeholders are documented in `.env.example`. Real values must be managed in local `.env*` files or the hosting platform.

## Architecture Overview

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

At design time, LLM-backed modules assist with survey planning, writing, validation, and translation. At runtime, submitted responses are processed through server-side validation, persisted contracts, asynchronous jobs, deterministic mapping rules, and aggregate analytics.

## Repository Structure

| Path | Purpose |
| --- | --- |
| `src/app/` | Next.js routes for authenticated app screens, public survey links, legal pages, and internal APIs. |
| `src/components/` | UI components, including public survey rendering and survey editor views. |
| `src/features/ontology/` | FlexPulse behavioural schema definitions. |
| `src/features/surveys/` | Survey generation, validation, translation, publication, response processing, mapping, profiling, and analytics logic. |
| `src/lib/` | Shared configuration, Supabase clients, LLM env handling, Turnstile, and internal job auth. |
| `supabase/migrations/` | Database schema, RLS, RPCs, response runtime, mapping runtime, and consent persistence migrations. |
| `tests/unit/` | Unit coverage for schema, generator, mapper, analytics, validation, translation, server routes, and repository logic. |
| `tests/integration/` | Integration coverage for public actions, analytics routes, translation actions, validation actions, and optional live Open-Meteo enrichment. |
| `tests/evals/` | Evaluation harnesses for generator, planner, validation, translation, mapper, profiling, and synthetic cohorts. |
| `tests/fixtures/` | Synthetic and fixture data used by validation and evaluation suites. |
| `docs/` | Public architecture and deployment guidance. |

## D2 Evidence Map

| D2 technical area | Repository evidence |
| --- | --- |
| Schema-driven behavioural measurement | `src/features/ontology/`, `src/features/surveys/measurement-plan.ts`, `src/features/surveys/generator-config.ts`; validation tests and generator fixtures. |
| Survey generation and validation | `src/features/surveys/survey-generation-flow.ts`, `generator-service.ts`, `generator-validation.ts`, `content-validator.ts`; `eval:generator`, `eval:validation`. |
| Multilingual readiness | `translation-loop.ts`, `translation-service.ts`, `translation-polish.ts`, `translation-validation.ts`; `eval:translation`, `eval:multicultural-pipeline`. |
| Public collection and processing | `public-actions.ts`, `response-validation.ts`, `response-repository.ts`, `response-processing.ts`; integration tests for public actions, internal jobs, Turnstile, legal consent, and response processing. |
| Semantic mapping | `response-mapper.ts`, `generator-mapping.ts`, `measurement-plan.ts`; mapper unit/eval tests and synthetic mapping fixtures. |
| Profiling and analytics | `survey-analytics.ts`, `survey-analytics-repository.ts`, `analytics/profile-explorer-utils.ts`; profiling evals, synthetic cohort evals, analytics route tests, demo workflow. |
| Privacy and operational safeguards | `src/app/(public)/privacy/`, `src/app/(public)/cookies/`, `src/lib/server/turnstile.ts`, `src/lib/server/internal-job-auth.ts`; public action tests, legal consent persistence migration, deployment checklist. |

## Running Checks

Use Node `22` as defined in `.nvmrc`, then install dependencies:

```bash
npm install
```

The following checks run without real hosted secrets, OpenAI keys, Supabase credentials, or local `.env` values:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run eval:mapper-profiling:ci
npm run build
```

`npm run test:integration` uses mocked Supabase/server boundaries for the default suite. The live Open-Meteo integration test is skipped unless explicitly enabled with `OPEN_METEO_LIVE_TESTS=true`.

The mapper/profiling evidence bundle can be run without external services:

```bash
npm run eval:mapper-profiling
```

Evaluation outputs are written under `.tmp/evals/`. The mapper/profiling bundle produces:

- `.tmp/evals/mapper/latest/report.json`
- `.tmp/evals/profiling/latest/report.json`
- `.tmp/evals/synthetic-cohorts/latest/report.json`
- `.tmp/evals/mapper-profiling/latest/summary.json`
- `.tmp/evals/mapper-profiling/latest/summary.md`

LLM-backed evaluation suites require an `OPENAI_API_KEY` and are intended as improvement/evidence harnesses rather than default public CI checks:

```bash
npm run eval:generator
npm run eval:planner
npm run eval:validation
npm run eval:translation
npm run eval:multicultural-pipeline
```

## Local Development Notes

For local development, copy `.env.example` into a local `.env.local` file and fill only the values needed for the workflow being tested:

```bash
npm run dev
```

Application flows that require Supabase, OpenAI, Turnstile, Vercel Cron, or hosted legal configuration need matching environment variables. The hosted D2 deployment remains the reference execution environment for end-to-end survey generation, public submission, job processing, and analytics demonstration.

## Reports And Demonstration

The D2 Technical Documentation Report, Validation Artefacts Report, demo video, and hosted demonstration environment are maintained as project deliverables outside this public source tree unless explicitly published by the project team.

Use this repository together with those artefacts:

- the Technical Documentation Report explains architecture, design rationale, and module responsibilities;
- the Validation Artefacts Report explains the test/evaluation evidence and controlled hosted validation results;
- the demo video shows the implemented workflow in the hosted D2 environment.

## Security And Privacy

- Do not commit `.env*` files with real values.
- Keep service-role, OpenAI, Turnstile, cron, and hosted deployment secrets in the platform secret manager.
- Public survey submissions require server-side validation and persisted legal consent metadata.
- Public survey links should be shared only according to the intended validation context.
- Internal job endpoints bypass user-session auth for cron compatibility but require shared-secret authorization.

See `SECURITY.md` and `docs/deployment.md` for additional operational guidance.

## License

Apache-2.0.
