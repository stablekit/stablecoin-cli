import assert from "node:assert/strict";
import test from "node:test";

import {
  runCapabilitiesCommand,
  type CapabilityCommandDependencies,
} from "../src/commands/capabilities";

const registryPayload = {
  providers: [],
  categories: [],
  skills: [],
  agentProfiles: [],
  plugins: [],
  provenance: {
    providerCapabilities: "approved_builtin_manifests",
    performance: "not_loaded",
    regimeFit: "not_evaluated",
  },
};

function createHarness(options: {
  json?: boolean;
  fetch?: typeof globalThis.fetch;
  inputFile?: string;
  apiKey?: string;
  baseUrl?: string;
  omitBaseUrl?: boolean;
} = {}) {
  let stdout = "";
  let stderr = "";
  const apiKey = options.apiKey === undefined ? "secret-test-key" : options.apiKey;

  const dependencies: CapabilityCommandDependencies = {
    fetch:
      options.fetch ??
      (async () =>
        new Response(JSON.stringify(registryPayload), {
          status: 200,
          headers: { "content-type": "application/json" },
        })),
    loadConfig: () => ({
      apiKey: apiKey || undefined,
      baseUrl: options.omitBaseUrl
        ? undefined
        : options.baseUrl ?? "https://example.test/api/v1",
      environment: "sandbox",
    }),
    readFile: () => options.inputFile ?? "{}",
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
    jsonMode: () => options.json ?? false,
  };

  return {
    dependencies,
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

test("lists and describes CLI capabilities from the shared registry", async () => {
  const list = createHarness({ json: true });
  assert.equal(
    await runCapabilitiesCommand(["list"], list.dependencies),
    0
  );
  assert.deepEqual(
    (JSON.parse(list.stdout()) as Array<{ id: string }>).map((entry) => entry.id),
    [
      "providers_registry",
      "providers_matching",
      "payments_corridor_workflow_status",
    ]
  );
  assert.equal(list.stderr(), "");

  const describe = createHarness({ json: true });
  assert.equal(
    await runCapabilitiesCommand(
      ["describe", "providers_matching"],
      describe.dependencies
    ),
    0
  );
  const definition = JSON.parse(describe.stdout()) as {
    id: string;
    transport: { method: string; path: string };
  };
  assert.equal(definition.id, "providers_matching");
  assert.deepEqual(definition.transport, {
    method: "GET",
    path: "/api/v2/agent/providers/eligible",
    timeoutMs: 10_000,
  });
});

test("invokes the fixed GET route with bearer auth and preserves raw JSON", async () => {
  let requestUrl = "";
  let authorization = "";
  let requestMethod = "";
  const fetchStub: typeof globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    requestMethod = init?.method ?? "";
    return new Response(JSON.stringify(registryPayload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-trace-id": "trace_cli_1",
      },
    });
  };
  const harness = createHarness({ json: true, fetch: fetchStub });

  const exitCode = await runCapabilitiesCommand(
    [
      "invoke",
      "providers_registry",
      "--input",
      '{"category":"sanctions_screening","environment":"sandbox"}',
    ],
    harness.dependencies
  );

  assert.equal(exitCode, 0);
  assert.equal(requestMethod, "GET");
  assert.equal(authorization, "Bearer secret-test-key");
  assert.equal(
    requestUrl,
    "https://example.test/api/v2/agent/providers/registry?category=sanctions_screening&environment=sandbox"
  );
  assert.deepEqual(JSON.parse(harness.stdout()), registryPayload);
  assert.equal(harness.stderr(), "");
});

test("uses the canonical production origin when no base URL is configured", async () => {
  let requestUrl = "";
  const harness = createHarness({
    json: true,
    omitBaseUrl: true,
    fetch: async (input) => {
      requestUrl = String(input);
      return new Response(JSON.stringify(registryPayload), { status: 200 });
    },
  });

  assert.equal(
    await runCapabilitiesCommand(
      ["invoke", "providers_registry"],
      harness.dependencies
    ),
    0
  );
  assert.equal(
    requestUrl,
    "https://www.stablecoinroadmap.com/api/v2/agent/providers/registry"
  );
});

