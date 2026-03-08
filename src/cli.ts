import {
  configSetKey,
  configSetEnv,
  configShow,
  paymentCreate,
  paymentGet,
  paymentList,
  walletCreate,
  walletGet,
  walletList,
  walletBalances,
  balanceList,
  handleError,
} from "./commands.js";
import {
  appsList,
  appsGet,
  appsCreate,
  appsDeploy,
  appsDelete,
  appsTemplates,
} from "./commands/apps.js";
import {
  projectsList,
  projectsGet,
  projectsCreate,
  projectsDelete,
  projectsDeploymentsList,
} from "./commands/projects.js";
import {
  contractsGenerate,
  contractsValidate,
  contractsCompile,
  contractsSimulate,
  contractsDeploy,
  contractsLaunch,
  contractsVerify,
} from "./commands/contracts.js";
import {
  complianceApprovalsList,
  complianceApprovalsGet,
  complianceApprovalsCreate,
  complianceApprovalsDecide,
  complianceLicensesList,
} from "./commands/compliance.js";
import {
  apiKeysList,
  apiKeysCreate,
  apiKeysRevoke,
} from "./commands/api-keys.js";

const VERSION = "0.1.2";

const HELP = `
stablecoin v${VERSION}

Usage: stablecoin <command> [subcommand] [options]

Global flags:
  --json                       Output raw JSON instead of tables
  --env sandbox|production     Override configured environment
  --api-key <key>              Override configured API key

Commands:
  config set-key <key>         Save your API key
  config set-env <env>         Set environment (sandbox|production)
  config show                  Show current configuration

  payments create              Create a payment
    --amount <amount>
    --stablecoin <USDC|USDT|DAI>
    --to <address>
    --chain <chain>
  payments get <id>            Get payment details
  payments list                List all payments

  wallets create               Create a wallet
    --chain <ethereum|polygon|base|solana>
    --label <name>
  wallets get <id>             Get wallet details
  wallets list                 List all wallets
  wallets balances <id>        Get wallet balances

  balances                     Show all balances across wallets

  apps list                    List your apps
  apps get <id>                Show app detail
  apps create                  Create app from template
    --name <name>
    --template <slug>
  apps deploy <id>             Deploy an app
    --env sandbox|staging|production
  apps delete <id>             Delete an app
  apps templates               List available templates

  projects list                List your projects
  projects get <id>            Show project detail
  projects create              Create a project
    --name <name>
    --description <text>
  projects delete <id>         Delete a project
  projects deployments list <project-id>

  contracts generate           Generate Solidity from spec
    --spec <json|@file.json>
    --style minimal|production|auditable
  contracts validate           Security + compliance check
    --source <solidity|@file.sol>
  contracts compile            Compile to ABI + bytecode
    --source <solidity|@file.sol>
  contracts simulate           EVM dry-run
    --source <solidity|@file.sol>
  contracts deploy             Deploy compiled contract
    --abi <json|@file.json>
    --bytecode <hex>
  contracts launch             generate+validate+compile+deploy in one
    --spec <json|@file.json>
  contracts verify             Verify on-chain contract
    --address <0x...>
    --chain <base|base-sepolia>
    --source <solidity|@file.sol>
    --contract-name <name>

  compliance approvals list    List deployment approvals
    --my-queue                 Only show approvals in your queue
    --status pending|approved|rejected
  compliance approvals get <id>
  compliance approvals create
    --chain <chain-id>
    --risk-score <0-100>
  compliance approvals decide <id>
    --action approve|approve_conditional|reject
    --comment <text>
  compliance licenses list
    --status active|expiring

  api-keys list                List API keys
    --env sandbox|production
  api-keys create              Create an API key
    --name <name>
    --tier basic|professional|enterprise
    --env sandbox|production
  api-keys revoke <id>         Revoke an API key

Environment variables:
  STABLECOIN_API_KEY    API key (overrides config file)
  STABLECOIN_ENV        Environment (sandbox|production)
  STABLECOIN_BASE_URL   Override API base URL
`.trim();

