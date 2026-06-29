const fs = require("node:fs");
const path = require("node:path");

const exposedKeys = [
  "VITE_OFFICIAL_WHATSAPP_API_UI_ENABLED",
  "VITE_OFFICIAL_WHATSAPP_API_ADMIN_BYPASS_ENABLED"
];

const config = {};
for (const key of exposedKeys) {
  if (process.env[key] !== undefined) {
    config[key] = process.env[key];
  }
}

const outputPath = path.resolve(__dirname, "../dist/runtime-config.js");
fs.writeFileSync(
  outputPath,
  `window.__WAFLOW_ADMIN_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`,
  "utf8"
);
