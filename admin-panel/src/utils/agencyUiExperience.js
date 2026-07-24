const LEGACY_AGENCY_UI = "legacy";
const NEXT_AGENCY_UI = "next";

function parseRuntimeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function parseAgencyAllowlist(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function resolveAuthenticatedAgencyId(accountInfo = null) {
  return String(accountInfo?.agencyId || accountInfo?.agency_id || "").trim() || null;
}

function resolveAgencyUiExperience({
  accountInfo = null,
  runtimeConfig = {},
} = {}) {
  const enabled = parseRuntimeBoolean(
    runtimeConfig?.VITE_AGENCY_UI_V2_ENABLED,
    false,
  );
  if (!enabled) return LEGACY_AGENCY_UI;

  const agencyId = resolveAuthenticatedAgencyId(accountInfo);
  if (!agencyId) return LEGACY_AGENCY_UI;

  const allowlist = parseAgencyAllowlist(
    runtimeConfig?.VITE_AGENCY_UI_V2_ALLOWLIST,
  );
  if (!allowlist.has(agencyId)) return LEGACY_AGENCY_UI;

  return NEXT_AGENCY_UI;
}

function getAgencyUiRuntimeConfig(
  globalObject = globalThis,
  buildConfig = import.meta.env || {},
) {
  return {
    ...buildConfig,
    ...(globalObject?.__WAFLOW_ADMIN_CONFIG__ || {}),
  };
}

export {
  LEGACY_AGENCY_UI,
  NEXT_AGENCY_UI,
  getAgencyUiRuntimeConfig,
  parseAgencyAllowlist,
  parseRuntimeBoolean,
  resolveAgencyUiExperience,
  resolveAuthenticatedAgencyId,
};