/** Extract and consume global flags from argv, returning the filtered args */
function extractGlobalFlags(args: string[]): string[] {
  const filtered: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") {
      process.env.__SCR_JSON = "1";
    } else if (arg === "--env" && i + 1 < args.length) {
      process.env.STABLECOIN_ENV = args[++i];
    } else if (arg === "--api-key" && i + 1 < args.length) {
      process.env.STABLECOIN_API_KEY = args[++i];
    } else {
      filtered.push(arg);
    }
  }
  return filtered;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const args = extractGlobalFlags(rawArgs);

  const command = args[0];
  const subcommand = args[1];
  const rest = args.slice(2);

  try {
    switch (command) {
      case "config":
        switch (subcommand) {
          case "set-key":
            return configSetKey(rest);
          case "set-env":
            return configSetEnv(rest);
          case "show":
            return configShow();
          default:
            console.log(HELP);
            return;
        }

      case "payments":
        switch (subcommand) {
          case "create":
            return paymentCreate(rest);
          case "get":
            return paymentGet(rest);
          case "list":
            return paymentList();
          default:
            console.log(HELP);
            return;
        }

      case "wallets":
        switch (subcommand) {
          case "create":
            return walletCreate(rest);
          case "get":
            return walletGet(rest);
          case "list":
            return walletList();
          case "balances":
            return walletBalances(rest);
          default:
            console.log(HELP);
            return;
        }

      case "balances":
        return balanceList();

      case "apps":
        switch (subcommand) {
          case "list":
            return appsList();
          case "get":
            return appsGet(rest);
          case "create":
            return appsCreate(rest);
          case "deploy":
            return appsDeploy(rest);
          case "delete":
            return appsDelete(rest);
          case "templates":
            return appsTemplates();
          default:
            console.log(HELP);
            return;
        }

      case "projects":
        if (subcommand === "deployments") {
          const sub2 = args[2];
          const rest2 = args.slice(3);
          if (sub2 === "list") return projectsDeploymentsList(rest2);
          console.log(HELP);
          return;
        }
        switch (subcommand) {
          case "list":
            return projectsList();
          case "get":
            return projectsGet(rest);
          case "create":
            return projectsCreate(rest);
          case "delete":
            return projectsDelete(rest);
          default:
            console.log(HELP);
            return;
        }

      case "contracts":
        switch (subcommand) {
          case "generate":
            return contractsGenerate(rest);
          case "validate":
            return contractsValidate(rest);
          case "compile":
            return contractsCompile(rest);
          case "simulate":
            return contractsSimulate(rest);
          case "deploy":
            return contractsDeploy(rest);
          case "launch":
            return contractsLaunch(rest);
          case "verify":
            return contractsVerify(rest);
          default:
            console.log(HELP);
            return;
        }

      case "compliance":
        switch (subcommand) {
          case "approvals": {
            const sub2 = args[2];
            const rest2 = args.slice(3);
            switch (sub2) {
              case "list":
                return complianceApprovalsList(rest2);
              case "get":
                return complianceApprovalsGet(rest2);
              case "create":
                return complianceApprovalsCreate(rest2);
              case "decide":
                return complianceApprovalsDecide(rest2);
              default:
                console.log(HELP);
                return;
            }
          }
          case "licenses": {
            const sub2 = args[2];
            const rest2 = args.slice(3);
            if (sub2 === "list") return complianceLicensesList(rest2);
            console.log(HELP);
            return;
          }
          default:
            console.log(HELP);
            return;
        }

      case "api-keys":
        switch (subcommand) {
          case "list":
            return apiKeysList(rest);
          case "create":
            return apiKeysCreate(rest);
          case "revoke":
            return apiKeysRevoke(rest);
          default:
            console.log(HELP);
            return;
        }

      case "--version":
      case "-v":
        console.log(VERSION);
        return;

      case "--help":
      case "-h":
      case undefined:
        console.log(HELP);
        return;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (err) {
    await handleError(err);
  }
}

main();
