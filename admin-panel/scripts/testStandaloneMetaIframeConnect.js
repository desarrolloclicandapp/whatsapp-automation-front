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
  /const prepareOfficialMetaConnection = \(slotId, embeddedLink\) => \{/,
  "Standalone iframe must prepare the Meta callback state synchronously from the direct link click",
);
assert.match(
  component,
  /officialEmbeddedLinkBySlot/,
  "Standalone iframe must preload and store the direct Meta OAuth link per slot",
);
assert.match(
  component,
  /href=\{officialEmbeddedUrl\}/,
  "Standalone Meta CTA must be a real href so the browser opens it as a direct user action",
);
assert.match(
  component,
  /target="_blank"/,
  "Standalone Meta CTA must open Meta in a new tab instead of replacing the GoHighLevel iframe",
);
assert.match(
  component,
  /onPrepareEmbedded=\{\(\) => prepareOfficialMetaConnection\(slotId, officialEmbeddedLinkBySlot\[slotId\]\)\}/,
  "Standalone official panel must prepare the callback flow immediately when the direct link is clicked",
);
assert.doesNotMatch(
  component,
  /window\.open\('about:blank', 'meta_embedded_signup'/,
  "Standalone Meta CTA must not depend on popup scripting that GoHighLevel can block",
);
assert.match(
  component,
  /standalone\.slots\.official\.embedded_cta/,
  "Standalone official panel must render a clear embedded signup CTA",
);
assert.match(
  component,
  /standalone\.slots\.official\.open_in_new_tab/,
  "Standalone official panel must explain that Meta opens in a new tab",
);
assert.match(esLocale, /"standalone\.slots\.official\.embedded_cta": "Conectar Meta Cloud API"/);
assert.match(esLocale, /"standalone\.slots\.official\.open_in_new_tab": "Se abrira Meta en una nueva pestana segura\."/);
assert.match(enLocale, /"standalone\.slots\.official\.embedded_cta": "Connect Meta Cloud API"/);
assert.match(enLocale, /"standalone\.slots\.official\.open_in_new_tab": "Meta will open in a secure new tab\."/);

console.log("testStandaloneMetaIframeConnect passed");
