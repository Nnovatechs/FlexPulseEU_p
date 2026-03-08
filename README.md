# FlexPulseEU

FlexPulseEU is a private foundation repository for a future Horizon-oriented project focused on population surveys, semantic mapping, and related research workflows.

This first phase establishes a professional, evaluation-ready baseline:

- `Next.js` + `TypeScript` application scaffold
- Apache-2.0 licensing
- repository governance and contribution guidance
- CI for linting, type checking, tests, and production build
- secure defaults for environment handling and future integrations

## Current scope

This repository currently provides project foundations only. It does not yet implement:

- authentication
- Supabase integration
- domain models for surveys
- semantic mapping or ontology features

Those areas are intentionally deferred to later phases so the base remains clean, reviewable, and secure.

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
