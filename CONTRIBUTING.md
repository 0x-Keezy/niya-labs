# Contributing to Niya Labs

Thanks for helping. Niya Labs is a hackathon project — we keep the bar practical and the feedback loop tight.

## Getting set up

Follow [SETUP.md](SETUP.md). If the app doesn't boot on a fresh clone, that's a bug worth filing — open an issue with the exact error.

## Workflow

1. **Fork** the repo and create a feature branch: `git checkout -b fix/short-description`.
2. **Code style**: TypeScript strict, Prettier defaults (`npm run format`). No ESLint errors in files you touch (`npm run lint`).
3. **Tests**: `npm run test:unit` must pass. Add a test when you fix a bug, even a small one.
4. **Typecheck**: `npx tsc --noEmit` must be clean for the files you modify (pre-existing errors in `extension/src/` and `__tests__/processResponse.spec.ts` are known and tracked).
5. **Commit message**: conventional-ish — `fix: …`, `feat: …`, `docs: …`, `chore: …`. One-line subject + optional body.
6. **Pull request**: describe what changed and why, link to any issue, include a screenshot for UI changes. Keep PRs under ~300 lines of diff; split larger work.

## What we care about

- **Keep the two surfaces decoupled.** `/tools` and `/companion` must remain independently deployable. If a change couples them, flag it.
- **Backend first, UI second.** Business logic belongs in `src/features/**`, not in React components.
- **Secrets never in code.** `.env.local` is gitignored — never `git add` it, never paste a real key in a PR comment.
- **Rate-limit monetary endpoints.** Anything that calls DGrid / ElevenLabs / GMGN costs money. Use `enforceRateLimit()` or `checkAndConsumeRateLimit()` from `server/storage.ts`.

## Priority areas

- Live2D expression mapping, VRM designers, WebGPU rendering.
- Mobile-responsive layout for `/tools` and `/companion`.
- Documentation — especially the API reference at `docs/API.md`.
- Scalability refactors (see `docs/ARCHITECTURE.md` backlog section).

## Questions

- [@NiyaAgent on X](https://x.com/NiyaAgent)
- Open a GitHub issue tagged `question`.

## Code of conduct

Be excellent to each other. Harassment, spam, and bad-faith contributions will be closed without discussion.
