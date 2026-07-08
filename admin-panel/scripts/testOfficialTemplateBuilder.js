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
assert.match(builder, /hasAccessToken: Boolean\(official\.accessToken \|\| official\.accessTokenEncrypted\)/);
assert.match(builder, /templates\.builder\.loading_slots/);
assert.match(builder, /templateLoadError/);
assert.match(builder, /friendlyTemplateError/);
assert.match(builder, /templates\.builder\.access_lost_title/);
assert.match(builder, /templates\.builder\.access_lost_action_clear/);
assert.match(builder, /translate="no"/);
assert.doesNotMatch(builder, /toast\.error\(t\("templates\.builder\.load_templates_error"\)[\s\S]*description: error\.message/, "template load failures must render a stable in-page diagnostic instead of only a toast");
assert.match(builder, /normalizeTemplateName/);
assert.match(builder, /!\[TPL:\$\{name\}:\$\{language\}/);
assert.match(builder, /groupTemplates/);

assert.match(esLocale, /"dash\.nav\.templates": "Generar templates"/);
assert.match(esLocale, /"templates\.builder\.title": "Constructor de templates"/);
assert.match(esLocale, /"templates\.builder\.loading_slots": "Buscando numeros Meta oficiales\.\.\."/);
assert.match(esLocale, /"templates\.builder\.access_lost_title": "La conexion con Meta perdio permisos"/);
assert.match(esLocale, /"templates\.builder\.access_lost_action_clear": "Pulsa Limpiar en la configuracion del numero para quitar la vinculacion anterior\."/);
assert.match(enLocale, /"dash\.nav\.templates": "Generate templates"/);
assert.match(enLocale, /"templates\.builder\.title": "Template builder"/);
assert.match(enLocale, /"templates\.builder\.loading_slots": "Searching official Meta numbers\.\.\."/);
assert.match(enLocale, /"templates\.builder\.access_lost_title": "The Meta connection lost permissions"/);
assert.match(enLocale, /"templates\.builder\.access_lost_action_clear": "Click Clear in the number settings to remove the previous connection\."/);

console.log("testOfficialTemplateBuilder passed");
