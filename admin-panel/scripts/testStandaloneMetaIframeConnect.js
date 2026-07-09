import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentPath = path.resolve(__dirname, "../src/standalone-app/StandaloneSlotManager.jsx");
const locationDetailsPath = path.resolve(__dirname, "../src/admin/LocationDetailsModal.jsx");
const esLocalePath = path.resolve(__dirname, "../src/locales/es.js");
const enLocalePath = path.resolve(__dirname, "../src/locales/en.js");

const component = fs.readFileSync(componentPath, "utf8");
const locationDetails = fs.readFileSync(locationDetailsPath, "utf8");
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
  /officialEmbeddedLink\?\.url \|\| officialEmbeddedLink\?\.loading/,
  "Standalone QR connection card must reserve a visible Meta CTA even before the OAuth link finishes loading",
);
assert.match(
  component,
  /standalone\.slots\.official\.qr_card_cta/,
  "Standalone QR connection card must render a Meta Cloud API CTA next to QR actions",
);
assert.match(
  component,
  /standalone\.slots\.official\.open_in_new_tab/,
  "Standalone official panel must explain that Meta opens in a new tab",
);
assert.match(
  component,
  /function formatPhoneForDisplay\(value\)/,
  "Standalone iframe must format phone numbers through a helper to avoid duplicated plus signs",
);
assert.doesNotMatch(
  component,
  /\+\$\{slot\.phone_number|\+\$\{status\.myNumber|\+\$\{qrData\.myNumber/,
  "Standalone iframe must not prepend '+' directly to phone values that may already include a plus sign",
);
assert.match(
  locationDetails,
  /onConnectOfficial=\{\(\) => startOfficialEmbeddedSignup\(slot\.slot_id\)\}/,
  "GoHighLevel iframe slot card must pass the Meta connect action into the QR connection card",
);
assert.match(
  locationDetails,
  /officialEmbeddedEnabled=\{\(officialConfigBySlot\[slot\.slot_id\] \|\| createEmptyOfficialWhatsappState\(\)\)\.embeddedSignupEnabled === true\}/,
  "GoHighLevel iframe slot card must expose whether Meta Embedded Signup is enabled",
);
assert.match(
  locationDetails,
  /slots\.official\.qr_card_cta/,
  "GoHighLevel iframe QR connection card must render a visible Meta Cloud API CTA",
);
assert.match(
  locationDetails,
  /disabled=\{!officialEmbeddedEnabled \|\| officialEmbeddedLoading \|\| officialEmbeddedStarting \|\| typeof onConnectOfficial !== 'function'\}/,
  "GoHighLevel iframe Meta CTA must only be disabled when Embedded Signup is unavailable or an operation is running",
);
assert.match(esLocale, /"standalone\.slots\.official\.embedded_cta": "Conectar Meta Cloud API"/);
assert.match(esLocale, /"standalone\.slots\.official\.qr_card_cta": "API Meta Cloud"/);
assert.match(esLocale, /"standalone\.slots\.official\.open_in_new_tab": "Se abrira Meta en una nueva pestana segura\."/);
assert.match(enLocale, /"standalone\.slots\.official\.embedded_cta": "Connect Meta Cloud API"/);
assert.match(enLocale, /"standalone\.slots\.official\.qr_card_cta": "Meta Cloud API"/);
assert.match(enLocale, /"standalone\.slots\.official\.open_in_new_tab": "Meta will open in a secure new tab\."/);

console.log("testStandaloneMetaIframeConnect passed");
