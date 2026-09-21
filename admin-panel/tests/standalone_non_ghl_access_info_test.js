import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(testDirectory, "..");
const workspaceHook = fs.readFileSync(
  path.join(root, "src/standalone-app/useStandaloneWorkspace.js"),
  "utf8"
);
const locationDetailsModal = fs.readFileSync(
  path.join(root, "src/admin/LocationDetailsModal.jsx"),
  "utf8"
);

assert.match(workspaceHook, /function resolveCrmType/);
assert.match(workspaceHook, /effectiveCrmType === 'ghl'\s*\?\s*await loadGhlAccessInfo/);
assert.match(workspaceHook, /shouldLoadGhlAccess.*=== 'ghl'/s);

assert.match(locationDetailsModal, /if \(nextCrmType === "ghl"\)/);
assert.doesNotMatch(locationDetailsModal, /if \(nextCrmType === "chatwoot"\)[\s\S]{0,120}loadGhlAccessInfo/);

console.log("OK: standalone non-GHL views do not eagerly load GHL access info.");