test("loads invoke input from an @file without adding a bespoke handler", async () => {
  let requestUrl = "";
  const fetchStub: typeof globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return new Response(JSON.stringify(registryPayload), { status: 200 });
  };
  const harness = createHarness({
    json: true,
    fetch: fetchStub,
    inputFile: '{"category":"wallet_custody"}',
  });

  assert.equal(
    await runCapabilitiesCommand(
      ["invoke", "providers_registry", "--input", "@query.json"],
      harness.dependencies
    ),
    0
  );
  assert.equal(
    requestUrl,
    "https://example.test/api/v2/agent/providers/registry?category=wallet_custody"
  );
});

test("invokes provider matching through the same generic path", async () => {
  let requestUrl = "";
  const candidatesPayload = {
    category: "wallet_custody",
    environment: "sandbox",
    candidates: [],
    warnings: ["No matching providers were found."],
    provenance: {
      capability: "approved_builtin_manifest",
      ranking: "observed_scorecard_then_provider_slug",
      regimeFit: "category_and_environment_only",
    },
  };
  const fetchStub: typeof globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return new Response(JSON.stringify(candidatesPayload), { status: 200 });
  };
  const harness = createHarness({ json: true, fetch: fetchStub });

  assert.equal(
    await runCapabilitiesCommand(
      [
        "invoke",
        "providers_matching",
        "--input",
        '{"category":"wallet_custody","environment":"sandbox"}',
      ],
      harness.dependencies
    ),
    0
  );
  assert.equal(
    requestUrl,
    "https://example.test/api/v2/agent/providers/eligible?category=wallet_custody&environment=sandbox"
  );
  assert.deepEqual(JSON.parse(harness.stdout()), candidatesPayload);
});

test("binds the corridor workflow ID into the fixed status route", async () => {
  let requestUrl = "";
  const workflowStatusPayload = {
    run: {
      id: "wf_run_test",
      status: "waiting_for_provider",
      currentStepKey: "get_kyc_status",
      traceId: "trace_test",
      errorCode: null,
      startedAt: "2026-08-13T00:00:00.000Z",
      blockedAt: "2026-08-13T00:00:01.000Z",
      completedAt: null,
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:01.000Z",
    },
    steps: [],
  };
  const fetchStub: typeof globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return new Response(JSON.stringify(workflowStatusPayload), { status: 200 });
  };
  const harness = createHarness({ json: true, fetch: fetchStub });

  assert.equal(
    await runCapabilitiesCommand(
      [
        "invoke",
        "payments_corridor_workflow_status",
        "--input",
        '{"workflowRunId":"wf_run_test"}',
      ],
      harness.dependencies
    ),
    0
  );
  assert.equal(
    requestUrl,
    "https://example.test/api/v2/agent/payments/corridor/workflows/wf_run_test"
  );
  assert.deepEqual(JSON.parse(harness.stdout()), workflowStatusPayload);
});

test("rejects invalid shared input before making a request", async () => {
  let called = false;
  const fetchStub: typeof globalThis.fetch = async () => {
    called = true;
    return new Response("{}");
  };
  const harness = createHarness({ json: true, fetch: fetchStub });

  assert.equal(
    await runCapabilitiesCommand(
      ["invoke", "providers_matching", "--input", "{}"],
      harness.dependencies
    ),
    2
  );
  assert.equal(called, false);
  assert.equal(harness.stdout(), "");
  const error = JSON.parse(harness.stderr()) as {
    error: { code: string; details: { errors: string[] } };
  };
  assert.equal(error.error.code, "INPUT_VALIDATION_ERROR");
  assert.ok(error.error.details.errors.length > 0);
});

