// Display only: do not use this helper to build message recipients or API payloads.
export function formatPhoneForDisplay(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}
