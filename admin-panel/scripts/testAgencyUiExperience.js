import assert from "node:assert/strict";
import {
  getAgencyUiRuntimeConfig,
  LEGACY_AGENCY_UI,
  NEXT_AGENCY_UI,
  parseAgencyAllowlist,
  resolveAgencyUiExperience,
} from "../src/utils/agencyUiExperience.js";

const VIRALTIA_AGENCY_ID = "aOmmiiF4JEKxEf5JafnY";

assert.equal(
  resolveAgencyUiExperience({
    accountInfo: { agencyId: VIRALTIA_AGENCY_ID },
    runtimeConfig: {},
  }),
  LEGACY_AGENCY_UI,
  "The new UI must default closed.",
);

assert.deepEqual(
  getAgencyUiRuntimeConfig(
    {
      __WAFLOW_ADMIN_CONFIG__: {
        VITE_AGENCY_UI_V2_ENABLED: "false",
      },
    },
    {
      VITE_AGENCY_UI_V2_ENABLED: "true",
      VITE_AGENCY_UI_V2_ALLOWLIST: VIRALTIA_AGENCY_ID,
    },
  ),
  {
    VITE_AGENCY_UI_V2_ENABLED: "false",
    VITE_AGENCY_UI_V2_ALLOWLIST: VIRALTIA_AGENCY_ID,
  },
  "Runtime configuration must override compile-time defaults for instant rollback",
);

assert.equal(
  resolveAgencyUiExperience({
    accountInfo: { agencyId: VIRALTIA_AGENCY_ID },
    runtimeConfig: {
      VITE_AGENCY_UI_V2_ENABLED: "false",
      VITE_AGENCY_UI_V2_ALLOWLIST: VIRALTIA_AGENCY_ID,
    },
  }),
  LEGACY_AGENCY_UI,
  "The emergency switch must override the allowlist.",
);

assert.equal(
  resolveAgencyUiExperience({
    accountInfo: { agencyId: VIRALTIA_AGENCY_ID },
    runtimeConfig: {
      VITE_AGENCY_UI_V2_ENABLED: "true",
      VITE_AGENCY_UI_V2_ALLOWLIST: VIRALTIA_AGENCY_ID,
    },
  }),
  NEXT_AGENCY_UI,
  "Viraltia must be eligible only when both controls allow it.",
);

assert.equal(
  resolveAgencyUiExperience({
    accountInfo: { agencyId: "another-agency" },
    runtimeConfig: {
      VITE_AGENCY_UI_V2_ENABLED: "true",
      VITE_AGENCY_UI_V2_ALLOWLIST: VIRALTIA_AGENCY_ID,
    },
  }),
  LEGACY_AGENCY_UI,
  "Other agencies must keep the current UI.",
);

assert.equal(
  resolveAgencyUiExperience({
    accountInfo: null,
    runtimeConfig: {
      VITE_AGENCY_UI_V2_ENABLED: "true",
      VITE_AGENCY_UI_V2_ALLOWLIST: VIRALTIA_AGENCY_ID,
    },
  }),
  LEGACY_AGENCY_UI,
  "Missing authenticated account data must fail closed.",
);

assert.deepEqual(
  [...parseAgencyAllowlist(` ${VIRALTIA_AGENCY_ID}, another-agency ,,`)],
  [VIRALTIA_AGENCY_ID, "another-agency"],
);

console.log("agency_ui_experience_test passed");
