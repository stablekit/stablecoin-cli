# @stablecoin/cli

[![npm version](https://img.shields.io/npm/v/%40stablecoin%2Fcli)](https://www.npmjs.com/package/@stablecoin/cli)
[![CI](https://github.com/stablekit/stablecoin-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/stablekit/stablecoin-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](./LICENSE)

Scriptable CLI for the Stablecoin API surface, including payments, wallets, balances, apps, projects, contracts, compliance workflows, and API key management.

## Install

```bash
npm install -g @stablecoin/cli
```

## Configure

```bash
stablecoin config set-key sk_sandbox_...
stablecoin config set-env sandbox
stablecoin config show
```

You can also use `STABLECOIN_API_KEY` for ephemeral auth in CI, scripts, and agent runs.

## Common Workflows

```bash
# scaffold a new app
npx create-stablecoin-app my-app

# configure your key
stablecoin config set-key sk_sandbox_...

# list your apps in JSON for scripts
stablecoin apps list --json

# create a wallet on Base
stablecoin wallets create --chain base --label treasury --json

# generate, validate, compile, and deploy a contract
stablecoin contracts launch --spec @spec.json --chain base-sepolia --json

# review compliance queue
stablecoin compliance approvals list --my-queue --json

# create a sandbox API key
stablecoin api-keys create --name ci --tier professional --env sandbox --json
```

## Command Reference

| Group | Description | Example |
| --- | --- | --- |
| `payments` | Create, fetch, and list stablecoin payments. | `stablecoin payments list --json` |
| `wallets` | Create wallets, inspect details, and view wallet balances. | `stablecoin wallets balances wallet_123 --json` |
| `balances` | Show balances across all wallets. | `stablecoin balances --json` |
| `apps` | List, create, deploy, delete, and inspect applications. | `stablecoin apps deploy app_123 --env sandbox --json` |
| `projects` | Manage projects and inspect deployments. | `stablecoin projects deployments list proj_123 --json` |
| `contracts` | Generate, validate, compile, simulate, deploy, launch, and verify contracts. | `stablecoin contracts validate --source @Token.sol --json` |
| `compliance` | List, create, inspect, and decide approvals plus list licenses. | `stablecoin compliance approvals list --status pending --json` |
| `api-keys` | List, create, and revoke API keys. | `stablecoin api-keys list --env sandbox --json` |
| `config` | Store local auth and environment defaults. | `stablecoin config show` |

## Global Flags

- `--json` outputs raw JSON instead of tables.
- `--env sandbox|production` overrides the configured environment.
- `--api-key <key>` supplies an ephemeral API key for the current command.

## Config Resolution

- Primary config path: `~/.stablecoin/config.json`
- Upgrade fallback: `~/.stablecoinroadmap/config.json`
- Environment variables override the config file.

## Environment Variables

| Variable | Description |
| --- | --- |
| `STABLECOIN_API_KEY` | Bearer token for the SDK and CLI. Treat this like a secret. |
| `STABLECOIN_ENV` | Environment override for sandbox or production flows. |
| `STABLECOIN_BASE_URL` | Optional API base URL override for local or preview environments. |

## `create-stablecoin-app`

Bootstrap a starter app, then use this CLI to inspect apps, deploy contracts, and manage keys.

```bash
npx create-stablecoin-app my-app
cd my-app
```

## For AI Agents

Agent-oriented docs live in [AGENTS.md](./AGENTS.md) and [CLAUDE.md](./CLAUDE.md). Use `--json` for machine-readable output, prefer `--api-key` for ephemeral auth, and validate mutating flows in sandbox before production.

## Public Docs

- [Developers](https://www.stablecoinroadmap.com/developers)
- [API Reference](https://www.stablecoinroadmap.com/docs/api-reference)
- [Authentication](https://www.stablecoinroadmap.com/docs/authentication)

## Security Notes

- Keep `STABLECOIN_API_KEY` out of source control and CI logs.
- Start in sandbox before using production credentials or live payment flows.
- Review generated contracts and deployment approvals before shipping to mainnet.
- Use least-privilege API keys and rotate them when team membership changes.
