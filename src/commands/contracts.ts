import { readFileSync } from "node:fs";
import { Stablecoin } from "@stablecoin/sdk";
import { loadConfig, requireApiKey } from "../config.js";
import * as out from "../output.js";

function createClient() {
  const config = loadConfig();
  const apiKey = requireApiKey(config);
  return new Stablecoin({
    apiKey,
    environment: config.environment ?? "sandbox",
    baseUrl: config.baseUrl,
  });
}

function parseFlags(
  args: string[],
  keys: string[]
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (keys.includes(key) && i + 1 < args.length) {
        result[key] = args[++i];
      }
    }
  }
  return result;
}

/** Read a value: if it starts with @, treat the rest as a file path */
function readValue(value: string): string {
  if (value.startsWith("@")) {
    return readFileSync(value.slice(1), "utf-8");
  }
  return value;
}

export async function contractsGenerate(args: string[]): Promise<void> {
  const params = parseFlags(args, ["spec", "style"]);
  if (!params.spec) {
    out.error(
      "Usage: stablecoin contracts generate --spec <json|@file.json> [--style minimal|production|auditable]"
    );
    process.exit(1);
  }
  const spec = JSON.parse(readValue(params.spec));
  const client = createClient();
  const result = await client.agent.generateContract({
    spec,
    style: params.style as "minimal" | "production" | "auditable" | undefined,
  });
  out.json(result);
}

export async function contractsValidate(args: string[]): Promise<void> {
  const params = parseFlags(args, ["source", "contract-name", "min-score"]);
  if (!params.source) {
    out.error(
      "Usage: stablecoin contracts validate --source <solidity|@file.sol> [--contract-name <name>] [--min-score <0-100>]"
    );
    process.exit(1);
  }
  const source = readValue(params.source);
  const client = createClient();
  const result = await client.agent.validateContract({
    source,
    contractName: params["contract-name"],
    minimumSecurityScore: params["min-score"]
      ? Number(params["min-score"])
      : undefined,
  });
  out.json(result);
}

export async function contractsCompile(args: string[]): Promise<void> {
  const params = parseFlags(args, [
    "source",
    "contract-name",
    "compiler",
    "optimizer-runs",
  ]);
  if (!params.source) {
    out.error(
      "Usage: stablecoin contracts compile --source <solidity|@file.sol> [--contract-name <name>]"
    );
    process.exit(1);
  }
  const source = readValue(params.source);
  const client = createClient();
  const result = await client.agent.compileContract({
    source,
    contractName: params["contract-name"],
    compilerVersion: params.compiler,
    optimizerRuns: params["optimizer-runs"]
      ? Number(params["optimizer-runs"])
      : undefined,
  });
  out.json(result);
}

export async function contractsSimulate(args: string[]): Promise<void> {
  const params = parseFlags(args, ["source", "contract-name", "chain"]);
  if (!params.source) {
    out.error(
      "Usage: stablecoin contracts simulate --source <solidity|@file.sol> [--chain base|base-sepolia]"
    );
    process.exit(1);
  }
  const source = readValue(params.source);
  const client = createClient();
  const result = await client.agent.simulateContract({
    source,
    contractName: params["contract-name"],
    chain: params.chain as "base" | "base-sepolia" | undefined,
  });
  out.json(result);
}

export async function contractsDeploy(args: string[]): Promise<void> {
  const params = parseFlags(args, ["abi", "bytecode", "chain"]);
  if (!params.abi || !params.bytecode) {
    out.error(
      "Usage: stablecoin contracts deploy --abi <json|@file.json> --bytecode <hex> [--chain base|base-sepolia]"
    );
    process.exit(1);
  }
  const abi = JSON.parse(readValue(params.abi));
  const client = createClient();
  const result = await client.agent.deployContract({
    abi,
    bytecode: params.bytecode,
    chain: params.chain as "base" | "base-sepolia" | undefined,
    useServerKey: true,
  });
  out.json(result);
}

export async function contractsLaunch(args: string[]): Promise<void> {
  const params = parseFlags(args, ["spec", "style", "chain", "deploy"]);
  if (!params.spec) {
    out.error(
      "Usage: stablecoin contracts launch --spec <json|@file.json> [--style minimal|production|auditable] [--chain base|base-sepolia]"
    );
    process.exit(1);
  }
  const spec = JSON.parse(readValue(params.spec));
  const client = createClient();
  const result = await client.agent.launchContract({
    spec,
    style: params.style as "minimal" | "production" | "auditable" | undefined,
    chain: params.chain as "base" | "base-sepolia" | undefined,
    deploy: params.deploy !== "false",
    useServerKey: true,
  });
  out.json(result);
}

export async function contractsVerify(args: string[]): Promise<void> {
  const params = parseFlags(args, [
    "address",
    "chain",
    "source",
    "contract-name",
  ]);
  if (!params.address || !params.chain || !params.source) {
    out.error(
      "Usage: stablecoin contracts verify --address <0x...> --chain <base|base-sepolia> --source <solidity|@file.sol> --contract-name <name>"
    );
    process.exit(1);
  }
  const source = readValue(params.source);
  const client = createClient();
  const result = await client.agent.verifyContract({
    contractAddress: params.address,
    chain: params.chain as "base" | "base-sepolia",
    source,
    contractName: params["contract-name"] ?? "StablecoinToken",
  });
  out.json(result);
}
