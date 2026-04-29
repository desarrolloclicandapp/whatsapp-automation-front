export function normalizeOpenAiApiKey(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildOpenAiKeyPayload(value) {
  const openai_api_key = normalizeOpenAiApiKey(value);
  if (!openai_api_key) {
    throw new Error('OpenAI API key requerida');
  }
  return { openai_api_key };
}

export function resolveOpenAiAccountLabel({ workspace = null, selectedLocationId = '' } = {}) {
  const location = workspace?.location || {};
  return String(location.name || location.location_id || selectedLocationId || '').trim();
}
