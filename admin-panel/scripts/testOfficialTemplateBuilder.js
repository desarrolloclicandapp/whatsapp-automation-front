import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const dashboardPath = path.join(root, "src", "admin", "AgencyDashboard.jsx");
const builderPath = path.join(root, "src", "admin", "OfficialTemplateBuilder.jsx");
const esLocalePath = path.join(root, "src", "locales", "es.js");
const enLocalePath = path.join(root, "src", "locales", "en.js");

const dashboard = fs.readFileSync(dashboardPath, "utf8");
const builder = fs.readFileSync(builderPath, "utf8");
const esLocale = fs.readFileSync(esLocalePath, "utf8");
const enLocale = fs.readFileSync(enLocalePath, "utf8");

assert.match(dashboard, /import OfficialTemplateBuilder from '\.\/OfficialTemplateBuilder'/);
assert.match(dashboard, /id="templates"/);
assert.match(dashboard, /dash\.nav\.templates/);
assert.match(dashboard, /activeTab === 'templates'/);
assert.match(dashboard, /<OfficialTemplateBuilder[\s\S]*locations=\{locations\}[\s\S]*token=\{token\}/);

assert.match(builder, /\/agency\/location-details\/\$\{encodeURIComponent\(locationId\)\}/);
assert.match(builder, /\/agency\/whatsapp-official\/templates\?\$\{query\.toString\(\)\}/);
assert.match(builder, /authFetch\("\/agency\/whatsapp-official\/templates"/);
assert.match(builder, /function isOfficialSlot/);
assert.match(builder, /normalizeTemplateName/);
assert.match(builder, /!\[TPL:\$\{name\}:\$\{language\}/);
assert.match(builder, /groupTemplates/);

assert.match(esLocale, /"dash\.nav\.templates": "Generar templates"/);
assert.match(esLocale, /"templates\.builder\.title": "Constructor de templates"/);
assert.match(enLocale, /"dash\.nav\.templates": "Generate templates"/);
assert.match(enLocale, /"templates\.builder\.title": "Template builder"/);

console.log("testOfficialTemplateBuilder passed");
