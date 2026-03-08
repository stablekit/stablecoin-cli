# AGENTS.md

`@stablecoin/cli` is a scriptable CLI for the Stablecoin API that supports payments, wallets, balances, apps, projects, contracts, compliance workflows, and API key management.

## Install

```bash
npm install -g @stablecoin/cli
```

## Authentication

Use one of these patterns:

- Export `STABLECOIN_API_KEY=<key>`
- Run `stablecoin config set-key <key>` once to save it to `~/.stablecoin/config.json`
- Use `stablecoin config set-env sandbox|production` to set the default environment
- Use `--api-key <key>` on a single command for ephemeral auth

The CLI defaults to `sandbox` unless `STABLECOIN_ENV`, `stablecoin config set-env`, or `--env` overrides it.

## Output Conventions

- Default output is human-readable tables or plain text.
- `--json` emits machine-readable JSON. Agents should prefer this mode.
- Errors go to `stderr` with exit code `1`.
- Successful commands exit with code `0`.

## Global Flags

- `--json`
- `--env sandbox|production`
- `--api-key <key>`

## Recommended Agent Patterns

- Always use `--json` when another tool will read the result.
- Pipe JSON output into `jq` for field selection.
- Use `--api-key` instead of `config set-key` for ephemeral session auth.
- Default to `--env sandbox` for mutating commands until the user explicitly approves production.

## Command Reference

### `config`

- `stablecoin config set-key <api-key>`
  - Saves the API key to `~/.stablecoin/config.json`
- `stablecoin config set-env <sandbox|production>`
  - Saves the default environment
- `stablecoin config show`
  - Prints the current config with the API key partially redacted

### `payments`

- `stablecoin payments create --amount <amount> --stablecoin <USDC|USDT|DAI> --to <address> --chain <chain>`
  - Creates a payment
- `stablecoin payments get <payment-id>`
  - Fetches one payment
- `stablecoin payments list`
  - Lists payments

### `wallets`

- `stablecoin wallets create --chain <ethereum|polygon|base|solana> [--label <name>]`
  - Creates a wallet
- `stablecoin wallets get <wallet-id>`
  - Fetches one wallet
- `stablecoin wallets list`
  - Lists wallets
- `stablecoin wallets balances <wallet-id>`
  - Lists balances for one wallet

### `balances`

- `stablecoin balances`
  - Lists balances across all wallets

### `apps`

- `stablecoin apps list`
  - Lists apps
- `stablecoin apps get <app-id>`
  - Fetches one app
- `stablecoin apps create --name <name> [--template <slug>] [--description <text>]`
  - Creates an app
- `stablecoin apps deploy <app-id> [--env sandbox|staging|production]`
  - Triggers an app deployment
- `stablecoin apps delete <app-id>`
  - Deletes an app
- `stablecoin apps templates`
  - Lists available app templates

### `projects`

- `stablecoin projects list`
  - Lists projects
- `stablecoin projects get <project-id>`
  - Fetches one project
- `stablecoin projects create --name <name> [--description <text>]`
  - Creates a project
- `stablecoin projects delete <project-id>`
  - Deletes a project
- `stablecoin projects deployments list <project-id>`
  - Lists deployments for a project

### `contracts`

- `stablecoin contracts generate --spec <json|@file.json> [--style minimal|production|auditable]`
  - Generates Solidity from a contract spec
- `stablecoin contracts validate --source <solidity|@file.sol> [--contract-name <name>] [--min-score <0-100>]`
  - Runs contract validation
- `stablecoin contracts compile --source <solidity|@file.sol> [--contract-name <name>] [--compiler <version>] [--optimizer-runs <n>]`
  - Compiles a contract
- `stablecoin contracts simulate --source <solidity|@file.sol> [--contract-name <name>] [--chain base|base-sepolia]`
  - Runs a dry-run simulation
- `stablecoin contracts deploy --abi <json|@file.json> --bytecode <hex> [--chain base|base-sepolia]`
  - Deploys a compiled contract
- `stablecoin contracts launch --spec <json|@file.json> [--style minimal|production|auditable] [--chain base|base-sepolia] [--deploy false]`
  - Runs generate, validate, compile, and deploy as one flow
- `stablecoin contracts verify --address <0x...> --chain <base|base-sepolia> --source <solidity|@file.sol> --contract-name <name>`
  - Verifies a deployed contract

### `compliance`

- `stablecoin compliance approvals list [--my-queue] [--status pending|approved|rejected|expired|cancelled]`
  - Lists approvals
- `stablecoin compliance approvals get <approval-id>`
  - Fetches one approval
- `stablecoin compliance approvals create --chain <chain-id> --risk-score <0-100> [--risk-level low|medium|high|critical] [--estimated-cost <amount>] [--required-approvals <n>] [--deadline-hours <n>]`
  - Creates an approval request
- `stablecoin compliance approvals decide <approval-id> --action approve|approve_conditional|reject [--comment <text>] [--conditions <csv>]`
  - Approves, conditionally approves, or rejects an approval
- `stablecoin compliance licenses list [--status <status>]`
  - Lists licenses

### `api-keys`

- `stablecoin api-keys list [--env sandbox|production]`
  - Lists API keys
- `stablecoin api-keys create --name <name> --tier basic|professional|enterprise [--env sandbox|production] [--expires-in 30d|90d|1y]`
  - Creates an API key
- `stablecoin api-keys revoke <api-key-id> [--env sandbox|production]`
  - Revokes an API key
