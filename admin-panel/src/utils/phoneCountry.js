const FALLBACK_PHONE_COUNTRY = 'PY';

function normalizeRegionCandidate(value) {
  const candidate = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(candidate) ? candidate : '';
}

export function resolveDefaultPhoneCountry({
  language = '',
  localeRegion = '',
  supportedCountries = [],
} = {}) {
  const supported = new Set(supportedCountries.map((country) => String(country || '').toUpperCase()));
  const candidates = [
    normalizeRegionCandidate(localeRegion),
    normalizeRegionCandidate(String(language || '').split('-').pop()),
    FALLBACK_PHONE_COUNTRY,
  ].filter(Boolean);

  return candidates.find((candidate) => supported.has(candidate)) || FALLBACK_PHONE_COUNTRY;
}

export function detectBrowserPhoneCountry(supportedCountries = []) {
  const language = typeof navigator !== 'undefined' ? navigator.language : '';
  let localeRegion = '';

  try {
    localeRegion = typeof Intl !== 'undefined' && Intl.Locale && language
      ? new Intl.Locale(language).region || ''
      : '';
  } catch (_) {
    localeRegion = '';
  }

  return resolveDefaultPhoneCountry({ language, localeRegion, supportedCountries });
}
