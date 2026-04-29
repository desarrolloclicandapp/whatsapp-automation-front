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
    return cleanReferral(window.localStorage?.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function buildRewardfulCheckoutBody(priceId) {
  const rewardfulReferral = getRewardfulReferral();
  return rewardfulReferral ? { priceId, rewardfulReferral } : { priceId };
}
