export function resolveSlotQrPollTransition({
  connected,
  qr,
  waitingForQr,
  sawFreshQr,
  qrMissingSince,
  now = Date.now(),
  postScanGraceMs = 15_000,
}) {
  if (connected) {
    return { action: 'connected', inPostScanGrace: false };
  }

  if (qr) {
    return { action: 'show_qr', inPostScanGrace: false };
  }

  if (waitingForQr) {
    return { action: 'keep_waiting', inPostScanGrace: false };
  }

  if (sawFreshQr && Number.isFinite(qrMissingSince)) {
    const elapsedSinceQrDisappeared = now - qrMissingSince;
    if (elapsedSinceQrDisappeared >= 0 && elapsedSinceQrDisappeared < postScanGraceMs) {
      return { action: 'keep_waiting', inPostScanGrace: true };
    }
  }

  if (sawFreshQr) {
    return { action: 'expired', inPostScanGrace: false };
  }

  return { action: 'keep_waiting', inPostScanGrace: false };
}
