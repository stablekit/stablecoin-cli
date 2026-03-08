import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".stablecoin");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const LEGACY_CONFIG_DIR = join(homedir(), ".stablecoinroadmap");
const LEGACY_CONFIG_FILE = join(LEGACY_CONFIG_DIR, "config.json");

export interface CLIConfig {
  apiKey?: string;
  environment?: "sandbox" | "production";
  baseUrl?: string;
}

function readConfigFile(path: string): CLIConfig {
  if (!existsSync(path)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CLIConfig;
  } catch {
    return {};
  }
}

export function loadConfig(): CLIConfig {
  // New env vars take precedence, but fall back to legacy names for upgrades.
  const envKey =
    process.env.STABLECOIN_API_KEY ?? process.env.STABLECOINROADMAP_API_KEY;
  const envEnv = (process.env.STABLECOIN_ENV ??
    process.env.STABLECOINROADMAP_ENV) as
    | "sandbox"
    | "production"
    | undefined;
  const fileConfig = existsSync(CONFIG_FILE)
    ? readConfigFile(CONFIG_FILE)
    : readConfigFile(LEGACY_CONFIG_FILE);

  return {
    apiKey: envKey ?? fileConfig.apiKey,
    environment: envEnv ?? fileConfig.environment ?? "sandbox",
    baseUrl:
      process.env.STABLECOIN_BASE_URL ??
      process.env.STABLECOINROADMAP_BASE_URL ??
      fileConfig.baseUrl,
  };
}

export function saveConfig(config: CLIConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

export function requireApiKey(config: CLIConfig): string {
  if (!config.apiKey) {
    console.error(
      "No API key configured. Run:\n\n  stablecoin config set-key <your-api-key>\n\nOr set STABLECOIN_API_KEY environment variable."
    );
    process.exit(1);
  }
  return config.apiKey;
}
