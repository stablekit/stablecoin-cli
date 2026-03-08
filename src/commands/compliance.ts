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

export async function complianceApprovalsList(args: string[]): Promise<void> {
  const myQueue = args.includes("--my-queue");
  const flags = parseFlags(args, ["status"]);
  const client = createClient();
  const result = await client.compliance.listApprovals({
    myQueue,
    status: flags.status as
      | "pending"
      | "approved"
      | "rejected"
      | "expired"
      | "cancelled"
      | undefined,
  });
  out.table(
    (result.approvals ?? []).map((a) => ({
      id: a.id,
      chain: String(a.chain_id),
      risk: `${a.risk_score} (${a.risk_level})`,
      status: a.status,
      deadline: a.approval_deadline,
    })),
    ["id", "chain", "risk", "status", "deadline"]
  );
}

export async function complianceApprovalsGet(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    out.error("Usage: stablecoin compliance approvals get <id>");
    process.exit(1);
  }
  const client = createClient();
  const result = await client.compliance.getApproval(id);
  out.json(result.approval);
}

export async function complianceApprovalsCreate(
  args: string[]
): Promise<void> {
  const params = parseFlags(args, [
    "chain",
    "risk-score",
    "risk-level",
    "estimated-cost",
    "required-approvals",
    "deadline-hours",
  ]);
  if (!params.chain || !params["risk-score"]) {
    out.error(
      "Usage: stablecoin compliance approvals create --chain <chain-id> --risk-score <0-100> [--risk-level low|medium|high|critical] [--estimated-cost <amount>] [--required-approvals <n>]"
    );
    process.exit(1);
  }
  const score = Number(params["risk-score"]);
  const derivedLevel =
    (params["risk-level"] as "low" | "medium" | "high" | "critical") ??
    (score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "medium" : "low");

  const client = createClient();
  const result = await client.compliance.createApproval({
    organizationId: "",
    chainId: Number(params.chain),
    riskScore: score,
    riskLevel: derivedLevel,
    estimatedCost: params["estimated-cost"] ?? "0",
    requiredApprovals: params["required-approvals"]
      ? Number(params["required-approvals"])
      : 1,
    approvalDeadlineHours: params["deadline-hours"]
      ? Number(params["deadline-hours"])
      : undefined,
  });
  out.json(result.approval);
}

export async function complianceApprovalsDecide(
  args: string[]
): Promise<void> {
  const id = args[0];
  const flags = parseFlags(args.slice(1), ["action", "comment", "conditions"]);
  if (!id || !flags.action) {
    out.error(
      "Usage: stablecoin compliance approvals decide <id> --action approve|approve_conditional|reject [--comment <text>]"
    );
    process.exit(1);
  }
  const client = createClient();
  const result = await client.compliance.decideApproval(id, {
    decision: flags.action as "approve" | "approve_conditional" | "reject",
    comment: flags.comment,
    conditions: flags.conditions ? flags.conditions.split(",") : undefined,
  });
  out.json(result);
}

export async function complianceLicensesList(args: string[]): Promise<void> {
  const flags = parseFlags(args, ["status"]);
  const client = createClient();
  const result = await client.compliance.listLicenses({
    status: flags.status,
  });
  out.table(
    (result.data ?? []).map((l) => ({
      id: l.id,
      jurisdiction: l.jurisdictionCode,
      type: l.licenseType,
      status: l.status,
      expires: l.expiryDate ?? "—",
      next_renewal: l.nextRenewalDate ?? "—",
    })),
    ["id", "jurisdiction", "type", "status", "expires", "next_renewal"]
  );
}
