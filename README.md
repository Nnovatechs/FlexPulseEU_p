# FlexPulse-EU

Survey-based behavioural intelligence for residential energy flexibility.

**O-CEI Open Call · Pilot 1 / Challenge P1C2 · Stage 3 delivery (D3)**  
**Source-code license:** [Apache-2.0](LICENSE)

FlexPulse-EU helps teams prepare multilingual surveys, collect household responses and turn them into structured indicators, explorable segments and reusable analytical outputs. It keeps a traceable connection between behavioural concepts, survey questions, scoring rules and results.

This repository contains the project-specific open-source implementation delivered for Stage 3. It builds on the Stage 2 survey-generation, semantic-mapping and profiling pipeline, adding Analytics V2, interoperability interfaces and the controls used for hosted operation and real-response validation.

## Funding and Project Acknowledgement

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

## What the Platform Does

- **Survey preparation:** schema-based concept selection, LLM-assisted planning and writing, automated validation, multilingual generation, controlled editing and expert review.
- **Publication and collection:** published survey links, consent records, conditional questions, audience links and Prolific recruitment integration.
- **Response processing:** asynchronous processing, optional contextual enrichment and deterministic mapping against published measurement and mapping contracts.
- **Behavioural outputs:** construct scores, facets and device-specific Declared Flexibility Capability, preserving applicability and scoring direction.
- **Analytics V2:** survey overview, segment exploration, group comparison, Instrument Health and geographic views.
- **Interoperability:** versioned, owner-scoped JSON resources and aggregate queries, supported by an OpenAPI contract and analytical exports.
- **Hosted operation:** account access, owner privacy configuration, legal snapshots, protected processing jobs and raw-location retention controls.

Survey preparation combines automated assistance with human review. Submitted responses are scored through deterministic rules, rather than reinterpreted by an LLM.

## Stage 3 Delivery

Stage 3 brings the existing processing pipeline into an integrated survey-to-analysis workflow.

| Stage 3 commitment | Implemented capability | Main repository evidence |
| --- | --- | --- |
| TPI1 — Behavioural Analytics Dashboard | Overview, segments, comparisons, Instrument Health and geographic exploration | `src/features/surveys/analytics/`, `src/app/(app)/surveys/[surveyId]/analytics-v2/`, `tests/unit/surveys/analytics/` |
| TPI2 — Interoperability Export Interfaces | Read-only API, survey contracts, responses, profiles and bounded aggregate queries | `src/features/interoperability/`, `src/app/api/v1/`, `tests/unit/interoperability/`, `tests/integration/interoperability/` |
| TPI3 — Pilot-Facing Access and Operational Validation | Controlled stakeholder access, internal usage testing and real-response processing | `src/features/access/`, `src/features/privacy/`, survey runtime and integration tests; operational evidence in the D3 Validation Report |
| TPI4 — System Documentation and Marketplace Integration | Technical and validation documentation, deployment guidance, demonstrations and solution listing | Public repository documentation and the separately delivered D3 evidence package |

Supporting improvements include device-specific Declared Flexibility Capability, survey duplication, expert review, targeted multilingual refinement, optional post-survey feedback and external recruitment support.

## Architecture

```text
Behavioural schema and measurement definitions
    -> assisted survey generation and validation
    -> human review and multilingual refinement
    -> publication with frozen measurement and mapping contracts
    -> public response collection and recorded consent
    -> asynchronous processing and deterministic mapping
    -> persisted behavioural indicators and facets
        -> Analytics V2
        -> Interoperability API and analytical exports
```

The application uses Next.js, React and TypeScript, with Supabase authentication
and PostgreSQL persistence. The hosted deployment uses Vercel.

The dashboard and API reuse the survey's effective schema and mapped outputs.
Question keys, scoring rules and contract hashes connect the collected answers
to their analytical interpretation.

See [Architecture](docs/architecture.md) for the underlying system and
[Deployment Notes](docs/deployment.md) for environment configuration,
migration dependencies and operational procedures.

## Validation and Interpretation

Stage 3 validation combined automated software checks, questionnaire review,
cognitive pretesting, an English pretest with 50 participants in Ireland and
a final multilingual study with 1,000 analysed responses across Spain,
France and Ireland.

Software tests check calculations, contracts, access boundaries and processing
behaviour. The field study exercises the integrated workflow and provides
evidence about the reviewed questionnaire and its analytical uses.

The platform supports analysis of declared household preferences and practical
conditions. Segments use explicit selection criteria, while continuous scores,
facets and device-specific results retain the detail behind those selections.

