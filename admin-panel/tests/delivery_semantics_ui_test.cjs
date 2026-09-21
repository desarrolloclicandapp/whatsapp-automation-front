const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const dashboard = fs.readFileSync(
  path.join(__dirname, "..", "src", "admin", "Dashboard.jsx"),
  "utf8"
);

assert.match(dashboard, /queuePending:\s*Number\(hasBreakdown \? delivery\.queuePending : delivery\.pending\)/);
assert.match(dashboard, /qrSummary\.queuePending \?\? qrSummary\.deliveryPending/);
assert.match(dashboard, /Enviados sin confirmación/);
assert.match(dashboard, /Aceptados por servidor/);
assert.match(dashboard, /Confirmación expirada 24h/);
assert.match(dashboard, /fallos explícitos/);
assert.match(dashboard, /numberHealthDeliveryTracking\.complete/);
assert.doesNotMatch(dashboard, /\['Entregas pendientes',\s*qrSummary\.deliveryPending/);

console.log("OK: admin delivery health uses additive semantics with legacy fallbacks.");
