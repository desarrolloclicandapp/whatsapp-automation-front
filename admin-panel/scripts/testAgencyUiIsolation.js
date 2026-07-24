import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const app = read("src/App.jsx");
const legacyDashboard = read("src/admin/AgencyDashboard.jsx");
const nextDashboard = read("src/admin/AgencyDashboardNext.jsx");
const legacyCss = read("src/index.css");
const nextCss = read("src/index.next.css");
const packageJson = read("package.json");
const viteConfig = read("vite.config.js");
const allNextSources = fs
  .readdirSync(path.join(root, "src/admin"))
  .filter((name) => name.endsWith("Next.jsx"))
  .map((name) => read(`src/admin/${name}`))
  .join("\n");

assert.match(app, /import AgencyDashboard from '\.\/admin\/AgencyDashboard';/);
assert.match(app, /import AgencyDashboardNext from '\.\/admin\/AgencyDashboardNext';/);
assert.match(app, /resolveAgencyUiExperience/);

assert.match(legacyDashboard, /className="agency-dashboard-ui /);
assert.doesNotMatch(legacyDashboard, /index\.next\.css|agency-dashboard-ui--redesign/);
assert.match(nextDashboard, /import '\.\.\/index\.next\.css';/);
assert.match(nextDashboard, /className="agency-dashboard-ui--redesign /);
assert.doesNotMatch(nextDashboard, /className="agency-dashboard-ui /);

assert.match(nextCss, /\.agency-dashboard-ui--redesign/);
assert.doesNotMatch(nextCss, /(^|[\s,>])\.agency-dashboard-ui(?=[\s:{.#>])/m);
assert.doesNotMatch(legacyCss, /agency-dashboard-ui--redesign/);

for (const source of [app, allNextSources, packageJson, viteConfig]) {
  assert.doesNotMatch(source, /mockApi|MOCK_TOKEN|dev:mock|build:mock|Cliente Demo|Agencia Demo/);
}

for (const expectedImport of [
  "LocationDetailsModalNext",
  "SubscriptionManagerNext",
  "SupportManagerNext",
  "InteractiveMessageBuilderNext",
  "OfficialTemplateBuilderNext",
  "WorkflowAgentsPanelNext",
  "ThemeToggleNext",
  "LanguageSelectorNext",
]) {
  assert.match(nextDashboard, new RegExp(expectedImport));
}

console.log("testAgencyUiIsolation passed");
