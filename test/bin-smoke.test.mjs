import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

function run(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      __SCR_JSON: "",
    },
  });
}

test("built CLI reports the package version", () => {
  const result = run(["--version"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "0.2.0");
  assert.equal(result.stderr, "");
});

test("built CLI discovers gateway capabilities", () => {
  const result = run(["capabilities", "list", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const capabilities = JSON.parse(result.stdout);
  assert.deepEqual(
    capabilities.map((entry) => entry.id),
    [
      "providers_registry",
      "providers_matching",
      "payments_corridor_workflow_status",
    ]
  );
  assert.equal(result.stderr, "");
});
