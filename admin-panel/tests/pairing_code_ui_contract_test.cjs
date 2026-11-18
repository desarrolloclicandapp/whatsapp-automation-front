const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const panel = fs.readFileSync(path.join(root, 'src', 'components', 'PairingCodePanel.jsx'), 'utf8');
const requestHelper = fs.readFileSync(path.join(root, 'src', 'utils', 'requestPairingCode.js'), 'utf8');

assert.match(panel, /import AuthPhoneInput from '\.\/AuthPhoneInput'/);
assert.match(panel, /export const PAIRING_CODE_UI_ENABLED = true/, 'visible to everyone, iframe included (18-11)');
assert.match(panel, /if \(!PAIRING_CODE_UI_ENABLED && !adminPreview\) return null/);
assert.match(panel, /Vincular con número de teléfono/);
for (const modal of ['src/admin/LocationDetailsModal.jsx', 'src/admin/LocationDetailsModalNext.jsx']) {
  const source = fs.readFileSync(path.join(root, modal), 'utf8');
  assert.match(source, /<PairingCodePanel\s+adminPreview=\{isAdminMode\}/, `${modal}: admins always see it`);
}
// Enlace con código (18-11): botón junto al del QR en el panel y en el iframe; mismo endpoint con mode=code.
for (const relativePath of [
  'src/admin/LocationDetailsModal.jsx',
  'src/admin/LocationDetailsModalNext.jsx',
  'src/standalone-app/StandaloneSlotManager.jsx',
]) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  assert.match(source, /handleGenerateShareUrl\('code'\)/, `${relativePath}: code link button`);
  assert.match(source, /handleGenerateShareUrl\('qr'\)/, `${relativePath}: the QR link button never receives the click event as mode`);
  assert.match(source, /JSON\.stringify\(\{ mode: 'code' \}\)/, `${relativePath}: asks the server for the code link`);
  assert.match(source, /Generar URL con código/);
  assert.doesNotMatch(source, /onClick=\{handleGenerateShareUrl\}/, `${relativePath}: no bare handler`);
  assert.match(source, /<PairingCodePanel/, `${relativePath}: direct code panel`);
}
assert.match(panel, /isPossiblePhoneNumber\(phone\)/);
assert.doesNotMatch(panel, /placeholder="595981234567"/);
assert.match(panel, /prefijo se añade automáticamente/);
assert.match(requestHelper, /PAIRING_CODE_REQUEST_TIMEOUT_MS = 125000/);
assert.match(requestHelper, /signal: controller\.signal/);
assert.match(requestHelper, /controller\.abort\(\)/);

for (const relativePath of [
  'src/admin/LocationDetailsModal.jsx',
  'src/admin/LocationDetailsModalNext.jsx',
  'src/admin/SupportManager.jsx',
  'src/admin/SupportManagerNext.jsx',
  'src/standalone-app/StandaloneSlotManager.jsx',
]) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  assert.match(source, /requestPairingCodeWithTimeout/, `${relativePath} must use the bounded pairing request`);
}

console.log('pairing_code_ui_contract_test passed');
