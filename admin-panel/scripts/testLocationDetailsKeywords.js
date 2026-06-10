import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentPath = path.resolve(__dirname, "../src/admin/LocationDetailsModal.jsx");
const source = fs.readFileSync(componentPath, "utf8");

assert.match(source, /function normalizeSlotId\(value\)/, "LocationDetailsModal must normalize slot IDs before comparing keywords");
assert.match(source, /const rawSlotKeywords = Array\.isArray\(slot\?\.effective_keywords\)/, "LocationDetailsModal must prefer effective_keywords from each slot");
assert.match(source, /const slotKeywords = rawSlotKeywords\.filter/, "LocationDetailsModal must derive slotKeywords from normalized effective rows");
assert.match(source, /keywordSlotId === null \|\| keywordSlotId === normalizeSlotId\(slot\.slot_id\)/, "Keyword fallback must include global keyword rules");
assert.match(source, /const slotKeywords = nextSlots\.flatMap/, "loadData must support slot.keywords fallback from the backend");
assert.match(source, /Global/, "Global keyword rules must be visibly distinguished in the slot tab");
assert.doesNotMatch(source, /keywords\.filter\(k => k\.slot_id === slot\.slot_id\)/, "Keyword rendering must not use strict raw slot_id comparison");

console.log("testLocationDetailsKeywords passed");
