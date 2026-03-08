import { Stablecoin, StablecoinError } from "@stablecoin/sdk";
import { loadConfig, saveConfig, requireApiKey } from "./config.js";
import * as out from "./output.js";

function createClient() {
  const config = loadConfig();
  const apiKey = requireApiKey(config);
  return new Stablecoin({
    apiKey,
    environment: config.environment ?? "sandbox",
    baseUrl: config.baseUrl,
  });
}

// ── Config commands ──

export async function configSetKey(args: string[]): Promise<void> {
  const key = args[0];
  if (!key) {
    out.error("Usage: stablecoin config set-key <api-key>");
    process.exit(1);
  }
  const config = loadConfig();
  config.apiKey = key;
  saveConfig(config);
  console.log("API key saved to ~/.stablecoin/config.json");
}

export async function configSetEnv(args: string[]): Promise<void> {
  const env = args[0];
  if (env !== "sandbox" && env !== "production") {
    out.error("Usage: stablecoin config set-env <sandbox|production>");
    process.exit(1);
  }
  const config = loadConfig();
  config.environment = env;
  saveConfig(config);
  console.log(`Environment set to ${env}`);
}

export async function configShow(): Promise<void> {
  const config = loadConfig();
  out.json({
    apiKey: config.apiKey ? `${config.apiKey.slice(0, 8)}...` : "(not set)",
    environment: config.environment ?? "sandbox",
    baseUrl: config.baseUrl ?? "(default)",
  });
}

// ── Payment commands ──

export async function paymentCreate(args: string[]): Promise<void> {
  // stablecoin payments create --amount 100 --stablecoin USDC --to 0x... --chain base
  const params = parseFlags(args, [
    "amount",
    "stablecoin",
    "to",
    "chain",
  ]);

  if (!params.amount || !params.stablecoin || !params.to || !params.chain) {
    out.error(
      "Usage: stablecoin payments create --amount <amount> --stablecoin <USDC|USDT|DAI> --to <address> --chain <chain>"
    );
    process.exit(1);
  }

  const client = createClient();
  const payment = await client.payments.create({
    amount: params.amount,
    stablecoin: params.stablecoin as "USDC" | "USDT" | "DAI",
    toAddress: params.to,
    chain: params.chain,
  });

  out.json(payment);
}

export async function paymentGet(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    out.error("Usage: stablecoin payments get <payment-id>");
    process.exit(1);
  }
  const client = createClient();
  const payment = await client.payments.get(id);
  out.json(payment);
}

export async function paymentList(): Promise<void> {
  const client = createClient();
  const result = await client.payments.list();
  out.table(
    result.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      stablecoin: p.stablecoin,
      status: p.status,
      chain: p.chain,
      created: p.createdAt,
    })),
    ["id", "amount", "stablecoin", "status", "chain", "created"]
  );
}

// ── Wallet commands ──

export async function walletCreate(args: string[]): Promise<void> {
  const params = parseFlags(args, ["chain", "label"]);
  if (!params.chain) {
    out.error(
      "Usage: stablecoin wallets create --chain <ethereum|polygon|base|solana> [--label <name>]"
    );
    process.exit(1);
  }
  const client = createClient();
  const wallet = await client.wallets.create({
    chain: params.chain as "ethereum" | "polygon" | "base" | "solana",
    label: params.label,
  });
  out.json(wallet);
}

export async function walletGet(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    out.error("Usage: stablecoin wallets get <wallet-id>");
    process.exit(1);
  }
  const client = createClient();
  const wallet = await client.wallets.get(id);
  out.json(wallet);
}

export async function walletList(): Promise<void> {
  const client = createClient();
  const result = await client.wallets.list();
  out.table(
    result.wallets.map((w) => ({
      id: w.id,
      address: w.address,
      chain: w.chain,
      label: w.label ?? "",
      created: w.createdAt,
    })),
    ["id", "address", "chain", "label", "created"]
  );
}

export async function walletBalances(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    out.error("Usage: stablecoin wallets balances <wallet-id>");
    process.exit(1);
  }
  const client = createClient();
  const result = await client.wallets.balances(id);
  out.table(
    result.balances.map((b) => ({
      stablecoin: b.stablecoin,
      balance: b.balance,
      usd: b.balanceUSD,
    })),
    ["stablecoin", "balance", "usd"]
  );
  console.log(`\nTotal: $${result.totalUSD}`);
}

// ── Balance commands ──

export async function balanceList(): Promise<void> {
  const client = createClient();
  const result = await client.balances.getAll();
  out.table(
    result.balances.map((b) => ({
      wallet: b.walletId,
      chain: b.chain,
      stablecoin: b.stablecoin,
      balance: b.balance,
      usd: b.balanceUSD,
    })),
    ["wallet", "chain", "stablecoin", "balance", "usd"]
  );
  console.log(`\nTotal: $${result.totalUSD}`);
}

// ── Helpers ──

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

export async function handleError(err: unknown): Promise<void> {
  if (err instanceof StablecoinError) {
    out.error(`[${err.status}] ${err.message}`);
    if (err.code) console.error(`  code: ${err.code}`);
  } else if (err instanceof Error) {
    out.error(err.message);
  } else {
    out.error(String(err));
  }
  process.exit(1);
}
