# Contributing

## Branching model

- `main` is the protected branch
- create short-lived feature branches from `main`
- merge through Pull Requests only

Suggested branch prefixes:

- `feat/`
- `fix/`
- `docs/`
- `chore/`

## Pull Requests

Before opening a Pull Request:

1. Keep the change focused.
2. Update documentation when relevant.
3. Run the local quality checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

4. Describe why the change is needed.

## Security and secrets

- never commit `.env` files with real values
- never hardcode tokens, secrets, or credentials
- use `.env.example` for placeholders only

## Standards

- prefer small, reviewable changes
- keep naming explicit and consistent
- document architectural decisions that affect future phases
