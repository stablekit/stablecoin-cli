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

export async function apiKeysList(args: string[]): Promise<void> {
  const flags = parseFlags(args, ["env"]);
  const client = createClient();
  const result = await client.apiKeys.list(
    flags.env as "sandbox" | "production" | undefined
  );
  out.table(
    (result.apiKeys ?? []).map((k) => ({
      id: k.id,
      name: k.name,
      tier: k.tier,
      env: k.environment,
      active: k.is_active ? "yes" : "no",
      usage: String(k.usage_count),
      last_used: k.last_used_at ?? "never",
    })),
    ["id", "name", "tier", "env", "active", "usage", "last_used"]
  );
}

export async function apiKeysCreate(args: string[]): Promise<void> {
  const params = parseFlags(args, ["name", "tier", "env", "expires-in"]);
  if (!params.name || !params.tier) {
    out.error(
      "Usage: stablecoin api-keys create --name <name> --tier basic|professional|enterprise [--env sandbox|production] [--expires-in 30d|90d|1y]"
    );
    process.exit(1);
  }
  const client = createClient();
  const result = await client.apiKeys.create({
    name: params.name,
    tier: params.tier as "basic" | "professional" | "enterprise",
    environment: params.env as "sandbox" | "production" | undefined,
    expiresIn: params["expires-in"] as "30d" | "90d" | "1y" | undefined,
  });
  out.json(result);
}

export async function apiKeysRevoke(args: string[]): Promise<void> {
  const id = args[0];
  const flags = parseFlags(args.slice(1), ["env"]);
  if (!id) {
    out.error(
      "Usage: stablecoin api-keys revoke <id> [--env sandbox|production]"
    );
    process.exit(1);
  }
  const client = createClient();
  const result = await client.apiKeys.revoke(
    id,
    (flags.env as "sandbox" | "production") ?? "sandbox"
  );
  out.json(result);
}
