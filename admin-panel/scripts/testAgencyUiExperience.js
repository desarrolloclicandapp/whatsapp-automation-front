import assert from "node:assert/strict";
import {
  LEGACY_AGENCY_UI,
  NEXT_AGENCY_UI,
  getAgencyUiRuntimeConfig,
  resolveAgencyUiExperience,
} from "../src/utils/agencyUiExperience.js";

const VIRALTIA_AGENCY_ID = "aOmmiiF4JEKxEf5JafnY";

assert.equal(resolveAgencyUiExperience(), LEGACY_AGENCY_UI);
assert.equal(
  resolveAgencyUiExperience({
    agencyId: VIRALTIA_AGENCY_ID,
    runtimeConfig: {
      VITE_AGENCY_UI_V2_ENABLED: "false",
      VITE_AGENCY_UI_V2_ALLOWLIST: VIRALTIA_AGENCY_ID,
    },
  }),
  LEGACY_AGENCY_UI,
);
assert.equal(
  resolveAgencyUiExperience({
    agencyId: "another-agency",
    runtimeConfig: {
      VITE_AGENCY_UI_V2_ENABLED: "true",
      VITE_AGENCY_UI_V2_ALLOWLIST: VIRALTIA_AGENCY_ID,
    },
  }),
  LEGACY_AGENCY_UI,
);
assert.equal(
  resolveAgencyUiExperience({
    agencyId: VIRALTIA_AGENCY_ID,
    runtimeConfig: {
      VITE_AGENCY_UI_V2_ENABLED: "true",
      VITE_AGENCY_UI_V2_ALLOWLIST: ` other-agency, ${VIRALTIA_AGENCY_ID} `,
    },
  }),
  NEXT_AGENCY_UI,
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
);

console.log("testAgencyUiExperience passed");
