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

export async function projectsList(): Promise<void> {
  const client = createClient();
  const result = await client.projects.list();
  out.table(
    (result.projects ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      public: p.is_public ? "yes" : "no",
      updated: p.updated_at,
    })),
    ["id", "name", "public", "updated"]
  );
}

export async function projectsGet(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    out.error("Usage: stablecoin projects get <id>");
    process.exit(1);
  }
  const client = createClient();
  const result = await client.projects.get(id);
  out.json(result.project);
}

export async function projectsCreate(args: string[]): Promise<void> {
  const params = parseFlags(args, ["name", "description"]);
  if (!params.name) {
    out.error(
      "Usage: stablecoin projects create --name <name> [--description <text>]"
    );
    process.exit(1);
  }
  const client = createClient();
  const result = await client.projects.create({
    name: params.name,
    description: params.description,
  });
  out.json(result.project);
}

export async function projectsDelete(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    out.error("Usage: stablecoin projects delete <id>");
    process.exit(1);
  }
  const client = createClient();
  const result = await client.projects.delete(id);
  console.log(result.message);
}

export async function projectsDeploymentsList(args: string[]): Promise<void> {
  const projectId = args[0];
  if (!projectId) {
    out.error("Usage: stablecoin projects deployments list <project-id>");
    process.exit(1);
  }
  const client = createClient();
  const result = await client.projects.listDeployments(projectId);
  out.table(
    (result.deployments ?? []).map((d) => ({
      id: d.id,
      chain: d.chain,
      env: d.environment,
      status: d.status,
      address: d.contract_address ?? "",
      created: d.created_at,
    })),
    ["id", "chain", "env", "status", "address", "created"]
  );
}
