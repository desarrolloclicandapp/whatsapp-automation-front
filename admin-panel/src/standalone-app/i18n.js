export function translateOr(t, key, fallback = '') {
  if (typeof t !== 'function') return fallback;
  const value = t(key);
  if (!value || value === key) return fallback;
  return value;
}
