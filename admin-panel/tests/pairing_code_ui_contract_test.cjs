const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const panel = fs.readFileSync(path.join(root, 'src', 'components', 'PairingCodePanel.jsx'), 'utf8');
const requestHelper = fs.readFileSync(path.join(root, 'src', 'utils', 'requestPairingCode.js'), 'utf8');

assert.match(panel, /import AuthPhoneInput from '\.\/AuthPhoneInput'/);
assert.match(panel, /export const PAIRING_CODE_UI_ENABLED = false/);
assert.match(panel, /if \(!PAIRING_CODE_UI_ENABLED\) return null/);
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
