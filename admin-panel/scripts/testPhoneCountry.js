import assert from 'node:assert/strict';
import { resolveDefaultPhoneCountry } from '../src/utils/phoneCountry.js';

const supportedCountries = ['PY', 'US', 'ES', 'BR'];

assert.equal(
  resolveDefaultPhoneCountry({ language: 'es-PY', supportedCountries }),
  'PY'
);

assert.equal(
  resolveDefaultPhoneCountry({ language: 'en-US', supportedCountries }),
  'US'
);

assert.equal(
  resolveDefaultPhoneCountry({ language: 'pt-BR', supportedCountries }),
  'BR'
);

assert.equal(
  resolveDefaultPhoneCountry({ language: 'es-419', localeRegion: 'ES', supportedCountries }),
  'ES'
);

assert.equal(
  resolveDefaultPhoneCountry({ language: 'fr-FR', supportedCountries }),
  'PY'
);

console.log('phone country tests passed');
