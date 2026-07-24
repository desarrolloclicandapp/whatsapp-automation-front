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

function resolveAgencyUiExperience({ agencyId, runtimeConfig = {} } = {}) {
  if (!parseRuntimeBoolean(runtimeConfig.VITE_AGENCY_UI_V2_ENABLED, false)) {
    return LEGACY_AGENCY_UI;
  }

  const authenticatedAgencyId = String(agencyId || "").trim();
  if (!authenticatedAgencyId) return LEGACY_AGENCY_UI;

  const allowlist = parseAgencyAllowlist(runtimeConfig.VITE_AGENCY_UI_V2_ALLOWLIST);
  return allowlist.has("*") || allowlist.has(authenticatedAgencyId)
    ? NEXT_AGENCY_UI
    : LEGACY_AGENCY_UI;
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
};