The D3 Integration and Validation Report documents the methods, results and
interpretation boundaries. Its empirical findings concern the reviewed
instrument and recruited sample; they are not an automatic validation of every
survey subsequently generated with the platform.

## Interoperability

Interoperability API v1 provides controlled server-to-server access to:

- survey metadata and measurement/mapping contracts;
- the survey-specific analytical field catalogue;
- paginated responses and mapped profiles;
- validated aggregate queries.

Access uses owner-scoped bearer tokens and explicit permissions. The API is
read-only and does not provide unrestricted database access.

On a configured deployment:

- `/docs/api` provides the API documentation;
- `/api/v1/openapi` provides the OpenAPI contract;
- `/account/api` allows an authenticated owner to manage API tokens.

Analytics V2 also provides JSON exports for segment analysis, segment comparison
and Instrument Health.

## Repository Structure

| Path | Purpose |
| --- | --- |
| `src/app/` | Authenticated application, public survey routes, legal pages and API routes |
| `src/components/` | Survey, editor, dashboard and shared interface components |
| `src/features/ontology/` | FlexPulse Behavioural Schema definitions |
| `src/features/surveys/` | Generation, review, publication, processing, mapping and analytics |
| `src/features/interoperability/` | API contracts, authentication, resources and aggregate access |
| `src/features/access/` | Hosted access controls |
| `src/features/privacy/` | Owner privacy settings and legal publication controls |
| `src/lib/` | Shared configuration, server clients and infrastructure helpers |
| `supabase/migrations/` | Database schema, policies, functions and runtime migrations |
| `tests/unit/` | Unit and regression tests |
| `tests/integration/` | Integration tests for routes and service boundaries |
| `tests/evals/` | Generation, mapping, profiling, cohort and DFC evaluation harnesses |
| `tests/fixtures/` | Synthetic test and evaluation fixtures |
| `docs/` | Public architecture and deployment guidance |

## Installation and Checks

Use Node.js 22, as specified in `.nvmrc`.

```bash
npm ci
npm run ci
```

The CI script runs linting, type checking, unit and integration tests,
mapper/profiling evaluations, DFC evaluations and a production build.

Individual checks can also be run:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run eval:mapper-profiling:ci
npm run eval:dfc:ci
npm run build
```

The default integration suite uses mocked service boundaries. The live
Open-Meteo test is opt-in through `OPEN_METEO_LIVE_TESTS=true`.

To generate the mapper/profiling evidence bundle:

```bash
npm run eval:mapper-profiling
```

Generated evaluation reports are written under `.tmp/evals/`.

LLM-backed evaluations require an `OPENAI_API_KEY` and may incur provider costs.
They are separate from the default CI gate:

```bash
npm run eval:generator
npm run eval:planner
npm run eval:validation
npm run eval:translation
npm run eval:multicultural-pipeline
```

## Local Development and Deployment

Create a local `.env.local` from the placeholders in `.env.example` and configure
the services required by the workflows you want to run.

```bash
npm run dev
```

Functional survey generation, collection and processing require the relevant
database, authentication, LLM, submission-protection and job configuration.
Running the application locally does not provision those external services.

Follow [Deployment Notes](docs/deployment.md) for configuration and coordinated
database/application rollout. Keep production secrets in the hosting platform,
not in the repository.

## Documentation and Delivery Materials

The D3 evidence package includes:

- Stage 3 Technical Documentation;
- Stage 3 Integration and Validation Report;
- demonstration videos;
- the Stage 3 presentation;
- the evidence-package and dissemination summary.

These materials are distributed separately through the project's delivery
channel unless explicitly published by the team.

- [Source repository](https://github.com/Nnovatechs/FlexPulseEU_p)
- [O-CEI Marketplace listing](https://marketplace.pre.o-cei.eu/search/urn:ngsi-ld:product-offering:45d66a65-9494-4018-aaf5-461675f10cb2)
- [Architecture](docs/architecture.md)
- [Deployment Notes](docs/deployment.md)
- [Security Policy](SECURITY.md)

Access to the hosted project environment is provided separately to authorised
stakeholders.

## Security and Data Boundaries

The public repository excludes production respondent datasets, hosted secrets,
private operational notes and unpublished deliverable drafts.

- Keep real `.env` values, service-role keys, LLM keys, API tokens and job secrets out of Git.
- Treat `docs/internal/` as private development material.
- Use the configured consent, publication and access controls when operating surveys.
- Handle row-level exports as controlled research data.
- Report suspected vulnerabilities privately, following [SECURITY.md](SECURITY.md).

## License

The project source code is licensed under [Apache-2.0](LICENSE).
Third-party materials and official project/funding marks retain their applicable
terms.
