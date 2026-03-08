# FlexPulseEU

**License:** Apache-2.0

FlexPulseEU is a repository for the development of the FlexPulseEU project, part of the O-CEI Open Call programme.

The repository currently establishes the technical foundations and development environment for the project. At this stage, the goal is to provide a clean and maintainable baseline that supports future implementation while remaining easy to review and extend.

## Current state

This first phase focuses on setting up the core development structure, including:

- `Next.js` + `TypeScript` application scaffold
- project structure and development conventions
- repository governance and contribution guidance
- CI pipeline for linting, type checking, testing, and production builds
- secure defaults for environment configuration and future integrations

## Current scope

The repository currently contains **project foundations only**.
Application features and domain-specific functionality will be introduced progressively as development advances.

At this stage, the repository does not yet implement:

- authentication
- Supabase integration
- survey domain models
- semantic mapping or ontology-related features

These areas are intentionally deferred to later phases so the base architecture remains stable and easy to evolve.

## Stack

- `Next.js`
- `React`
- `TypeScript`
- `ESLint`
- `GitHub Actions`

## Local development

1. Use Node `22` as defined in `.nvmrc`.
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` into a local environment file when needed.
4. Start the development server:

```bash
npm run dev
```

## Quality checks

Run the baseline quality gates locally:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Governance

- License: Apache-2.0
- Default branch strategy: `main` protected through Pull Requests
- Reviews: at least one reviewer before merge
- Checks: CI must pass before merge

See `CONTRIBUTING.md`, `SECURITY.md`, `docs/architecture.md`, and `docs/deployment.md` for additional project guidance.
