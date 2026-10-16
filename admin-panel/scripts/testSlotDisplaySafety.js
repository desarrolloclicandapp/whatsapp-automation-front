import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { formatPhoneForDisplay } from '../src/utils/phoneDisplay.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phones = [
  ['12025550123', '+12025550123'],
  ['+12025550123', '+12025550123'],
  ['++12025550123', '+12025550123'],
  [' +1 (202) 555-0123 ', '+12025550123'],
  [12025550123, '+12025550123'],
  ['001234', '+001234'],
  [undefined, ''],
  [null, ''],
  ['', ''],
  ['   ', ''],
  ['+', ''],
  ['N/A', ''],
  ['unknown', ''],
  [0, ''],
];
for (const [value, expected] of phones) {
  assert.equal(formatPhoneForDisplay(value), expected);
  assert.equal(formatPhoneForDisplay(expected), expected, 'Formatting must be idempotent');
}

const components = [
  ['src/admin/LocationDetailsModal.jsx', 'Numero', 'Este slot esta bloqueado por administracion.', 'Este slot esta bloqueado temporalmente por el sistema.', 'Escanea el codigo QR para conectar.'],
  ['src/admin/LocationDetailsModalNext.jsx', 'Número', 'Este slot esta bloqueado por administracion.', 'Este slot esta bloqueado temporalmente por el sistema.', 'Escanea el código QR para conectar.'],
  ['src/standalone-app/StandaloneSlotManager.jsx', 'Número', 'Este WhatsApp está bloqueado por administración.', 'Este WhatsApp esta bloqueado temporalmente por el sistema.', 'Escanea el código QR para conectar.'],
];
let headerCases = 0;
for (const [file, label, adminMessage, systemMessage, disconnectedMessage] of components) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(source, /import \{ formatPhoneForDisplay \} from '\.\.\/utils\/phoneDisplay';/);
  assert.doesNotMatch(source, /\+\$\{(?:status\.myNumber|slot\.phone_number|qrData\.myNumber)/);
  const declaration = source.match(/const headerDescription =[\s\S]*?;\r?\n/);
  assert(declaration, `Missing actual header expression in ${file}`);
  // Execute the actual display expression, without mounting React or loading
  // sockets, OAuth callbacks, real account data, or service configuration.
  const render = vm.runInNewContext(
    `(function (status, slot, slotSuspendedBy) { ${declaration[0]} return headerDescription; })`,
    { formatPhoneForDisplay, t: () => null, translateOr: (_t, _key, fallback) => fallback },
  );
  for (const [value, formatted] of phones) {
    for (const suspendedBy of [null, 'admin', 'system', 'agency']) {
      for (const connected of [false, true]) {
        const status = Object.freeze({ myNumber: value, connected });
        const slot = Object.freeze({ phone_number: '+12025550100' });
        const expected = suspendedBy === 'admin'
          ? adminMessage
          : suspendedBy === 'system'
            ? systemMessage
            : suspendedBy === 'agency'
              ? `${label}: ${formatPhoneForDisplay(value || slot.phone_number) || 'N/A'}`
              : connected
                ? `${label}: ${formatted || 'N/A'}`
                : disconnectedMessage;
        assert.equal(render(status, slot, suspendedBy), expected, file);
        headerCases++;
      }
    }
  }
  assert.equal(render({ connected: true }, {}, 'agency'), `${label}: N/A`);
  if (file.startsWith('src/admin/')) {
    assert.match(source, /String\(officialSlotSettings\.displayPhoneNumber \|\| slot\.phone_number \|\| ''\)\.trim\(\)\.replace\(\/\^\\\+\+\/, ''\)/,
      'Preserve the existing official slot card phone normalization');
    assert.match(source, /String\(slot\.phone_number \|\| ""\)\.trim\(\)\.replace\(\/\^\\\+\+\/, ''\)/,
      'Preserve the existing QR slot card phone normalization');
  } else {
    assert.match(source, /\? formatPhoneForDisplay\(slot\.phone_number\)/);
    assert.match(source, /formatPhoneForDisplay\(qrData\.myNumber\)/);
  }
}

const legacyModal = fs.readFileSync(path.join(root, components[0][0]), 'utf8');
const metaButton = legacyModal.match(/onClick=\{onConnectOfficial\}\s+disabled=\{([^}]+)\}/);
assert(metaButton, 'Test the actual Embedded Signup button disabled expression');
assert.equal(metaButton[1], "!officialEmbeddedEnabled || officialEmbeddedLoading || officialEmbeddedStarting || typeof onConnectOfficial !== 'function'");
const disabled = vm.runInNewContext(
  `(function (officialEmbeddedEnabled, officialEmbeddedLoading, officialEmbeddedStarting, onConnectOfficial) { return ${metaButton[1]}; })`,
);
let buttonCases = 0;
for (const enabled of [undefined, false, true]) {
  for (const loading of [false, true]) {
    for (const starting of [false, true]) {
      for (const callback of [undefined, () => {}]) {
        assert.equal(disabled(enabled, loading, starting, callback),
          !(enabled === true && loading === false && starting === false && typeof callback === 'function'));
        buttonCases++;
      }
    }
  }
}
assert.match(legacyModal, /if \(!official\.embeddedSignupEnabled\)/,
  'Keep the existing OAuth action validation; the display guard must not replace it');
console.log(`testSlotDisplaySafety passed: ${phones.length} phone fixtures, ${headerCases} actual header cases, ${buttonCases} button cases, no network`);
