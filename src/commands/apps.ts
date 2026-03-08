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

export async function appsList(): Promise<void> {
  const client = createClient();
  const result = await client.apps.list();
  out.table(
    (result.apps ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      template: (a.app_templates as any)?.slug ?? "",
      updated: a.updated_at,
    })),
    ["id", "name", "status", "template", "updated"]
  );
}

export async function appsGet(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    out.error("Usage: stablecoin apps get <id>");
    process.exit(1);
  }
  const client = createClient();
  const result = await client.apps.get(id);
  out.json(result.app);
}

export async function appsCreate(args: string[]): Promise<void> {
  const params = parseFlags(args, ["template", "name", "description"]);
  if (!params.name) {
    out.error(
      "Usage: stablecoin apps create --name <name> [--template <slug>] [--description <text>]"
    );
    process.exit(1);
  }
  const client = createClient();
  const result = await client.apps.create({
    name: params.name,
    template_slug: params.template,
    description: params.description,
  });
  out.json(result.app);
}

export async function appsDeploy(args: string[]): Promise<void> {
  const id = args[0];
  const flags = parseFlags(args.slice(1), ["env"]);
  if (!id) {
    out.error(
      "Usage: stablecoin apps deploy <id> [--env sandbox|staging|production]"
    );
    process.exit(1);
  }
  const environment = (flags.env as "sandbox" | "staging" | "production") ?? "sandbox";
  const client = createClient();
  const result = await client.apps.deploy(id, { environment });
  out.json(result);
}

export async function appsDelete(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    out.error("Usage: stablecoin apps delete <id>");
    process.exit(1);
  }
  const client = createClient();
  const result = await client.apps.delete(id);
  console.log(result.message);
}

export async function appsTemplates(): Promise<void> {
  const client = createClient();
  const result = await client.apps.listTemplates();
  out.table(
    (result.templates ?? []).map((t) => ({
      slug: t.slug,
      name: t.name,
      category: t.category ?? "",
    })),
    ["slug", "name", "category"]
  );
}
