import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentPath = path.resolve(__dirname, "../src/admin/LocationDetailsModal.jsx");
const source = fs.readFileSync(componentPath, "utf8");

assert.match(source, /function normalizeSlotId\(value\)/, "LocationDetailsModal must normalize slot IDs before comparing keywords");
assert.match(source, /const slotKeywords = keywords\.filter/, "LocationDetailsModal must derive slotKeywords per slot");
assert.match(source, /normalizeSlotId\(keyword\?\.slot_id\) === normalizeSlotId\(slot\.slot_id\)/, "Keyword filtering must compare normalized slot IDs");
assert.match(source, /const slotKeywords = nextSlots\.flatMap/, "loadData must support slot.keywords fallback from the backend");
assert.doesNotMatch(source, /keywords\.filter\(k => k\.slot_id === slot\.slot_id\)/, "Keyword rendering must not use strict raw slot_id comparison");

console.log("testLocationDetailsKeywords passed");
