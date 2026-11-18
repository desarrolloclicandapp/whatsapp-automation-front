export const PAIRING_CODE_REQUEST_TIMEOUT_MS = 125000;

export async function requestPairingCodeWithTimeout(authFetch, endpoint, phone) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), PAIRING_CODE_REQUEST_TIMEOUT_MS);

  try {
    const ask = (confirmRelink) => authFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(confirmRelink ? { phone, confirmRelink: true } : { phone }),
      signal: controller.signal,
    });
    const response = await ask(false);
    // C8 (18-11): si la vinculación anterior de la línea ya no sirve, se pide la misma
    // confirmación que con el QR antes de reemplazarla. Sin confirmar, se muestra el motivo.
    if (response?.status === 409) {
      const data = await response.clone().json().catch(() => ({}));
      if (data?.confirmRelinkRequired === true) {
        const confirmed = globalThis.confirm?.(
          'La vinculación anterior de esta línea ya no se puede usar. Se archivará de forma segura antes de pedir el código. ¿Continuar?'
        );
        if (confirmed) return await ask(true);
      }
    }
    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('La generación del código tardó demasiado. Verifica la conexión e inténtalo nuevamente.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
