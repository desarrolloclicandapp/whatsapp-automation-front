import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentPath = path.resolve(__dirname, "../src/admin/LocationDetailsModal.jsx");
const esLocalePath = path.resolve(__dirname, "../src/locales/es.js");
const enLocalePath = path.resolve(__dirname, "../src/locales/en.js");

const component = fs.readFileSync(componentPath, "utf8");
const esLocale = fs.readFileSync(esLocalePath, "utf8");
const enLocale = fs.readFileSync(enLocalePath, "utf8");

assert.match(
    component,
    /const hasAnyOfficialWhatsappConfig = \(\) => slots\.some\(\(slot\) => hasOfficialWhatsappConfig\(slot\)\)/,
    "LocationDetailsModal must detect whether the account already has an official Meta number configured"
);
assert.match(
    component,
    /const officialApiAvailable = OFFICIAL_WHATSAPP_API_UI_ENABLED && hasAnyOfficialWhatsappConfig\(\)/,
    "The official API option must only be available when the tenant already has an official Meta config"
);
assert.match(
    component,
    /disabled=\{!officialApiAvailable\}/,
    "The official API selector card must be disabled for tenants without official Meta numbers"
);
assert.match(
    component,
    /if \(!officialApiAvailable\) return;\s*selectSlotConnectionMode\(slot, 'official_api'\)/,
    "The official API click handler must not select official_api while disabled"
);
assert.doesNotMatch(
    component,
    /slots\.connection_mode\.official_badge'\) \|\| 'Beta'/,
    "The official API badge fallback must not continue showing Beta"
);
assert.match(esLocale, /"slots\.connection_mode\.official_badge": "En desarrollo"/);
assert.match(enLocale, /"slots\.connection_mode\.official_badge": "In development"/);
assert.match(esLocale, /"slots\.connection_mode\.official_disabled_desc"/);
assert.match(enLocale, /"slots\.connection_mode\.official_disabled_desc"/);

console.log("testOfficialConnectionGate passed");
