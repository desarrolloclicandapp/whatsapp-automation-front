import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentPath = path.resolve(__dirname, "../src/standalone-app/StandaloneSlotManager.jsx");
const esLocalePath = path.resolve(__dirname, "../src/locales/es.js");
const enLocalePath = path.resolve(__dirname, "../src/locales/en.js");

const component = fs.readFileSync(componentPath, "utf8");
const esLocale = fs.readFileSync(esLocalePath, "utf8");
const enLocale = fs.readFileSync(enLocalePath, "utf8");

assert.match(
  component,
  /embeddedSignupEnabled: embeddedSignup\?\.enabled === true/,
  "Standalone iframe must keep embedded signup config returned by the official Meta config endpoint",
);
assert.match(
  component,
  /function buildStandaloneMetaOauthUrl\(official = \{\}, slotId, locationId\)/,
  "Standalone iframe must build the official Meta OAuth URL for the selected slot",
);
assert.match(
  component,
  /const openOfficialMetaConnection = async \(slotId, slotForMode = null\) => \{/,
  "Standalone iframe must expose a Meta Cloud API launcher",
);
assert.match(
  component,
  /window\.open\('about:blank', 'meta_embedded_signup'/,
  "Standalone Meta launcher must open a popup/tab synchronously before async config loading",
);
assert.match(
  component,
  /popup\.location\.href = oauthUrl\.toString\(\)/,
  "Standalone Meta launcher must navigate the popup/tab to Meta after the config is loaded",
);
assert.match(
  component,
  /setOfficialPopupFallbackBySlot\(\(prev\) => \(\{ \.\.\.prev, \[slotId\]: oauthUrl\.toString\(\) \}\)\)/,
  "Standalone Meta launcher must keep a fallback URL when the popup is blocked",
);
assert.match(
  component,
  /officialPopupFallbackUrl=\{officialPopupFallbackBySlot\[slotId\]\}/,
  "Standalone official panel must receive the fallback URL for manual opening",
);
assert.match(
  component,
  /standalone\.slots\.official\.embedded_cta/,
  "Standalone official panel must render a clear embedded signup CTA",
);
assert.match(
  component,
  /standalone\.slots\.official\.popup_blocked_title/,
  "Standalone official panel must explain when GoHighLevel or the browser blocks the popup",
);
assert.match(esLocale, /"standalone\.slots\.official\.embedded_cta": "Conectar Meta Cloud API"/);
assert.match(esLocale, /"standalone\.slots\.official\.popup_blocked_title": "No se pudo abrir Meta automaticamente"/);
assert.match(enLocale, /"standalone\.slots\.official\.embedded_cta": "Connect Meta Cloud API"/);
assert.match(enLocale, /"standalone\.slots\.official\.popup_blocked_title": "Meta could not open automatically"/);

console.log("testStandaloneMetaIframeConnect passed");
