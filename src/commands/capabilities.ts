import { readFileSync } from "node:fs";

import {
  GATEWAY_CAPABILITIES,
  bindGatewayTransport,
  getGatewayCapability,
  validateGatewayInput,
  validateGatewayOutput,
  type GatewayCapabilityDefinition,
} from "@stablecoin/gateway-contract";

import { loadConfig, type CLIConfig } from "../config.js";

const CLI_VERSION = "0.2.0";
const DEFAULT_BASE_URL = "https://www.stablecoinroadmap.com";

type FetchLike = typeof globalThis.fetch;

export interface CapabilityCommandDependencies {
  fetch: FetchLike;
  loadConfig: () => CLIConfig;
  readFile: (path: string) => string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  jsonMode: () => boolean;
}

class CapabilityCommandError extends Error {
  readonly code: string;
  readonly exitCode: 1 | 2;
  readonly status?: number;
  readonly details?: unknown;
  readonly traceId?: string;

  constructor(options: {
    code: string;
    message: string;
    exitCode: 1 | 2;
    status?: number;
    details?: unknown;
    traceId?: string;
  }) {
    super(options.message);
    this.name = "CapabilityCommandError";
    this.code = options.code;
    this.exitCode = options.exitCode;
    this.status = options.status;
    this.details = options.details;
    this.traceId = options.traceId;
  }
}

const defaultDependencies: CapabilityCommandDependencies = {
  fetch: globalThis.fetch,
  loadConfig,
  readFile: (path) => readFileSync(path, "utf-8"),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  jsonMode: () => process.env.__SCR_JSON === "1",
};

