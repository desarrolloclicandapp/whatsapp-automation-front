export const PAIRING_CODE_REQUEST_TIMEOUT_MS = 125000;

export async function requestPairingCodeWithTimeout(authFetch, endpoint, phone) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), PAIRING_CODE_REQUEST_TIMEOUT_MS);

  try {
    return await authFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ phone }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('La generación del código tardó demasiado. Verifica la conexión e inténtalo nuevamente.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