test("rejects cleartext remote base URLs before making a request", async () => {
  let called = false;
  const fetchStub: typeof globalThis.fetch = async () => {
    called = true;
    return new Response("{}");
  };
  const harness = createHarness({
    json: true,
    fetch: fetchStub,
    baseUrl: "http://127.example.com",
  });

  assert.equal(
    await runCapabilitiesCommand(
      ["invoke", "providers_registry"],
      harness.dependencies
    ),
    2
  );
  assert.equal(called, false);
  assert.equal(harness.stdout(), "");
  assert.equal(
    (JSON.parse(harness.stderr()) as { error: { code: string } }).error.code,
    "INVALID_BASE_URL"
  );
});

test("rejects credentials and unknown paths in the shared base URL", async () => {
  for (const baseUrl of [
    "https://user:secret@example.test",
    "https://example.test/unexpected-path",
    "https://example.test/api/v1?token=secret",
  ]) {
    let called = false;
    const harness = createHarness({
      json: true,
      baseUrl,
      fetch: async () => {
        called = true;
        return new Response("{}");
      },
    });

    assert.equal(
      await runCapabilitiesCommand(
        ["invoke", "providers_registry"],
        harness.dependencies
      ),
      2
    );
    assert.equal(called, false);
    assert.equal(
      (JSON.parse(harness.stderr()) as { error: { code: string } }).error.code,
      "INVALID_BASE_URL"
    );
  }
});

test("rejects an API response that fails the shared output schema", async () => {
  const fetchStub: typeof globalThis.fetch = async () =>
    new Response("{}", {
      status: 200,
      headers: { "x-trace-id": "trace_bad_output" },
    });
  const harness = createHarness({ json: true, fetch: fetchStub });

  assert.equal(
    await runCapabilitiesCommand(
      ["invoke", "providers_registry"],
      harness.dependencies
    ),
    1
  );
  assert.equal(harness.stdout(), "");
  const error = JSON.parse(harness.stderr()) as {
    error: { code: string; traceId: string };
  };
  assert.equal(error.error.code, "OUTPUT_VALIDATION_ERROR");
  assert.equal(error.error.traceId, "trace_bad_output");
});

test("writes API errors only to stderr and redacts the configured key", async () => {
  const fetchStub: typeof globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "FORBIDDEN",
          message: "Key secret-test-key cannot use providers:read",
        },
      }),
      {
        status: 403,
        headers: { "x-trace-id": "trace_forbidden" },
      }
    );
  const harness = createHarness({ json: true, fetch: fetchStub });

  assert.equal(
    await runCapabilitiesCommand(
      ["invoke", "providers_registry"],
      harness.dependencies
    ),
    1
  );
  assert.equal(harness.stdout(), "");
  assert.equal(harness.stderr().includes("secret-test-key"), false);
  const error = JSON.parse(harness.stderr()) as {
    error: { code: string; message: string; status: number; traceId: string };
  };
  assert.deepEqual(error.error, {
    code: "FORBIDDEN",
    message: "Key [REDACTED] cannot use providers:read",
    status: 403,
    traceId: "trace_forbidden",
  });
});

test("uses exit code 2 for malformed commands and JSON", async () => {
  const unknown = createHarness({ json: true });
  assert.equal(
    await runCapabilitiesCommand(["invoke", "not_real"], unknown.dependencies),
    2
  );
  assert.equal(
    (JSON.parse(unknown.stderr()) as { error: { code: string } }).error.code,
    "UNKNOWN_CAPABILITY"
  );

  const malformed = createHarness({ json: true });
  assert.equal(
    await runCapabilitiesCommand(
      ["invoke", "providers_registry", "--input", "{"],
      malformed.dependencies
    ),
    2
  );
  assert.equal(
    (JSON.parse(malformed.stderr()) as { error: { code: string } }).error.code,
    "INVALID_JSON"
  );
});
