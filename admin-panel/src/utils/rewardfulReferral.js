const STORAGE_KEY = 'waflow_rewardful_referral';

function cleanReferral(value) {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200 || /[\x00-\x1F\x7F]/.test(trimmed)) {
    return '';
  }

  return trimmed;
}

export function getRewardfulReferral() {
  if (typeof window === 'undefined') return null;

  const currentReferral = cleanReferral(window.Rewardful?.referral);
  if (currentReferral) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, currentReferral);
    } catch {
      // Tracking storage is best effort only.
    }
    return currentReferral;
  }

  try {
    const queryReferral = cleanReferral(new URLSearchParams(window.location?.search || '').get('referral'));
    if (queryReferral) {
      window.localStorage?.setItem(STORAGE_KEY, queryReferral);
      return queryReferral;
    }
  } catch {
    // Query parsing/storage is best effort only.
  }

  try {
    return cleanReferral(window.localStorage?.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function buildRewardfulAuthBody(payload = {}) {
  const rewardfulReferral = getRewardfulReferral();
  return rewardfulReferral ? { ...payload, rewardfulReferral } : { ...payload };
}

export function buildRewardfulCheckoutBody(priceId) {
  return buildRewardfulAuthBody({ priceId });
}

export function trackRewardfulLead(email) {
  if (typeof window === 'undefined') return false;

  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!cleanEmail || !cleanEmail.includes('@')) return false;

  getRewardfulReferral();

  if (typeof window.rewardful !== 'function') return false;

  try {
    window.rewardful('convert', { email: cleanEmail });
    return true;
  } catch {
    return false;
  }
}
