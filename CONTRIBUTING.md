# Contributing

## Prerequisites

- Node.js 18 or newer
- npm
- A sandbox `STABLECOIN_API_KEY`

## Setup

```bash
npm install
export STABLECOIN_API_KEY=sk_sandbox_...
```

## Development Workflow

```bash
npm run dev
npm run typecheck
```

- `npm run dev` watches and rebuilds the CLI with `tsup`
- `npm run typecheck` runs TypeScript without emitting files
- `npm run build` creates the distributable `dist/` output

## Adding a Command

1. Create or update the command handler in `src/commands/` or `src/commands.ts`.
2. Wire the new handler into the switch in `src/cli.ts`.
3. Update the `HELP` string in `src/cli.ts`.
4. Run `npm run typecheck` and `npm run build`.
5. Update `README.md`, `AGENTS.md`, `CLAUDE.md`, and `llms.txt` if the public command surface changed.

## Pull Requests

- Use focused PRs with a clear scope.
- Follow Conventional Commits when possible, for example `feat(cli): add wallets export`.
- Include repro steps for bug fixes and example commands for new CLI behavior.
- Prefer sandbox examples over production examples in docs and tests.

## Issue Triage

- Bugs should include the command run, expected behavior, actual behavior, Node version, and OS.
- Feature requests should describe the user workflow and the proposed command signature.
