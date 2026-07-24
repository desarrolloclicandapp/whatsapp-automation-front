import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(
  new URL("../src/admin/AgencyDashboard.jsx", import.meta.url),
  "utf8"
);
const runtimeConfig = readFileSync(
  new URL("./writeRuntimeConfig.cjs", import.meta.url),
  "utf8"
);
const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

const requiredTabs = [
  "overview",
  "billing",
  "reliability",
  "agents",
  "settings",
  "builder",
  "templates",
  "my-templates"
];

const requiredEndpoints = [
  "/agency/info",
  "/agency/locations",
  "/agency/reliability/overview",
  "/agency/my-suspension-status",
  "/agency/sync-ghl",
  "/agency/webhooks",
  "/agency/api-keys",
  "/agency/openai-eligible-accounts",
  "/reachout/verify"
];

for (const tab of requiredTabs) {
  assert.match(
    dashboard,
    new RegExp(`(?:id=["']${tab}["']|activeTab === ["']${tab}["'])`),
    `The canary must preserve the ${tab} workspace`
  );
}

for (const endpoint of requiredEndpoints) {
  assert.ok(
    dashboard.includes(endpoint),
    `The canary must preserve the ${endpoint} contract`
  );
}

assert.ok(
  runtimeConfig.includes("VITE_AGENCY_UI_V2_ENABLED") &&
    runtimeConfig.includes("VITE_AGENCY_UI_V2_ALLOWLIST"),
  "The emergency switch and exact allowlist must be available at runtime"
);
assert.ok(
  !main.includes("mockApi") && !main.includes("/mocks/"),
  "Production startup must never install the mock transport"
);
assert.ok(
  !dashboard.includes("mockApi") && !dashboard.includes("mock:true"),
  "The production dashboard must never depend on mock responses"
);

console.log("agency_ui_canary_contracts_test passed");