function writeLine(write: (text: string) => void, value = ""): void {
  write(`${value}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function redact(value: string, secrets: Array<string | undefined>): string {
  let result = value;
  for (const secret of secrets) {
    if (secret) result = result.split(secret).join("[REDACTED]");
  }
  return result;
}

function cliCapabilities(): readonly GatewayCapabilityDefinition[] {
  return GATEWAY_CAPABILITIES.filter((capability) => capability.exposure.cli.enabled);
}

function renderTable(rows: Record<string, string>[]): string {
  if (rows.length === 0) return "(no capabilities)\n";

  const columns = Object.keys(rows[0]);
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => row[column].length))
  );
  const header = columns
    .map((column, index) => column.padEnd(widths[index]))
    .join("  ");
  const divider = widths.map((width) => "-".repeat(width)).join("  ");
  const body = rows.map((row) =>
    columns
      .map((column, index) => row[column].padEnd(widths[index]))
      .join("  ")
  );

  return [header, divider, ...body].join("\n") + "\n";
}

function requireNoArguments(args: string[], usage: string): void {
  if (args.length > 0) {
    throw new CapabilityCommandError({
      code: "INVALID_ARGUMENT",
      message: `Usage: ${usage}`,
      exitCode: 2,
    });
  }
}

function requireCapability(id: string | undefined): GatewayCapabilityDefinition {
  if (!id) {
    throw new CapabilityCommandError({
      code: "MISSING_CAPABILITY_ID",
      message: "A capability ID is required",
      exitCode: 2,
    });
  }

  const capability = getGatewayCapability(id);
  if (!capability || !capability.exposure.cli.enabled) {
    throw new CapabilityCommandError({
      code: "UNKNOWN_CAPABILITY",
      message: `Unknown CLI capability: ${id}`,
      exitCode: 2,
    });
  }
  return capability;
}

function readInput(
  raw: string | undefined,
  dependencies: CapabilityCommandDependencies
): unknown {
  if (raw === undefined) return {};

  let serialized = raw;
  if (raw.startsWith("@")) {
    const path = raw.slice(1);
    if (!path) {
      throw new CapabilityCommandError({
        code: "INVALID_INPUT_FILE",
        message: "The input file path is empty",
        exitCode: 2,
      });
    }
    try {
      serialized = dependencies.readFile(path);
    } catch {
      throw new CapabilityCommandError({
        code: "INPUT_FILE_ERROR",
        message: `Cannot read input file: ${path}`,
        exitCode: 2,
      });
    }
  }

  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    throw new CapabilityCommandError({
      code: "INVALID_JSON",
      message: "Capability input must be a valid JSON value",
      exitCode: 2,
    });
  }
}

function parseInvokeArguments(args: string[]): {
  capability: GatewayCapabilityDefinition;
  input: string | undefined;
} {
  const capability = requireCapability(args[0]);
  let input: string | undefined;

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--input") {
      if (input !== undefined || index + 1 >= args.length) {
        throw new CapabilityCommandError({
          code: "INVALID_ARGUMENT",
          message: "Usage: stablecoin capabilities invoke <id> [--input <json|@file.json>]",
          exitCode: 2,
        });
      }
      input = args[index + 1];
      index += 1;
      continue;
    }

    throw new CapabilityCommandError({
      code: "UNKNOWN_ARGUMENT",
      message: `Unknown argument: ${argument}`,
      exitCode: 2,
    });
  }

  return { capability, input };
}

function appendQuery(url: URL, input: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      url.searchParams.set(key, value.map(String).join(","));
      continue;
    }
    if (["string", "number", "boolean"].includes(typeof value)) {
      url.searchParams.set(key, String(value));
      continue;
    }
    throw new CapabilityCommandError({
      code: "UNSUPPORTED_QUERY_INPUT",
      message: `GET capability input ${key} must be a scalar or array`,
      exitCode: 2,
    });
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "[::1]") return true;

  const octets = normalized.split(".");
  return (
    octets.length === 4 &&
    octets[0] === "127" &&
    octets.every(
      (octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255
    )
  );
}

function resolveCapabilityUrl(
  capability: GatewayCapabilityDefinition,
  input: Record<string, unknown>,
  baseUrl: string | undefined
): URL {
  let configured: URL;
  try {
    configured = new URL(baseUrl ?? DEFAULT_BASE_URL);
  } catch {
    throw new CapabilityCommandError({
      code: "INVALID_BASE_URL",
      message: "STABLECOIN_BASE_URL must be an absolute HTTP or HTTPS URL",
      exitCode: 2,
    });
  }

  if (configured.protocol !== "http:" && configured.protocol !== "https:") {
    throw new CapabilityCommandError({
      code: "INVALID_BASE_URL",
      message: "STABLECOIN_BASE_URL must use HTTP or HTTPS",
      exitCode: 2,
    });
  }

  if (configured.username || configured.password || configured.search || configured.hash) {
    throw new CapabilityCommandError({
      code: "INVALID_BASE_URL",
      message: "STABLECOIN_BASE_URL must not contain credentials, a query, or a fragment",
      exitCode: 2,
    });
  }

  const normalizedPath = configured.pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath !== "/" && normalizedPath.toLowerCase() !== "/api/v1") {
    throw new CapabilityCommandError({
      code: "INVALID_BASE_URL",
      message: "STABLECOIN_BASE_URL must contain only an origin or the legacy /api/v1 path",
      exitCode: 2,
    });
  }

  if (configured.protocol === "http:" && !isLoopbackHostname(configured.hostname)) {
    throw new CapabilityCommandError({
      code: "INVALID_BASE_URL",
      message: "STABLECOIN_BASE_URL must use HTTPS unless it targets loopback",
      exitCode: 2,
    });
  }

  let boundTransport;
  try {
    boundTransport = bindGatewayTransport(capability, input);
  } catch {
    throw new CapabilityCommandError({
      code: "INVALID_CAPABILITY_ROUTE",
      message: "The gateway capability route is not configured correctly",
      exitCode: 1,
    });
  }

  const url = new URL(boundTransport.path, `${configured.origin}/`);
  appendQuery(url, boundTransport.query);
  return url;
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CapabilityCommandError({
      code: "INVALID_RESPONSE",
      message: "The capability endpoint returned invalid JSON",
      exitCode: 1,
      status: response.status,
      traceId: response.headers.get("x-trace-id") ?? undefined,
    });
  }
}

function apiError(response: Response, payload: unknown): CapabilityCommandError {
  const body = isRecord(payload) ? payload : {};
  const nested = isRecord(body.error) ? body.error : {};
  const codeValue = nested.code ?? body.code;
  const messageValue = nested.message ?? body.message;
  const details = nested.details ?? body.details;

  return new CapabilityCommandError({
    code: typeof codeValue === "string" ? codeValue : `HTTP_${response.status}`,
    message:
      typeof messageValue === "string"
        ? messageValue
        : `Capability request failed with HTTP status ${response.status}`,
    exitCode: 1,
    status: response.status,
    details,
    traceId: response.headers.get("x-trace-id") ?? undefined,
  });
}

async function invokeCapability(
  capability: GatewayCapabilityDefinition,
  input: unknown,
  dependencies: CapabilityCommandDependencies
): Promise<unknown> {
  const validation = validateGatewayInput(capability, input);
  if (!validation.valid) {
    throw new CapabilityCommandError({
      code: "INPUT_VALIDATION_ERROR",
      message: "Capability input does not match the shared schema",
      exitCode: 2,
      details: { errors: validation.errors },
    });
  }
  if (!isRecord(input)) {
    throw new CapabilityCommandError({
      code: "INPUT_VALIDATION_ERROR",
      message: "Capability input must be a JSON object",
      exitCode: 2,
    });
  }

  const config = dependencies.loadConfig();
  if (!config.apiKey) {
    throw new CapabilityCommandError({
      code: "MISSING_API_KEY",
      message:
        "No API key configured. Run stablecoin config set-key <your-api-key> or set STABLECOIN_API_KEY.",
      exitCode: 1,
    });
  }

  const url = resolveCapabilityUrl(capability, input, config.baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), capability.transport.timeoutMs);

  let response: Response;
  try {
    response = await dependencies.fetch(url, {
      method: capability.transport.method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "User-Agent": `@stablecoin/cli ${CLI_VERSION}`,
        "X-Agent-Name": "stablecoin-cli",
        "X-Agent-Framework": "cli",
        "X-Agent-Version": CLI_VERSION,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new CapabilityCommandError({
        code: "REQUEST_TIMEOUT",
        message: `Capability request timed out after ${capability.transport.timeoutMs}ms`,
        exitCode: 1,
      });
    }
    throw new CapabilityCommandError({
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "Capability request failed",
      exitCode: 1,
    });
  } finally {
    clearTimeout(timer);
  }

  const payload = await readResponse(response);
  if (!response.ok) throw apiError(response, payload);

  const outputValidation = validateGatewayOutput(capability, payload);
  if (!outputValidation.valid) {
    throw new CapabilityCommandError({
      code: "OUTPUT_VALIDATION_ERROR",
      message: "Capability output does not match the shared schema",
      exitCode: 1,
      status: response.status,
      details: { errors: outputValidation.errors },
      traceId: response.headers.get("x-trace-id") ?? undefined,
    });
  }

  return payload;
}

function renderError(
  error: CapabilityCommandError,
  dependencies: CapabilityCommandDependencies,
  apiKey?: string
): void {
  const safeMessage = redact(error.message, [apiKey]);
  const safeDetails =
    error.details === undefined
      ? undefined
      : JSON.parse(redact(JSON.stringify(error.details), [apiKey]));
  const payload = {
    error: {
      code: error.code,
      message: safeMessage,
      ...(error.status === undefined ? {} : { status: error.status }),
      ...(safeDetails === undefined ? {} : { details: safeDetails }),
      ...(error.traceId === undefined ? {} : { traceId: error.traceId }),
    },
  };

  if (dependencies.jsonMode()) {
    writeLine(dependencies.stderr, JSON.stringify(payload));
    return;
  }

  writeLine(dependencies.stderr, `error: [${error.code}] ${safeMessage}`);
  if (safeDetails !== undefined) {
    writeLine(dependencies.stderr, `details: ${JSON.stringify(safeDetails)}`);
  }
  if (error.traceId) {
    writeLine(dependencies.stderr, `trace: ${error.traceId}`);
  }
}

async function runCommand(
  args: string[],
  dependencies: CapabilityCommandDependencies
): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  if (subcommand === "list") {
    requireNoArguments(rest, "stablecoin capabilities list");
    const capabilities = cliCapabilities();
    if (dependencies.jsonMode()) {
      writeLine(dependencies.stdout, JSON.stringify(capabilities, null, 2));
      return;
    }
    dependencies.stdout(
      renderTable(
        capabilities.map((capability) => ({
          id: capability.id,
          method: capability.transport.method,
          path: capability.transport.path,
          scope: capability.authorization.requiredScope,
          approval: capability.effect.approvalPolicy,
        }))
      )
    );
    return;
  }

  if (subcommand === "describe") {
    const capability = requireCapability(rest[0]);
    requireNoArguments(rest.slice(1), "stablecoin capabilities describe <id>");
    if (dependencies.jsonMode()) {
      writeLine(dependencies.stdout, JSON.stringify(capability, null, 2));
      return;
    }
    writeLine(dependencies.stdout, `${capability.id}: ${capability.title}`);
    writeLine(dependencies.stdout, capability.description);
    writeLine(
      dependencies.stdout,
      `${capability.transport.method} ${capability.transport.path}`
    );
    writeLine(
      dependencies.stdout,
      `Scope: ${capability.authorization.requiredScope}`
    );
    writeLine(
      dependencies.stdout,
      `Effect: ${capability.effect.sideEffectClass}; approval: ${capability.effect.approvalPolicy}`
    );
    writeLine(dependencies.stdout, "Input schema:");
    writeLine(dependencies.stdout, JSON.stringify(capability.inputSchema, null, 2));
    writeLine(dependencies.stdout, "Output schema:");
    writeLine(dependencies.stdout, JSON.stringify(capability.outputSchema, null, 2));
    return;
  }

  if (subcommand === "invoke") {
    const parsed = parseInvokeArguments(rest);
    const input = readInput(parsed.input, dependencies);
    const payload = await invokeCapability(parsed.capability, input, dependencies);
    if (!dependencies.jsonMode()) {
      writeLine(dependencies.stdout, `${parsed.capability.id}: succeeded`);
    }
    writeLine(dependencies.stdout, JSON.stringify(payload, null, 2));
    return;
  }

  throw new CapabilityCommandError({
    code: "UNKNOWN_SUBCOMMAND",
    message: "Usage: stablecoin capabilities <list|describe|invoke>",
    exitCode: 2,
  });
}

export async function runCapabilitiesCommand(
  args: string[],
  overrides: Partial<CapabilityCommandDependencies> = {}
): Promise<number> {
  const dependencies = { ...defaultDependencies, ...overrides };
  try {
    await runCommand(args, dependencies);
    return 0;
  } catch (error) {
    const commandError =
      error instanceof CapabilityCommandError
        ? error
        : new CapabilityCommandError({
            code: "CLI_ERROR",
            message: error instanceof Error ? error.message : "Unexpected CLI error",
            exitCode: 1,
          });
    let apiKey: string | undefined;
    try {
      apiKey = dependencies.loadConfig().apiKey;
    } catch {
      apiKey = undefined;
    }
    renderError(commandError, dependencies, apiKey);
    return commandError.exitCode;
  }
}
