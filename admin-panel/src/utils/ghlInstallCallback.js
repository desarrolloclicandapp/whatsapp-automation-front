export function classifyGhlInstallCallback(search = "") {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search || ""));

  const locationId = String(params.get("location_id") || "").trim();
  const legacyInstall = String(params.get("new_install") || "").trim();
  const code = String(params.get("code") || "").trim();
  const oauth = String(params.get("oauth") || "").trim().toLowerCase();
  const isGhlOauth = oauth === "ghl";

  const hasLegacyCompanyOnlyCallback = Boolean(legacyInstall && !locationId && !code);
  const isGhlUpdateCallback = Boolean(code && !locationId && !legacyInstall && !isGhlOauth);
  const targetLocationId = locationId || (code ? legacyInstall : "");
  const shouldAutoSyncInstall = Boolean((targetLocationId || code) && !isGhlUpdateCallback && !hasLegacyCompanyOnlyCallback);
  const skipInstallPolling = Boolean(code || (legacyInstall && !locationId) || !targetLocationId);

  return {
    code,
    locationId,
    legacyInstall,
    targetLocationId,
    hasLegacyCompanyOnlyCallback,
    isGhlUpdateCallback,
    shouldAutoSyncInstall,
    skipInstallPolling
  };
}
