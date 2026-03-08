# CLAUDE.md

Install with `npm install -g @stablecoin/cli`.

## Project Session Auth

Use ephemeral auth inside a Claude Code session unless the user explicitly wants persistent local config.

```bash
export STABLECOIN_API_KEY=sk_sandbox_...
stablecoin config set-env sandbox
stablecoin apps list --json
```

You can also pass `--api-key <key>` on one command at a time.

## Safe Commands

These are safe by default because they only read data or run local analysis:

- `config show`
- `payments get`, `payments list`
- `wallets get`, `wallets list`, `wallets balances`
- `balances`
- `apps list`, `apps get`, `apps templates`
- `projects list`, `projects get`, `projects deployments list`
- `contracts generate`, `contracts validate`, `contracts compile`, `contracts simulate`
- `compliance approvals list`, `compliance approvals get`, `compliance licenses list`
- `api-keys list`

## Requires Confirmation

Ask for explicit confirmation before running these:

- Any command with `--env production`
- `config set-key` if it would persist a user secret locally
- `payments create`
- `wallets create`
- `apps create`, `apps deploy`, `apps delete`
- `projects create`, `projects delete`
- `contracts deploy`, `contracts launch`, `contracts verify`
- `compliance approvals create`, `compliance approvals decide`
- `api-keys create`, `api-keys revoke`

## Sandbox-First Rule

Validate mutating flows in `sandbox` before production. If a user asks for production, confirm that the exact command, environment, and payload are correct first.

## Example Task Mappings

- "List all sandbox apps as JSON"
  - `stablecoin apps list --env sandbox --json`
- "Create a Base wallet for treasury"
  - `stablecoin wallets create --chain base --label treasury --json`
- "Check balances across wallets"
  - `stablecoin balances --json`
- "Generate and validate a contract from a spec file"
  - `stablecoin contracts generate --spec @spec.json --json`
  - `stablecoin contracts validate --source @Token.sol --json`
- "Launch a contract on Base Sepolia"
  - `stablecoin contracts launch --spec @spec.json --chain base-sepolia --json`
- "Review approvals in my queue"
  - `stablecoin compliance approvals list --my-queue --json`
- "Create a short-lived sandbox API key"
  - `stablecoin api-keys create --name ci --tier professional --env sandbox --expires-in 30d --json`
